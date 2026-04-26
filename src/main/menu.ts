import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { checkForUpdatesInteractive } from './updater';

// Same approach as src/main/updater.ts: dialogs and menu labels live in the
// main process, which can't read the renderer's i18n state. We pick the menu
// language from the OS locale so an English Mac shows English menus, a French
// Mac shows French menus. (If the user explicitly toggled the in-app FR/EN
// switch to something different from their OS, the menu still follows the OS —
// acceptable trade-off until the renderer's locale is plumbed through to main.)
type MenuLocale = 'fr' | 'en';

function getMenuLocale(): MenuLocale {
  const sys = (app.getLocale() || '').toLowerCase();
  return sys.startsWith('en') ? 'en' : 'fr';
}

const STRINGS = {
  fr: {
    appAbout: `À propos de ${app.name}`,
    appCheckUpdates: 'Vérifier les mises à jour…',
    appServices: 'Services',
    appHide: `Masquer ${app.name}`,
    appHideOthers: 'Masquer les autres',
    appUnhide: 'Tout afficher',
    appQuit: `Quitter ${app.name}`,
    edit: 'Édition',
    editUndo: 'Annuler',
    editRedo: 'Rétablir',
    editCut: 'Couper',
    editCopy: 'Copier',
    editPaste: 'Coller',
    editSelectAll: 'Tout sélectionner',
    view: 'Affichage',
    viewReload: 'Recharger',
    viewForceReload: 'Forcer le rechargement',
    viewDevTools: 'Outils de développement',
    viewActualSize: 'Taille réelle',
    viewZoomIn: 'Zoom avant',
    viewZoomOut: 'Zoom arrière',
    viewFullscreen: 'Plein écran',
    window: 'Fenêtre',
    windowMinimize: 'Réduire',
    windowZoom: 'Zoom',
    windowFront: 'Tout ramener au premier plan',
    windowClose: 'Fermer',
    help: 'Aide',
    helpDocs: 'Documentation',
    helpReport: 'Signaler un problème',
  },
  en: {
    appAbout: `About ${app.name}`,
    appCheckUpdates: 'Check for Updates…',
    appServices: 'Services',
    appHide: `Hide ${app.name}`,
    appHideOthers: 'Hide Others',
    appUnhide: 'Show All',
    appQuit: `Quit ${app.name}`,
    edit: 'Edit',
    editUndo: 'Undo',
    editRedo: 'Redo',
    editCut: 'Cut',
    editCopy: 'Copy',
    editPaste: 'Paste',
    editSelectAll: 'Select All',
    view: 'View',
    viewReload: 'Reload',
    viewForceReload: 'Force Reload',
    viewDevTools: 'Developer Tools',
    viewActualSize: 'Actual Size',
    viewZoomIn: 'Zoom In',
    viewZoomOut: 'Zoom Out',
    viewFullscreen: 'Toggle Full Screen',
    window: 'Window',
    windowMinimize: 'Minimize',
    windowZoom: 'Zoom',
    windowFront: 'Bring All to Front',
    windowClose: 'Close',
    help: 'Help',
    helpDocs: 'Documentation',
    helpReport: 'Report an Issue',
  },
} as const;

export function createAppMenu(getControlWindow: () => BrowserWindow | null): Menu {
  const isMac = process.platform === 'darwin';
  const t = STRINGS[getMenuLocale()];

  const template: MenuItemConstructorOptions[] = [];

  // App menu (macOS only)
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: t.appAbout },
        { type: 'separator' },
        {
          label: t.appCheckUpdates,
          click: () => {
            checkForUpdatesInteractive(getControlWindow());
          },
        },
        { type: 'separator' },
        { role: 'services', label: t.appServices },
        { type: 'separator' },
        { role: 'hide', label: t.appHide },
        { role: 'hideOthers', label: t.appHideOthers },
        { role: 'unhide', label: t.appUnhide },
        { type: 'separator' },
        { role: 'quit', label: t.appQuit },
      ],
    });
  }

  // Edit menu
  template.push({
    label: t.edit,
    submenu: [
      { role: 'undo', label: t.editUndo },
      { role: 'redo', label: t.editRedo },
      { type: 'separator' },
      { role: 'cut', label: t.editCut },
      { role: 'copy', label: t.editCopy },
      { role: 'paste', label: t.editPaste },
      { role: 'selectAll', label: t.editSelectAll },
    ],
  });

  // View menu
  template.push({
    label: t.view,
    submenu: [
      { role: 'reload', label: t.viewReload },
      { role: 'forceReload', label: t.viewForceReload },
      { role: 'toggleDevTools', label: t.viewDevTools },
      { type: 'separator' },
      { role: 'resetZoom', label: t.viewActualSize },
      { role: 'zoomIn', label: t.viewZoomIn },
      { role: 'zoomOut', label: t.viewZoomOut },
      { type: 'separator' },
      { role: 'togglefullscreen', label: t.viewFullscreen },
    ],
  });

  // Window menu
  template.push({
    label: t.window,
    submenu: [
      { role: 'minimize', label: t.windowMinimize },
      { role: 'zoom', label: t.windowZoom },
      ...(isMac
        ? [
            { type: 'separator' } as MenuItemConstructorOptions,
            { role: 'front', label: t.windowFront } as MenuItemConstructorOptions,
          ]
        : [{ role: 'close', label: t.windowClose } as MenuItemConstructorOptions]),
    ],
  });

  // Help menu
  const helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: t.helpDocs,
      click: () => {
        shell.openExternal('https://github.com/KevinGallaccio/murmure#readme');
      },
    },
    {
      label: t.helpReport,
      click: () => {
        shell.openExternal('https://github.com/KevinGallaccio/murmure/issues');
      },
    },
  ];

  // On Windows/Linux, put the "Check for Updates" in the Help menu
  if (!isMac) {
    helpSubmenu.push(
      { type: 'separator' },
      {
        label: t.appCheckUpdates,
        click: () => {
          checkForUpdatesInteractive(getControlWindow());
        },
      },
    );
  }

  template.push({
    label: t.help,
    role: 'help',
    submenu: helpSubmenu,
  });

  return Menu.buildFromTemplate(template);
}

export function setupAppMenu(getControlWindow: () => BrowserWindow | null): void {
  const menu = createAppMenu(getControlWindow);
  Menu.setApplicationMenu(menu);
}
