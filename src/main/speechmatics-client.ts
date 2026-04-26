import WebSocket from 'ws';
import { RECONNECT_BACKOFF_MS, SPEECHMATICS_PARAMS, SPEECHMATICS_WS_URL } from '../shared/constants';
import type { StreamState } from '../shared/ipc';
import type { STTClient, STTClientCallbacks } from './stt-client';

type SpeechmaticsEvent =
  | { message: 'RecognitionStarted'; id?: string }
  | { message: 'AudioAdded'; seq_no: number }
  | {
      message: 'AddPartialTranscript';
      transcript?: string;
      metadata?: { start_time?: number; end_time?: number };
    }
  | {
      message: 'AddTranscript';
      transcript?: string;
      metadata?: { start_time?: number; end_time?: number };
    }
  | { message: 'EndOfTranscript' }
  | { message: 'Info'; type?: string; reason?: string }
  | { message: 'Warning'; type?: string; reason?: string; code?: number | null }
  | { message: 'Error'; type?: string; reason?: string; code?: number }
  | { message: string; [key: string]: unknown };

const CLOSE_GRACE_MS = 2000;

export class SpeechmaticsClient implements STTClient {
  private ws: WebSocket | null = null;
  private state: StreamState = 'idle';
  private reconnectAttempt = 0;
  private explicitlyStopped = false;
  // Count of audio chunks we've sent. Used as `last_seq_no` in EndOfStream.
  // Speechmatics' AudioAdded.seq_no follows our send order starting at 1.
  private audioSeqNo = 0;
  private finalCount = 0;
  private partialTurnId = '';
  private sessionStartedAt = 0;
  private closeGraceTimer: NodeJS.Timeout | null = null;
  // Once true, sendAudio is a no-op until the next connect(). We flip this
  // the moment we send EndOfStream so that the renderer's in-flight chunks
  // (which can keep arriving for a few ms while state propagation catches
  // up) don't reach the server post-EOS — Speechmatics replies with an
  // `add_audio_after_eos` warning and discards them anyway.
  private audioSendBlocked = false;

  constructor(private readonly cb: STTClientCallbacks) {}

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
    // Block any further audio chunks from reaching the wire BEFORE we send
    // EndOfStream — otherwise the server complains with add_audio_after_eos.
    this.audioSendBlocked = true;
    this.clearCloseGrace();
    if (this.ws) {
      // Ask Speechmatics to flush remaining transcript before disconnect.
      // The server replies EndOfTranscript and then closes; if either step
      // doesn't arrive within CLOSE_GRACE_MS we yank the socket ourselves.
      try {
        this.ws.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: this.audioSeqNo }));
      } catch {
        // ignore — closing anyway
      }
      this.closeGraceTimer = setTimeout(() => {
        this.closeGraceTimer = null;
        try {
          this.ws?.close();
        } catch {
          // ignore
        }
      }, CLOSE_GRACE_MS);
    } else {
      this.transitionTo('idle');
    }
  }

  sendAudio(buffer: ArrayBuffer): void {
    if (this.audioSendBlocked) {
      this.logGatedOnce('audioSendBlocked (post-EndOfStream)');
      return;
    }
    if (this.state !== 'streaming') {
      this.logGatedOnce(`state=${this.state}, expected streaming`);
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logGatedOnce(`ws not open (readyState=${this.ws?.readyState})`);
      return;
    }
    if (this.ws.bufferedAmount > 256 * 1024) {
      console.warn('[murmure] Speechmatics WebSocket bufferedAmount exceeded threshold; dropping chunk');
      return;
    }
    try {
      this.ws.send(Buffer.from(buffer), { binary: true });
      this.audioSeqNo += 1;
      if (this.audioSeqNo === 1 || this.audioSeqNo % 50 === 0) {
        // Sample the first few bytes to confirm we're not sending all-zero
        // silence. PCM s16le with audible signal will have non-zero values.
        const view = new Int16Array(buffer.slice(0, 16));
        const peak = Math.max(...Array.from(view).map((v) => Math.abs(v)));
        console.info(
          `[murmure] Speechmatics sent #${this.audioSeqNo} (${buffer.byteLength}B, peak16=${peak})`,
        );
      }
    } catch (err) {
      console.error('[murmure] Speechmatics failed to send audio chunk', err);
    }
  }

  private gatedLogged = false;
  private logGatedOnce(reason: string): void {
    if (this.gatedLogged) return;
    this.gatedLogged = true;
    console.warn(`[murmure] Speechmatics sendAudio gated — ${reason}`);
  }

  testApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      const ws = new WebSocket(SPEECHMATICS_WS_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      let settled = false;
      const settle = (result: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          ws.close();
        } catch {
          // ignore
        }
        resolve(result);
      };
      const timeout = setTimeout(() => {
        settle({ ok: false, error: 'Délai dépassé en attendant une réponse.' });
      }, 8000);

      ws.on('open', () => {
        try {
          ws.send(JSON.stringify(buildStartRecognition()));
        } catch (err) {
          settle({ ok: false, error: (err as Error).message ?? "Échec d'envoi." });
        }
      });
      ws.on('message', (data) => {
        try {
          const text = typeof data === 'string' ? data : data.toString('utf-8');
          const ev = JSON.parse(text) as SpeechmaticsEvent;
          if (ev.message === 'RecognitionStarted') {
            settle({ ok: true });
          } else if (ev.message === 'Error') {
            const reason = (ev as { reason?: string }).reason;
            settle({ ok: false, error: reason ?? 'Erreur Speechmatics.' });
          }
        } catch {
          // ignore non-JSON
        }
      });
      ws.on('error', (err) => {
        const code = (err as NodeJS.ErrnoException).code;
        const message =
          code === 'ENOTFOUND' || code === 'ECONNREFUSED'
            ? 'Impossible de joindre Speechmatics (réseau ?).'
            : err.message ?? "Échec de l'authentification.";
        settle({ ok: false, error: message });
      });
      ws.on('unexpected-response', (_req, res) => {
        let body = '';
        res.on('data', (c: Buffer) => (body += c.toString('utf-8')));
        res.on('end', () => {
          let msg = `HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(body);
            if (parsed?.error) msg = parsed.error;
            else if (parsed?.detail) msg = parsed.detail;
          } catch {
            if (body) msg = body.slice(0, 200);
          }
          settle({ ok: false, error: msg });
        });
      });
    });
  }

  private connect(apiKey: string): void {
    this.transitionTo('connecting');
    const ws = new WebSocket(SPEECHMATICS_WS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    this.ws = ws;
    this.audioSeqNo = 0;
    this.partialTurnId = '';
    this.audioSendBlocked = false;
    this.gatedLogged = false;

    ws.on('open', () => {
      try {
        ws.send(JSON.stringify(buildStartRecognition()));
      } catch (err) {
        this.cb.onError({ message: (err as Error).message ?? "Échec d'envoi." });
        this.transitionTo('error');
      }
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      try {
        const ev = JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')) as SpeechmaticsEvent;
        this.handleEvent(ev);
      } catch (err) {
        console.error('[murmure] failed to parse Speechmatics message', err);
      }
    });

    ws.on('error', (err) => {
      console.error('[murmure] Speechmatics WebSocket error', err);
      this.cb.onError({ message: err.message ?? 'Erreur WebSocket inconnue.' });
      this.transitionTo('error');
    });

    ws.on('unexpected-response', (_req, res) => {
      let body = '';
      res.on('data', (c: Buffer) => (body += c.toString('utf-8')));
      res.on('end', () => {
        let msg = `HTTP ${res.statusCode}`;
        try {
          const parsed = JSON.parse(body);
          if (parsed?.error) msg = parsed.error;
          else if (parsed?.detail) msg = parsed.detail;
        } catch {
          if (body) msg = body.slice(0, 200);
        }
        this.cb.onError({ code: String(res.statusCode), message: msg });
        this.transitionTo('error');
      });
    });

    ws.on('close', (code, reason) => {
      this.ws = null;
      this.clearCloseGrace();
      const wasStreaming = this.state === 'streaming';
      const sessionDuration = this.sessionStartedAt
        ? (Date.now() - this.sessionStartedAt) / 1000
        : 0;
      this.sessionStartedAt = 0;
      if (this.explicitlyStopped) {
        if (wasStreaming) this.cb.onSessionEnd(sessionDuration);
        this.transitionTo('idle');
        return;
      }
      const reasonText = reason?.toString('utf-8') || `code ${code}`;
      this.cb.onError({ code: String(code), message: `Connexion terminée : ${reasonText}` });
      if (wasStreaming) this.cb.onSessionEnd(sessionDuration);
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

  private handleEvent(ev: SpeechmaticsEvent): void {
    switch (ev.message) {
      case 'RecognitionStarted': {
        console.info('[murmure] Speechmatics RecognitionStarted', (ev as { id?: string }).id);
        this.reconnectAttempt = 0;
        this.sessionStartedAt = Date.now();
        this.partialTurnId = `t-${Date.now()}`;
        this.transitionTo('streaming');
        this.cb.onSessionBegin();
        break;
      }
      case 'AudioAdded': {
        const ack = (ev as { seq_no: number }).seq_no;
        if (ack === 1 || ack % 50 === 0) {
          console.info(`[murmure] Speechmatics ack chunk #${ack}`);
        }
        break;
      }
      case 'AddPartialTranscript': {
        const text = (ev as { transcript?: string }).transcript ?? '';
        if (!text) break;
        console.info(
          `[murmure] Speechmatics partial: "${text.length > 60 ? text.slice(0, 60) + '…' : text}"`,
        );
        this.cb.onPartial({ text, turnId: this.partialTurnId });
        break;
      }
      case 'AddTranscript': {
        const text = (ev as { transcript?: string }).transcript ?? '';
        if (!text.trim()) break;
        console.info(`[murmure] Speechmatics final: "${text}"`);
        this.finalCount += 1;
        const turnId = `f-${this.finalCount}`;
        this.cb.onFinal({ text, turnId, timestamp: Date.now() });
        // start a fresh partial bucket so the next partials don't appear to
        // append to the just-committed final
        this.partialTurnId = `t-${Date.now()}`;
        break;
      }
      case 'EndOfTranscript': {
        // Server is done flushing; close the socket so the 'close' handler
        // can settle the rest (state, onSessionEnd).
        try {
          this.ws?.close();
        } catch {
          // ignore
        }
        break;
      }
      case 'Info': {
        const i = ev as { type?: string; reason?: string };
        console.info('[murmure] Speechmatics info:', i.type, i.reason);
        break;
      }
      case 'Warning': {
        const w = ev as { type?: string; reason?: string };
        console.warn('[murmure] Speechmatics warning:', w.type, w.reason);
        break;
      }
      case 'Error': {
        const e = ev as { type?: string; reason?: string; code?: number };
        console.error('[murmure] Speechmatics error:', e.type, e.reason, e.code);
        this.cb.onError({
          code: e.code !== undefined ? String(e.code) : e.type,
          message: e.reason ?? 'Erreur Speechmatics.',
        });
        break;
      }
      default:
        // Unknown messages — log so we can spot protocol drift
        console.info('[murmure] Speechmatics unknown message:', ev.message);
        break;
    }
  }

  private transitionTo(next: StreamState): void {
    if (this.state === next) return;
    this.state = next;
    this.cb.onStateChange(next);
  }

  private clearCloseGrace(): void {
    if (this.closeGraceTimer) {
      clearTimeout(this.closeGraceTimer);
      this.closeGraceTimer = null;
    }
  }
}

function buildStartRecognition() {
  return {
    message: 'StartRecognition',
    audio_format: {
      type: 'raw',
      encoding: SPEECHMATICS_PARAMS.encoding,
      sample_rate: SPEECHMATICS_PARAMS.sample_rate,
    },
    transcription_config: {
      language: SPEECHMATICS_PARAMS.language,
      operating_point: SPEECHMATICS_PARAMS.operating_point,
      max_delay: SPEECHMATICS_PARAMS.max_delay,
      max_delay_mode: SPEECHMATICS_PARAMS.max_delay_mode,
      enable_partials: SPEECHMATICS_PARAMS.enable_partials,
    },
  };
}
