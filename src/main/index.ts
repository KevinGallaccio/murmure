import { app, BrowserWindow, globalShortcut } from 'electron';
import { createControlWindow } from './windows';
import { registerIpc } from './ipc';

if (process.platform === 'darwin') {
  app.setName('murmure');
}

let controlWindow: BrowserWindow | null = null;

function init(): void {
  controlWindow = createControlWindow();
  registerIpc(controlWindow);
}

app.whenReady().then(() => {
  init();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) init();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
