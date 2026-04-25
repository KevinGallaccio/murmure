import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type DisplayState,
  type MockState,
  type StreamState,
  type TranscriptFinal,
  type TranscriptPartial,
} from '../shared/ipc';
import type { StyleSettings } from '../shared/style';

type Unsubscribe = () => void;

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const wrapped = (_e: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api = {
  onStyleApply: (cb: (s: StyleSettings) => void) => subscribe<StyleSettings>(IPC.StyleApply, cb),
  onPartial: (cb: (t: TranscriptPartial) => void) => subscribe<TranscriptPartial>(IPC.TranscriptPartial, cb),
  onFinal: (cb: (t: TranscriptFinal) => void) => subscribe<TranscriptFinal>(IPC.TranscriptFinal, cb),
  onMockState: (cb: (s: MockState) => void) => subscribe<MockState>(IPC.MockState, cb),
  onStreamState: (cb: (s: StreamState) => void) => subscribe<StreamState>(IPC.StreamState, cb),
  onDisplayState: (cb: (s: DisplayState) => void) => subscribe<DisplayState>(IPC.DisplayState, cb),
};

contextBridge.exposeInMainWorld('diffuseurDisplay', api);

export type DiffuseurDisplayApi = typeof api;
