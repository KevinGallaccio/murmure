import { BrowserWindow, ipcMain, screen, shell } from 'electron';
import { IPC, type ApiKeyTestResult, type DisplayState, type MockState, type StreamState } from '../shared/ipc';
import { ASSEMBLY_DASHBOARD_URL } from '../shared/constants';
import {
  clearApiKey,
  getApiKey,
  getStyleSettings,
  hasApiKey,
  resetStyle,
  saveApiKey,
  updateStyle,
} from './settings';
import { findDisplay, listDisplays } from './displays';
import { AssemblyAIClient } from './assemblyai-client';
import { usageTracker } from './usage';
import { createDisplayWindow } from './windows';

type AppContext = {
  controlWindow: BrowserWindow;
  displayWindow: BrowserWindow | null;
};

const ctx: AppContext = { controlWindow: null as unknown as BrowserWindow, displayWindow: null };

let client: AssemblyAIClient | null = null;
let mockEnabled = true;

function broadcast(channel: string, payload: unknown): void {
  for (const win of [ctx.controlWindow, ctx.displayWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function sendToControl(channel: string, payload: unknown): void {
  if (ctx.controlWindow && !ctx.controlWindow.isDestroyed()) {
    ctx.controlWindow.webContents.send(channel, payload);
  }
}

function sendToDisplay(channel: string, payload: unknown): void {
  if (ctx.displayWindow && !ctx.displayWindow.isDestroyed()) {
    ctx.displayWindow.webContents.send(channel, payload);
  }
}

function getDisplayState(): DisplayState {
  if (!ctx.displayWindow || ctx.displayWindow.isDestroyed()) {
    return { isOpen: false, displayId: null, isFullscreen: false };
  }
  const winBounds = ctx.displayWindow.getBounds();
  const matching = screen.getDisplayMatching(winBounds);
  return {
    isOpen: true,
    displayId: matching.id,
    isFullscreen: ctx.displayWindow.isFullScreen(),
  };
}

function broadcastDisplayState(): void {
  broadcast(IPC.DisplayState, getDisplayState());
}

function attachEscapeToExitFullscreen(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'Escape') return;
    const dw = ctx.displayWindow;
    if (dw && !dw.isDestroyed() && dw.isFullScreen()) {
      dw.setFullScreen(false);
      event.preventDefault();
    }
  });
}

function setMockEnabled(enabled: boolean): void {
  mockEnabled = enabled;
  const payload: MockState = { enabled };
  broadcast(IPC.MockState, payload);
}

function setupClientCallbacks(): AssemblyAIClient {
  let lastState: StreamState = 'idle';
  return new AssemblyAIClient({
    onStateChange: (state: StreamState) => {
      // finalize the session on any transition out of streaming
      if (lastState === 'streaming' && state !== 'streaming' && usageTracker.isActive()) {
        usageTracker.endSession();
      }
      lastState = state;
      broadcast(IPC.StreamState, state);
      if (state === 'streaming') setMockEnabled(false);
      if (state === 'idle' && !usageTracker.isActive()) setMockEnabled(true);
    },
    onPartial: (partial) => {
      sendToDisplay(IPC.TranscriptPartial, partial);
      sendToControl(IPC.TranscriptPartial, partial);
    },
    onFinal: (final) => {
      sendToDisplay(IPC.TranscriptFinal, final);
      sendToControl(IPC.TranscriptFinal, final);
    },
    onError: (err) => sendToControl(IPC.StreamError, err),
    onSessionBegin: () => {
      usageTracker.startSession();
    },
    onSessionEnd: () => {
      // server-side termination already arrived; tracker will end on the next transition
    },
  });
}

export function registerIpc(controlWindow: BrowserWindow): void {
  ctx.controlWindow = controlWindow;
  client = setupClientCallbacks();
  usageTracker.bind((payload) => broadcast(IPC.UsageUpdate, payload));

  ipcMain.handle(IPC.ApiKeyStatus, () => ({ hasKey: hasApiKey() }));
  ipcMain.handle(IPC.ApiKeySave, async (_e, payload: { plaintext: string }) => {
    saveApiKey(payload.plaintext);
    return { hasKey: true };
  });
  ipcMain.handle(IPC.ApiKeyClear, () => {
    clearApiKey();
    return { hasKey: false };
  });
  ipcMain.handle(IPC.ApiKeyTest, async (): Promise<ApiKeyTestResult> => {
    const key = getApiKey();
    if (!key) return { ok: false, error: "Aucune clé API enregistrée." };
    if (!client) client = setupClientCallbacks();
    return client.testApiKey(key);
  });

  ipcMain.handle(IPC.StreamStart, async () => {
    const key = getApiKey();
    if (!key) return { ok: false, error: 'Clé API absente.' };
    if (!client) client = setupClientCallbacks();
    client.start(key);
    return { ok: true };
  });
  ipcMain.handle(IPC.StreamStop, async () => {
    client?.stop();
    return { ok: true };
  });

  ipcMain.on(IPC.AudioChunk, (_e, buffer: ArrayBuffer | Uint8Array) => {
    if (!client) return;
    if (buffer instanceof Uint8Array) {
      const copy = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(copy).set(buffer);
      client.sendAudio(copy);
    } else {
      client.sendAudio(buffer);
    }
  });

  ipcMain.handle(IPC.StyleGet, () => getStyleSettings());
  ipcMain.handle(IPC.StyleUpdate, (_e, partial) => {
    const next = updateStyle(partial);
    sendToDisplay(IPC.StyleApply, next);
    return next;
  });
  ipcMain.handle(IPC.StyleReset, () => {
    const next = resetStyle();
    sendToDisplay(IPC.StyleApply, next);
    return next;
  });

  ipcMain.handle(IPC.DisplayList, () => listDisplays());
  ipcMain.handle(IPC.DisplayOpen, (_e, payload?: { displayId?: number }) => {
    if (ctx.displayWindow && !ctx.displayWindow.isDestroyed()) {
      ctx.displayWindow.focus();
      return getDisplayState();
    }
    const target = findDisplay(payload?.displayId ?? null);
    const win = createDisplayWindow(target);
    ctx.displayWindow = win;

    win.webContents.on('did-finish-load', () => {
      win.webContents.send(IPC.StyleApply, getStyleSettings());
      win.webContents.send(IPC.MockState, { enabled: mockEnabled });
      win.webContents.send(IPC.DisplayState, getDisplayState());
    });

    win.on('closed', () => {
      ctx.displayWindow = null;
      broadcastDisplayState();
    });
    win.on('enter-full-screen', broadcastDisplayState);
    win.on('leave-full-screen', broadcastDisplayState);
    win.on('move', broadcastDisplayState);
    attachEscapeToExitFullscreen(win);
    return getDisplayState();
  });
  ipcMain.handle(IPC.DisplayClose, () => {
    if (ctx.displayWindow && !ctx.displayWindow.isDestroyed()) {
      ctx.displayWindow.close();
    }
    return getDisplayState();
  });

  ipcMain.handle(IPC.MockSetEnabled, (_e, payload: { enabled: boolean }) => {
    setMockEnabled(payload.enabled);
    return { enabled: mockEnabled };
  });

  ipcMain.handle(IPC.UsageReset, () => usageTracker.resetUsage());
  ipcMain.handle(IPC.UsageGetRate, () => usageTracker.snapshot().ratePerHour);
  ipcMain.handle(IPC.UsageSetRate, (_e, payload: { ratePerHour: number }) =>
    usageTracker.setRate(payload.ratePerHour),
  );
  ipcMain.handle(IPC.UsageOpenDashboard, () => {
    void shell.openExternal(ASSEMBLY_DASHBOARD_URL);
    return { ok: true };
  });

  // Escape exits the display fullscreen, listened on each window's webContents.
  // Using before-input-event (instead of globalShortcut) avoids hijacking
  // Escape system-wide and works reliably on Windows, where globalShortcut
  // for Escape is unreliable. The handler fires on whichever window is
  // focused, so the operator can press Escape from the control window even
  // when the display is fullscreen on another monitor.
  attachEscapeToExitFullscreen(controlWindow);

  // toast on screen change
  screen.on('display-added', () => {
    sendToControl(IPC.DisplayChanged, { kind: 'added', displays: listDisplays() });
  });
  screen.on('display-removed', () => {
    sendToControl(IPC.DisplayChanged, { kind: 'removed', displays: listDisplays() });
    if (ctx.displayWindow && !ctx.displayWindow.isDestroyed()) {
      // If display was unplugged, move display window back to primary
      const primary = screen.getPrimaryDisplay();
      ctx.displayWindow.setFullScreen(false);
      ctx.displayWindow.setBounds({
        x: primary.bounds.x + 50,
        y: primary.bounds.y + 50,
        width: 800,
        height: 450,
      });
      broadcastDisplayState();
    }
  });

  // initial broadcast
  controlWindow.webContents.on('did-finish-load', () => {
    sendToControl(IPC.StreamState, client?.getState() ?? 'idle');
    sendToControl(IPC.UsageUpdate, usageTracker.snapshot());
    sendToControl(IPC.StyleApply, getStyleSettings());
    sendToControl(IPC.MockState, { enabled: mockEnabled });
    sendToControl(IPC.DisplayState, getDisplayState());
  });
}
