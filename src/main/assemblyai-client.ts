import WebSocket from 'ws';
import { ASSEMBLY_PARAMS, ASSEMBLY_WS_BASE, RECONNECT_BACKOFF_MS } from '../shared/constants';
import type { StreamErrorPayload, StreamState, TranscriptFinal, TranscriptPartial } from '../shared/ipc';
import { getAssemblyConfig } from './settings';

export type AssemblyAIClientCallbacks = {
  onStateChange: (state: StreamState) => void;
  onPartial: (payload: TranscriptPartial) => void;
  onFinal: (payload: TranscriptFinal) => void;
  onError: (payload: StreamErrorPayload) => void;
  onSessionBegin: () => void;
  onSessionEnd: (sessionDurationSeconds: number) => void;
};

type AssemblyEvent =
  | { type: 'Begin'; id: string; expires_at: number }
  | { type: 'Turn'; turn_order: number; transcript: string; end_of_turn: boolean; turn_is_formatted: boolean }
  | { type: 'Termination'; audio_duration_seconds?: number; session_duration_seconds?: number }
  | { type: 'Error'; error?: string; code?: string }
  | { type: string; [key: string]: unknown };

export class AssemblyAIClient {
  private ws: WebSocket | null = null;
  private state: StreamState = 'idle';
  private reconnectAttempt = 0;
  private explicitlyStopped = false;
  private lastTurnId: string = '';
  private currentTurnText = '';
  private forceEndpointTimer: NodeJS.Timeout | null = null;

  constructor(private readonly cb: AssemblyAIClientCallbacks) {}

  getState(): StreamState {
    return this.state;
  }

  start(apiKey: string): void {
    if (this.state === 'streaming' || this.state === 'connecting') return;
    this.explicitlyStopped = false;
    this.connect(apiKey);
  }

  stop(): void {
    this.explicitlyStopped = true;
    this.clearForceEndpoint();
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: 'Terminate' }));
      } catch {
        // ignore — terminating anyway
      }
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.transitionTo('idle');
  }

  sendAudio(buffer: ArrayBuffer): void {
    if (this.state !== 'streaming' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.ws.bufferedAmount > 256 * 1024) {
      console.warn('[diffuseur] WebSocket bufferedAmount exceeded threshold; dropping chunk');
      return;
    }
    try {
      this.ws.send(Buffer.from(buffer), { binary: true });
    } catch (err) {
      console.error('[diffuseur] failed to send audio chunk', err);
    }
  }

  testApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      const url = this.buildUrl();
      const ws = new WebSocket(url, {
        headers: { Authorization: apiKey },
      });
      const timeout = setTimeout(() => {
        try {
          ws.close();
        } catch {
          // ignore
        }
        resolve({ ok: false, error: 'Délai dépassé en attendant une réponse.' });
      }, 8000);

      ws.on('open', () => {
        // wait for Begin
      });
      ws.on('message', (data) => {
        try {
          const text = typeof data === 'string' ? data : data.toString('utf-8');
          const ev = JSON.parse(text) as AssemblyEvent;
          if (ev.type === 'Begin') {
            clearTimeout(timeout);
            try {
              ws.send(JSON.stringify({ type: 'Terminate' }));
            } catch {
              // ignore
            }
            try {
              ws.close();
            } catch {
              // ignore
            }
            resolve({ ok: true });
          } else if (ev.type === 'Error') {
            clearTimeout(timeout);
            try {
              ws.close();
            } catch {
              // ignore
            }
            resolve({ ok: false, error: (ev as { error?: string }).error ?? 'Erreur AssemblyAI.' });
          }
        } catch {
          // ignore non-JSON
        }
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        const code = (err as NodeJS.ErrnoException).code;
        const message =
          code === 'ENOTFOUND' || code === 'ECONNREFUSED'
            ? 'Impossible de joindre AssemblyAI (réseau ?).'
            : err.message ?? "Échec de l'authentification.";
        resolve({ ok: false, error: message });
      });
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timeout);
        let body = '';
        res.on('data', (c: Buffer) => (body += c.toString('utf-8')));
        res.on('end', () => {
          let msg = `HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(body);
            if (parsed?.error) msg = parsed.error;
          } catch {
            if (body) msg = body.slice(0, 200);
          }
          resolve({ ok: false, error: msg });
        });
      });
    });
  }

  private buildUrl(): string {
    const params = new URLSearchParams();
    params.set('sample_rate', String(ASSEMBLY_PARAMS.sample_rate));
    params.set('encoding', ASSEMBLY_PARAMS.encoding);
    params.set('speech_model', ASSEMBLY_PARAMS.speech_model);
    params.set('language', ASSEMBLY_PARAMS.language);
    params.set('format_turns', String(ASSEMBLY_PARAMS.format_turns));
    params.set(
      'min_end_of_turn_silence_when_confident',
      String(ASSEMBLY_PARAMS.min_end_of_turn_silence_when_confident),
    );
    params.set('max_turn_silence', String(ASSEMBLY_PARAMS.max_turn_silence));
    return `${ASSEMBLY_WS_BASE}?${params.toString()}`;
  }

  private connect(apiKey: string): void {
    this.transitionTo('connecting');
    const ws = new WebSocket(this.buildUrl(), {
      headers: { Authorization: apiKey },
    });
    this.ws = ws;
    this.lastTurnId = '';
    this.currentTurnText = '';
    this.clearForceEndpoint();

    ws.on('open', () => {
      // wait for Begin event before declaring streaming
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      try {
        const ev = JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')) as AssemblyEvent;
        this.handleEvent(ev);
      } catch (err) {
        console.error('[diffuseur] failed to parse AssemblyAI message', err);
      }
    });

    ws.on('error', (err) => {
      console.error('[diffuseur] AssemblyAI WebSocket error', err);
      this.cb.onError({ message: err.message ?? 'Erreur WebSocket inconnue.' });
      this.transitionTo('error');
    });

    ws.on('close', (code, reason) => {
      this.ws = null;
      const wasStreaming = this.state === 'streaming';
      if (this.explicitlyStopped) {
        this.transitionTo('idle');
        return;
      }
      const reasonText = reason?.toString('utf-8') || `code ${code}`;
      this.cb.onError({ code: String(code), message: `Connexion terminée: ${reasonText}` });
      if (wasStreaming && this.reconnectAttempt < RECONNECT_BACKOFF_MS.length) {
        const delay = RECONNECT_BACKOFF_MS[this.reconnectAttempt];
        this.reconnectAttempt += 1;
        this.transitionTo('connecting');
        setTimeout(() => {
          if (!this.explicitlyStopped) this.connect(apiKey);
        }, delay);
      } else {
        this.transitionTo('error');
      }
    });
  }

  private handleEvent(ev: AssemblyEvent): void {
    switch (ev.type) {
      case 'Begin': {
        this.reconnectAttempt = 0;
        this.transitionTo('streaming');
        this.cb.onSessionBegin();
        break;
      }
      case 'Turn': {
        const turnEv = ev as Extract<AssemblyEvent, { type: 'Turn' }>;
        const turnId = String(turnEv.turn_order);
        if (turnId !== this.lastTurnId) {
          this.lastTurnId = turnId;
          this.currentTurnText = '';
          // New turn detected — start the watchdog. If this turn keeps
          // growing for FORCE_ENDPOINT_MS without committing, we'll force
          // AssemblyAI to commit it so the audience sees the text before
          // the speaker finally pauses.
          this.scheduleForceEndpoint();
        }
        const text = turnEv.transcript ?? '';
        if (turnEv.end_of_turn && turnEv.turn_is_formatted) {
          this.clearForceEndpoint();
          this.cb.onFinal({ text, turnId, timestamp: Date.now() });
          this.currentTurnText = '';
        } else if (!turnEv.end_of_turn) {
          this.currentTurnText = text;
          this.cb.onPartial({ text, turnId });
        }
        break;
      }
      case 'Termination': {
        const term = ev as Extract<AssemblyEvent, { type: 'Termination' }>;
        const seconds = term.session_duration_seconds ?? 0;
        this.cb.onSessionEnd(seconds);
        break;
      }
      case 'Error': {
        const errEv = ev as Extract<AssemblyEvent, { type: 'Error' }>;
        this.cb.onError({ code: errEv.code, message: errEv.error ?? 'Erreur AssemblyAI.' });
        break;
      }
      default:
        // Unknown event types ignored
        break;
    }
  }

  private transitionTo(next: StreamState): void {
    if (this.state === next) return;
    this.state = next;
    if (next !== 'streaming') this.clearForceEndpoint();
    this.cb.onStateChange(next);
  }

  private scheduleForceEndpoint(): void {
    this.clearForceEndpoint();
    // Read the threshold each schedule so changes from the Setup UI take
    // effect on the next turn without needing to reconnect.
    const ms = getAssemblyConfig().forceEndpointMs;
    if (ms === null || ms <= 0) return; // user disabled the watchdog
    this.forceEndpointTimer = setTimeout(() => {
      this.forceEndpointTimer = null;
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state === 'streaming') {
        try {
          this.ws.send(JSON.stringify({ type: 'ForceEndpoint' }));
        } catch (err) {
          console.error('[murmure] ForceEndpoint send failed', err);
        }
      }
    }, ms);
  }

  private clearForceEndpoint(): void {
    if (this.forceEndpointTimer) {
      clearTimeout(this.forceEndpointTimer);
      this.forceEndpointTimer = null;
    }
  }
}
