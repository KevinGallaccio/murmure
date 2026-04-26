import { autoUpdater, type UpdateCheckResult, type UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog, app, shell, type MessageBoxOptions } from 'electron';
import { IPC } from '../shared/ipc';

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

// Updater dialogs live in the main process and don't have access to the
// renderer's i18n state. We pick the dialog language from the OS locale so
// English-speaking users on an English Mac don't see French dialogs. (If the
// user explicitly toggled the in-app FR/EN switch to something different from
// their OS locale, dialogs will still follow the OS — acceptable trade-off
// until the renderer's locale is plumbed through to main.)
type UpdaterLocale = 'fr' | 'en';

function getUpdaterLocale(): UpdaterLocale {
  const sys = (app.getLocale() || '').toLowerCase();
  return sys.startsWith('en') ? 'en' : 'fr';
}

const STRINGS = {
  fr: {
    updateAvailable: 'Mise à jour disponible',
    updateMessage: (latest: string, current: string) =>
      `Une nouvelle version (${latest}) est disponible.\n\nVersion actuelle : ${current}`,
    macDownloadDetail:
      "Téléchargez le nouvel installateur depuis GitHub, puis remplacez l'application dans le dossier Applications.\n\n" +
      "(L'installation automatique sur macOS requiert une signature Apple Developer, pas encore en place pour ce projet.)",
    openGithub: 'Ouvrir GitHub',
    later: 'Plus tard',
    download: 'Télécharger',
    askDownload: 'Voulez-vous télécharger et installer la mise à jour ?',
    downloadInProgress: 'Téléchargement en cours',
    downloadInBackground: 'La mise à jour va être téléchargée en arrière-plan.',
    downloadNotify: "L'application vous notifiera lorsque l'installation sera prête.",
    ok: 'OK',
    updateReady: 'Mise à jour prête',
    versionDownloaded: (v: string) => `La version ${v} a été téléchargée.`,
    macInstallReadyDetail:
      'Téléchargez le nouvel installateur depuis GitHub pour terminer la mise à jour.\n\n' +
      "(L'installation automatique sur macOS requiert une signature Apple Developer, pas encore en place pour ce projet.)",
    restartToApply: "L'application doit redémarrer pour appliquer la mise à jour.",
    restartNow: 'Redémarrer maintenant',
    update: 'Mise à jour',
    onLatest: 'Vous utilisez la dernière version de murmure.',
    updateError: 'Erreur de mise à jour',
    cantCheck: 'Impossible de vérifier les mises à jour.',
    unknownError: 'Erreur inconnue',
  },
  en: {
    updateAvailable: 'Update available',
    updateMessage: (latest: string, current: string) =>
      `A new version (${latest}) is available.\n\nCurrent version: ${current}`,
    macDownloadDetail:
      'Download the new installer from GitHub and replace the app in your Applications folder.\n\n' +
      '(Automatic install on macOS requires an Apple Developer signature, not yet set up for this project.)',
    openGithub: 'Open GitHub',
    later: 'Later',
    download: 'Download',
    askDownload: 'Download and install the update?',
    downloadInProgress: 'Downloading',
    downloadInBackground: 'The update will be downloaded in the background.',
    downloadNotify: "You'll be notified when it's ready to install.",
    ok: 'OK',
    updateReady: 'Update ready',
    versionDownloaded: (v: string) => `Version ${v} has been downloaded.`,
    macInstallReadyDetail:
      'Download the new installer from GitHub to finish the update.\n\n' +
      '(Automatic install on macOS requires an Apple Developer signature, not yet set up for this project.)',
    restartToApply: 'The app needs to restart to apply the update.',
    restartNow: 'Restart now',
    update: 'Update',
    onLatest: "You're on the latest version of murmure.",
    updateError: 'Update error',
    cantCheck: 'Could not check for updates.',
    unknownError: 'Unknown error',
  },
} as const;

function tr() {
  return STRINGS[getUpdaterLocale()];
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
let getStatusBroadcastWindow: (() => BrowserWindow | null) | null = null;

function setStatus(status: UpdateStatus): void {
  currentStatus = status;
  listeners.forEach((listener) => listener(status));
  // Push the new state to the renderer so the in-app banner can react.
  const win = getStatusBroadcastWindow?.();
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.UpdateStatusChanged, status);
  }
}

export function bindUpdateStatusBroadcast(getWindow: () => BrowserWindow | null): void {
  getStatusBroadcastWindow = getWindow;
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
    setStatus({ type: 'error', message: err?.message ?? tr().unknownError });
  });
}

export async function checkForUpdates(): Promise<UpdateCheckResult | null> {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err instanceof Error ? err.message : tr().unknownError;
    setStatus({ type: 'error', message });
    return null;
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : tr().unknownError;
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

// Quietly check for updates a few seconds after launch. The result lands
// in the renderer through setStatus → IPC.UpdateStatusChanged, which
// drives the sidebar banner. Errors are swallowed; a failed background
// check should never bother the user (they can still trigger an
// interactive check from the menu).
const AUTO_CHECK_DELAY_MS = 5000;

export function scheduleAutoCheck(): void {
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => {
      // ignore — silent failure for background check
    });
  }, AUTO_CHECK_DELAY_MS);
}

export function openReleasesPage(): void {
  void shell.openExternal(RELEASES_URL);
}

// Triggered from the renderer banner when the user clicks "Download &
// install". autoUpdater drives status events that propagate back to the
// banner via setStatus → IPC.UpdateStatusChanged.
export async function requestDownload(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : tr().unknownError;
    setStatus({ type: 'error', message });
  }
}

export async function checkForUpdatesInteractive(parentWindow: BrowserWindow | null): Promise<void> {
  const s = tr();
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result || !result.updateInfo) {
      await showDialog(parentWindow, {
        type: 'info',
        title: s.update,
        message: s.onLatest,
        buttons: [s.ok],
      });
      return;
    }

    const currentVersion = app.getVersion();
    const latestVersion = result.updateInfo.version;

    if (latestVersion === currentVersion) {
      await showDialog(parentWindow, {
        type: 'info',
        title: s.update,
        message: s.onLatest,
        buttons: [s.ok],
      });
      return;
    }

    if (shouldUseManualMacFlow()) {
      // macOS without a Developer ID can't apply in-place updates. Send the
      // user to the Releases page instead of silently failing on restart.
      const response = await showDialog(parentWindow, {
        type: 'info',
        title: s.updateAvailable,
        message: s.updateMessage(latestVersion, currentVersion),
        detail: s.macDownloadDetail,
        buttons: [s.openGithub, s.later],
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
      title: s.updateAvailable,
      message: s.updateMessage(latestVersion, currentVersion),
      detail: s.askDownload,
      buttons: [s.download, s.later],
      defaultId: 0,
      cancelId: 1,
    });

    if (response.response === 0) {
      await showDialog(parentWindow, {
        type: 'info',
        title: s.downloadInProgress,
        message: s.downloadInBackground,
        detail: s.downloadNotify,
        buttons: [s.ok],
      });
      await autoUpdater.downloadUpdate();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : s.unknownError;
    await showDialog(parentWindow, {
      type: 'error',
      title: s.updateError,
      message: s.cantCheck,
      detail: message,
      buttons: [s.ok],
    });
  }
}

// Triggered by the renderer banner once a download has finished. Replaces
// the old auto-firing system modal — the banner is the user's signal that
// the update is ready, and clicking "Restart now" routes here.
export function installNow(): void {
  autoUpdater.quitAndInstall(false, true);
}

export function shouldOpenReleasesInsteadOfInstall(): boolean {
  return shouldUseManualMacFlow();
}
