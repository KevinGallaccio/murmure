import { BrowserWindow, shell, type Display } from 'electron';
import { join } from 'path';

const isDev = !!process.env.ELECTRON_RENDERER_URL;
const rendererBaseUrl = process.env.ELECTRON_RENDERER_URL ?? '';

function rendererTarget(name: 'control' | 'display'): { url?: string; file?: string } {
  if (isDev) {
    return { url: `${rendererBaseUrl}/src/renderer-${name}/index.html` };
  }
  return { file: join(__dirname, `../renderer/src/renderer-${name}/index.html`) };
}

export function createControlWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#161616',
    title: 'murmure',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/control.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const target = rendererTarget('control');
  if (target.url) {
    void win.loadURL(target.url);
  } else if (target.file) {
    void win.loadFile(target.file);
  }

  return win;
}

export function createDisplayWindow(display: Display | null): BrowserWindow {
  const bounds = display?.bounds ?? { x: 100, y: 100, width: 1280, height: 720 };
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreenable: true,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/display.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
    if (display) {
      win.setFullScreen(true);
    }
  });

  win.setMenuBarVisibility(false);

  const target = rendererTarget('display');
  if (target.url) {
    void win.loadURL(target.url);
  } else if (target.file) {
    void win.loadFile(target.file);
  }

  return win;
}
