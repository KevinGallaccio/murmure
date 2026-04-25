import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApiKeyStatus,
  ApiKeyTestResult,
  DisplayInfo,
  DisplayState,
  MockState,
  StreamErrorPayload,
  StreamState,
  StyleUpdate,
  TranscriptFinal,
  TranscriptPartial,
  UsageUpdate,
} from '../shared/ipc';
import { IPC } from '../shared/ipc';
import type { StyleSettings } from '../shared/style';

type Unsubscribe = () => void;

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const wrapped = (_e: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api = {
  apikey: {
    status: (): Promise<ApiKeyStatus> => ipcRenderer.invoke(IPC.ApiKeyStatus),
    save: (plaintext: string): Promise<ApiKeyStatus> => ipcRenderer.invoke(IPC.ApiKeySave, { plaintext }),
    clear: (): Promise<ApiKeyStatus> => ipcRenderer.invoke(IPC.ApiKeyClear),
    test: (): Promise<ApiKeyTestResult> => ipcRenderer.invoke(IPC.ApiKeyTest),
  },
  stream: {
    start: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(IPC.StreamStart),
    stop: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.StreamStop),
    sendAudioChunk: (buffer: ArrayBuffer): void => {
      ipcRenderer.send(IPC.AudioChunk, new Uint8Array(buffer));
    },
    onState: (cb: (s: StreamState) => void) => subscribe<StreamState>(IPC.StreamState, cb),
    onError: (cb: (e: StreamErrorPayload) => void) => subscribe<StreamErrorPayload>(IPC.StreamError, cb),
    onFinal: (cb: (t: TranscriptFinal) => void) => subscribe<TranscriptFinal>(IPC.TranscriptFinal, cb),
    onPartial: (cb: (t: TranscriptPartial) => void) => subscribe<TranscriptPartial>(IPC.TranscriptPartial, cb),
  },
  style: {
    get: (): Promise<StyleSettings> => ipcRenderer.invoke(IPC.StyleGet),
    update: (partial: StyleUpdate): Promise<StyleSettings> => ipcRenderer.invoke(IPC.StyleUpdate, partial),
    reset: (): Promise<StyleSettings> => ipcRenderer.invoke(IPC.StyleReset),
    onApply: (cb: (s: StyleSettings) => void) => subscribe<StyleSettings>(IPC.StyleApply, cb),
  },
  display: {
    list: (): Promise<DisplayInfo[]> => ipcRenderer.invoke(IPC.DisplayList),
    open: (displayId?: number): Promise<DisplayState> =>
      ipcRenderer.invoke(IPC.DisplayOpen, { displayId }),
    close: (): Promise<DisplayState> => ipcRenderer.invoke(IPC.DisplayClose),
    onState: (cb: (s: DisplayState) => void) => subscribe<DisplayState>(IPC.DisplayState, cb),
    onChanged: (cb: (e: { kind: 'added' | 'removed'; displays: DisplayInfo[] }) => void) =>
      subscribe(IPC.DisplayChanged, cb),
  },
  mock: {
    setEnabled: (enabled: boolean): Promise<MockState> =>
      ipcRenderer.invoke(IPC.MockSetEnabled, { enabled }),
    onState: (cb: (s: MockState) => void) => subscribe<MockState>(IPC.MockState, cb),
  },
  usage: {
    onUpdate: (cb: (u: UsageUpdate) => void) => subscribe<UsageUpdate>(IPC.UsageUpdate, cb),
    reset: (): Promise<UsageUpdate> => ipcRenderer.invoke(IPC.UsageReset),
    setRate: (ratePerHour: number): Promise<UsageUpdate> =>
      ipcRenderer.invoke(IPC.UsageSetRate, { ratePerHour }),
    openDashboard: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.UsageOpenDashboard),
  },
};

contextBridge.exposeInMainWorld('diffuseur', api);

export type DiffuseurApi = typeof api;
