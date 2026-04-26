import { autoUpdater, type UpdateCheckResult, type UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog, app, shell, type MessageBoxOptions } from 'electron';

// In-place auto-install on macOS requires the app to be signed with an Apple
// Developer ID. Squirrel.framework (used by electron-updater on macOS) verifies
// that the new bundle's code signature anchors to the same identity as the
// running app, and silently rejects the swap if it doesn't. Ad-hoc signed
// builds (which is what CI produces today) fail this check.
//
// Until a Developer ID is set up, macOS users get a "notify + open the
// Releases page" flow instead. Windows uses the full auto-update flow because
// NSIS handles in-place updates without signature gymnastics.
//
// Flip this to true once the project has a real Developer ID in CI.
const MACOS_AUTO_INSTALL_ENABLED = false;

const RELEASES_URL = 'https://github.com/KevinGallaccio/murmure/releases/latest';

function shouldUseManualMacFlow(): boolean {
  return process.platform === 'darwin' && !MACOS_AUTO_INSTALL_ENABLED;
}

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
let updaterInitialized = false;
let downloadPromptInitialized = false;

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
  // Ensure we only initialize once to prevent duplicate event handlers
  if (updaterInitialized) return;
  updaterInitialized = true;

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
    setStatus({ type: 'error', message: err?.message ?? 'Erreur inconnue' });
  });
}

export async function checkForUpdates(): Promise<UpdateCheckResult | null> {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    setStatus({ type: 'error', message });
    return null;
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Échec du téléchargement';
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

    // If versions match, no update needed (checkForUpdates handles version comparison)
    if (latestVersion === currentVersion) {
      await showDialog(parentWindow, {
        type: 'info',
        title: 'Mise à jour',
        message: 'Vous utilisez la dernière version de murmure.',
        buttons: ['OK'],
      });
      return;
    }

    if (shouldUseManualMacFlow()) {
      // macOS without a Developer ID can't apply in-place updates. Send the
      // user to the Releases page instead of silently failing on restart.
      const response = await showDialog(parentWindow, {
        type: 'info',
        title: 'Mise à jour disponible',
        message: `Une nouvelle version (${latestVersion}) est disponible.\n\nVersion actuelle : ${currentVersion}`,
        detail:
          "Téléchargez le nouvel installateur depuis GitHub puis remplacez l'application dans le dossier Applications.\n\n" +
          "(L'installation automatique sur macOS requiert une signature Apple Developer, pas encore en place pour ce projet.)",
        buttons: ['Ouvrir GitHub', 'Plus tard'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response.response === 0) {
        await shell.openExternal(RELEASES_URL);
      }
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
  // Ensure we only register the prompt handler once
  if (downloadPromptInitialized) return;
  downloadPromptInitialized = true;

  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    // On unsigned macOS builds the swap-on-restart will silently fail and
    // relaunch the old version. Don't pretend it works — point at GitHub
    // instead. (Belt-and-suspenders: the interactive check already short-
    // circuits before downloading, but if anything else triggers a download
    // this guard keeps the broken UX out of users' way.)
    if (shouldUseManualMacFlow()) {
      const parentWindow = getWindow();
      const response = await showDialog(parentWindow, {
        type: 'info',
        title: 'Mise à jour prête',
        message: `La version ${info.version} a été téléchargée.`,
        detail:
          "Téléchargez le nouvel installateur depuis GitHub pour terminer la mise à jour.\n\n" +
          "(L'installation automatique sur macOS requiert une signature Apple Developer, pas encore en place pour ce projet.)",
        buttons: ['Ouvrir GitHub', 'Plus tard'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response.response === 0) {
        await shell.openExternal(RELEASES_URL);
      }
      return;
    }

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
