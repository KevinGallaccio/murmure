import WebSocket from 'ws';
import { RECONNECT_BACKOFF_MS, SPEECHMATICS_PARAMS, SPEECHMATICS_WS_URL } from '../shared/constants';
import type { StreamState } from '../shared/ipc';
import type { STTClient, STTClientCallbacks } from './stt-client';
import { getTranscriptionLanguage } from './settings';

type SpeechmaticsEvent =
  | { message: 'RecognitionStarted'; id?: string }
  | { message: 'AudioAdded'; seq_no: number }
  | {
      message: 'AddPartialTranscript';
      // Speechmatics format 2.9 puts the transcript inside metadata, not at
      // the top level (older 2.1 docs example shows it top-level). The
      // top-level field is kept here for forward/back compat — read both.
      transcript?: string;
      metadata?: { start_time?: number; end_time?: number; transcript?: string };
    }
  | {
      message: 'AddTranscript';
      transcript?: string;
      metadata?: { start_time?: number; end_time?: number; transcript?: string };
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
  // Buffer of words committed by AddTranscript that haven't yet ended a
  // sentence. We flush this as a single final to the renderer when we see
  // sentence-end punctuation (.?!…), so the audience sees one line per
  // sentence instead of one line per 1-3-word commit window.
  private sentenceBuffer = '';
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
    // Flush whatever sentence is in flight so the audience sees the last
    // partial words committed instead of having them disappear when the
    // partial is cleared by stop.
    this.flushSentenceBuffer();
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
    if (this.audioSendBlocked) return;
    if (this.state !== 'streaming') return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.ws.bufferedAmount > 256 * 1024) {
      console.warn('[murmure] Speechmatics WebSocket bufferedAmount exceeded threshold; dropping chunk');
      return;
    }
    try {
      this.ws.send(Buffer.from(buffer), { binary: true });
      this.audioSeqNo += 1;
    } catch (err) {
      console.error('[murmure] Speechmatics failed to send audio chunk', err);
    }
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
    this.sentenceBuffer = '';
    this.audioSendBlocked = false;

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
        this.reconnectAttempt = 0;
        this.sessionStartedAt = Date.now();
        this.partialTurnId = `t-${Date.now()}`;
        this.finalCount = 0;
        this.transitionTo('streaming');
        this.cb.onSessionBegin();
        break;
      }
      case 'AudioAdded':
        // server-side ack; we count locally on send
        break;
      case 'AddPartialTranscript': {
        const partialText = extractTranscript(ev);
        // Show the in-flight sentence: words already committed-but-not-yet-
        // sentence-ended, plus the rolling tail Speechmatics is still working
        // on. The audience sees one growing sentence until punctuation lands.
        const display = normalizeSpacing(this.sentenceBuffer + partialText);
        if (display) this.cb.onPartial({ text: display, turnId: this.partialTurnId });
        break;
      }
      case 'AddTranscript': {
        const fragment = extractTranscript(ev);
        if (!fragment.trim()) break;
        // Speechmatics commits 1-3 words every max_delay (1.5s); buffer them
        // until we see a sentence-ending punctuation, then emit the whole
        // sentence as a single final. Keeps the renderer's "one line per
        // final" behavior coherent with what AssemblyAI naturally produces.
        this.sentenceBuffer = normalizeSpacing(this.sentenceBuffer + fragment);
        this.emitCompletedSentences();
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
      case 'Info':
        // quality / quota / model selection notices — not actionable
        break;
      case 'Warning': {
        // idle_timeout, session_timeout, add_audio_after_eos, etc. — operational
        const w = ev as { type?: string; reason?: string };
        console.warn('[murmure] Speechmatics warning:', w.type, w.reason);
        break;
      }
      case 'Error': {
        const e = ev as { type?: string; reason?: string; code?: number };
        this.cb.onError({
          code: e.code !== undefined ? String(e.code) : e.type,
          message: e.reason ?? 'Erreur Speechmatics.',
        });
        break;
      }
      default:
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

  private emitCompletedSentences(): void {
    // Greedily pull off everything up to and including the first sentence-end
    // run (one or more of . ? ! …) followed by whitespace or end-of-buffer.
    // Loop because a single fragment can carry multiple sentences (e.g. the
    // observed "suite. Là, " — emit "...suite.", keep "Là, " buffered).
    for (;;) {
      const m = /([.?!…]+)(\s+|$)/.exec(this.sentenceBuffer);
      if (!m) break;
      const endIndex = m.index + m[1].length;
      const completed = this.sentenceBuffer.slice(0, endIndex).trim();
      this.sentenceBuffer = this.sentenceBuffer.slice(m.index + m[0].length);
      if (!completed) continue;
      this.finalCount += 1;
      this.cb.onFinal({
        text: completed,
        turnId: `f-${this.finalCount}`,
        timestamp: Date.now(),
      });
      this.partialTurnId = `t-${Date.now()}`;
    }
  }

  private flushSentenceBuffer(): void {
    const remainder = this.sentenceBuffer.trim();
    if (!remainder) return;
    this.sentenceBuffer = '';
    this.finalCount += 1;
    this.cb.onFinal({
      text: remainder,
      turnId: `f-${this.finalCount}`,
      timestamp: Date.now(),
    });
  }
}

// Collapse runs of whitespace into a single space, drop any whitespace that
// landed before a punctuation mark (Speechmatics emits ". " as its own
// fragment, so concat produces "word . " — we want "word. ").
function normalizeSpacing(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?…])/g, '$1');
}

// Speechmatics format 2.9 nests the transcript text inside `metadata.transcript`
// instead of placing it at the top level (which the 2.1 docs example showed).
// Reading both fields keeps us robust if Speechmatics flips back, and
// concatenating from `results` is a last-resort fallback for unfamiliar shapes.
function extractTranscript(ev: SpeechmaticsEvent): string {
  const top = (ev as { transcript?: string }).transcript;
  if (typeof top === 'string' && top.length > 0) return top;
  const meta = (ev as { metadata?: { transcript?: string } }).metadata;
  if (meta && typeof meta.transcript === 'string') return meta.transcript;
  const results = (ev as { results?: Array<{ alternatives?: Array<{ content?: string }> }> }).results;
  if (Array.isArray(results) && results.length > 0) {
    return results
      .map((r) => r.alternatives?.[0]?.content ?? '')
      .filter(Boolean)
      .join(' ');
  }
  return '';
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
      language: getTranscriptionLanguage(),
      operating_point: SPEECHMATICS_PARAMS.operating_point,
      max_delay: SPEECHMATICS_PARAMS.max_delay,
      max_delay_mode: SPEECHMATICS_PARAMS.max_delay_mode,
      enable_partials: SPEECHMATICS_PARAMS.enable_partials,
    },
  };
}
