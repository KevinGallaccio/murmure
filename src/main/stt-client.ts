import type { StreamErrorPayload, StreamState, TranscriptFinal, TranscriptPartial } from '../shared/ipc';

export type STTClientCallbacks = {
  onStateChange: (state: StreamState) => void;
  onPartial: (payload: TranscriptPartial) => void;
  onFinal: (payload: TranscriptFinal) => void;
  onError: (payload: StreamErrorPayload) => void;
  onSessionBegin: () => void;
  onSessionEnd: (sessionDurationSeconds: number) => void;
};

export interface STTClient {
  getState(): StreamState;
  start(apiKey: string): void;
  stop(): void;
  sendAudio(buffer: ArrayBuffer): void;
  testApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }>;
}
