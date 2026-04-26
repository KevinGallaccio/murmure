import { autoUpdater, type UpdateCheckResult, type UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog, app, type MessageBoxOptions } from 'electron';

export type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string };

type UpdateListener = (status: UpdateStatus) => void;

let currentStatus: UpdateStatus = { type: 'idle' };
const listeners: Set<UpdateListener> = new Set();

function setStatus(status: UpdateStatus): void {
  currentStatus = status;
  listeners.forEach((listener) => listener(status));
}

async function showDialog(
  parentWindow: BrowserWindow | null,
  options: MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> {
  if (parentWindow && !parentWindow.isDestroyed()) {
    return dialog.showMessageBox(parentWindow, options);
  }
  return dialog.showMessageBox(options);
}

export function initUpdater(): void {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setStatus({ type: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setStatus({ type: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    setStatus({ type: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    setStatus({ type: 'downloading', percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setStatus({ type: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    setStatus({ type: 'error', message: err?.message ?? 'Unknown error' });
  });
}

export async function checkForUpdates(): Promise<UpdateCheckResult | null> {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    setStatus({ type: 'error', message });
    return null;
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed';
    setStatus({ type: 'error', message });
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus;
}

export function onUpdateStatus(listener: UpdateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function checkForUpdatesInteractive(parentWindow: BrowserWindow | null): Promise<void> {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result || !result.updateInfo) {
      await showDialog(parentWindow, {
        type: 'info',
        title: 'Mise à jour',
        message: 'Vous utilisez la dernière version de murmure.',
        buttons: ['OK'],
      });
      return;
    }

    const currentVersion = app.getVersion();
    const latestVersion = result.updateInfo.version;

    // Compare versions - if latest <= current, no update needed
    if (latestVersion === currentVersion) {
      await showDialog(parentWindow, {
        type: 'info',
        title: 'Mise à jour',
        message: 'Vous utilisez la dernière version de murmure.',
        buttons: ['OK'],
      });
      return;
    }

    const response = await showDialog(parentWindow, {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `Une nouvelle version (${latestVersion}) est disponible.\n\nVersion actuelle : ${currentVersion}`,
      detail: 'Voulez-vous télécharger et installer la mise à jour ?',
      buttons: ['Télécharger', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response.response === 0) {
      // User chose to download
      await showDialog(parentWindow, {
        type: 'info',
        title: 'Téléchargement en cours',
        message: 'La mise à jour va être téléchargée en arrière-plan.',
        detail: "L'application vous notifiera lorsque l'installation sera prête.",
        buttons: ['OK'],
      });
      await autoUpdater.downloadUpdate();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    await showDialog(parentWindow, {
      type: 'error',
      title: 'Erreur de mise à jour',
      message: 'Impossible de vérifier les mises à jour.',
      detail: message,
      buttons: ['OK'],
    });
  }
}

export function setupUpdateDownloadedPrompt(getWindow: () => BrowserWindow | null): void {
  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    const parentWindow = getWindow();
    const response = await showDialog(parentWindow, {
      type: 'info',
      title: 'Mise à jour prête',
      message: `La version ${info.version} a été téléchargée.`,
      detail: "L'application doit redémarrer pour appliquer la mise à jour.",
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
}
