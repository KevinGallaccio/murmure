import { app, BrowserWindow, globalShortcut, session, systemPreferences } from 'electron';
import { createControlWindow } from './windows';
import { registerIpc } from './ipc';
import { bindUpdateStatusBroadcast, initUpdater, scheduleAutoCheck } from './updater';
import { setupAppMenu } from './menu';

if (process.platform === 'darwin') {
  app.setName('murmure');
}

let controlWindow: BrowserWindow | null = null;

function init(): void {
  controlWindow = createControlWindow();
  registerIpc(controlWindow);
  
  // Set up the application menu with "Check for Updates"
  setupAppMenu(() => controlWindow);
  
  // Initialize the auto-updater (internally guarded to run only once),
  // wire status changes through to the renderer banner, and kick off a
  // quiet background check 5s after launch so we don't compete with
  // first paint for I/O.
  initUpdater();
  bindUpdateStatusBroadcast(() => controlWindow);
  scheduleAutoCheck();
}

app.whenReady().then(async () => {
  // On macOS, proactively request OS-level mic permission once at startup.
  // After the user grants it the first time, this becomes a no-op on every launch.
  if (process.platform === 'darwin') {
    try {
      await systemPreferences.askForMediaAccess('microphone');
    } catch {
      // Non-fatal — the renderer will surface a clearer error if access is missing.
    }
  }

  // Tell Electron's browser layer "yes, our own renderer can use the media API."
  // Without this, every getUserMedia() call goes through Electron's default prompt
  // path, which on unsigned macOS builds can re-trigger the system TCC dialog.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') return callback(true);
    return callback(false);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media';
  });

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
