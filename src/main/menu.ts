import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { checkForUpdatesInteractive } from './updater';
import { navigateToTab, onLanguageChange } from './ipc';
import {
  getLanguageChoice,
  resolveLocale,
  setLanguageChoice,
} from './settings';
import { IPC, type LanguageChoice } from '../shared/ipc';

// Menu strings localised based on the user's effective language (the
// 'language' setting from electron-store, falling back to OS locale when
// 'auto'). Same approach as updater.ts dialogs.
const STRINGS = {
  fr: {
    appAbout: `À propos de ${app.name}`,
    appSettings: 'Réglages…',
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
    viewStage: 'Régie',
    viewAppearance: 'Apparence',
    viewSetup: 'Réglages',
    viewToggleDisplay: "Ouvrir / Fermer l'écran d'audience",
    viewReload: 'Recharger',
    viewDevTools: 'Outils de développement',
    viewFullscreen: 'Plein écran',

    language: 'Langue',
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageAuto: 'Auto · langue du système',

    window: 'Fenêtre',
    windowMinimize: 'Réduire',
    windowZoom: 'Zoom',
    windowFront: 'Tout ramener au premier plan',
    windowClose: 'Fermer',

    help: 'Aide',
    helpDocs: 'Documentation murmure',
    helpReport: 'Signaler un problème',
  },
  en: {
    appAbout: `About ${app.name}`,
    appSettings: 'Settings…',
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
    viewStage: 'Stage',
    viewAppearance: 'Appearance',
    viewSetup: 'Setup',
    viewToggleDisplay: 'Open / Close audience display',
    viewReload: 'Reload',
    viewDevTools: 'Developer Tools',
    viewFullscreen: 'Toggle Full Screen',

    language: 'Language',
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageAuto: 'Auto · match OS',

    window: 'Window',
    windowMinimize: 'Minimize',
    windowZoom: 'Zoom',
    windowFront: 'Bring All to Front',
    windowClose: 'Close',

    help: 'Help',
    helpDocs: 'murmure documentation',
    helpReport: 'Report an Issue',
  },
} as const;

function setLanguageAndRebuild(choice: LanguageChoice, getControlWindow: () => BrowserWindow | null): void {
  setLanguageChoice(choice);
  // Push to renderer too so its UI flips immediately.
  const win = getControlWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.LanguageChanged, { choice, resolved: resolveLocale(choice) });
  }
  rebuildMenu(getControlWindow);
}

let currentGetControlWindow: (() => BrowserWindow | null) | null = null;

function rebuildMenu(getControlWindow: () => BrowserWindow | null): void {
  const menu = createAppMenu(getControlWindow);
  Menu.setApplicationMenu(menu);
}

export function createAppMenu(getControlWindow: () => BrowserWindow | null): Menu {
  const isMac = process.platform === 'darwin';
  const t = STRINGS[resolveLocale()];
  const lang = getLanguageChoice();

  const template: MenuItemConstructorOptions[] = [];

  // App menu (macOS only)
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: t.appAbout },
        { type: 'separator' },
        {
          label: t.appSettings,
          accelerator: 'CmdOrCtrl+,',
          click: () => navigateToTab('setup'),
        },
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

  // Edit
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

  // View — tab navigation lives here
  template.push({
    label: t.view,
    submenu: [
      {
        label: t.viewStage,
        accelerator: 'CmdOrCtrl+1',
        click: () => navigateToTab('stage'),
      },
      {
        label: t.viewAppearance,
        accelerator: 'CmdOrCtrl+2',
        click: () => navigateToTab('appearance'),
      },
      {
        label: t.viewSetup,
        accelerator: 'CmdOrCtrl+3',
        click: () => navigateToTab('setup'),
      },
      { type: 'separator' },
      { role: 'reload', label: t.viewReload },
      { role: 'toggleDevTools', label: t.viewDevTools },
      { type: 'separator' },
      { role: 'togglefullscreen', label: t.viewFullscreen },
    ],
  });

  // Language
  template.push({
    label: t.language,
    submenu: [
      {
        label: t.languageEnglish,
        type: 'radio',
        checked: lang === 'en',
        click: () => setLanguageAndRebuild('en', getControlWindow),
      },
      {
        label: t.languageFrench,
        type: 'radio',
        checked: lang === 'fr',
        click: () => setLanguageAndRebuild('fr', getControlWindow),
      },
      { type: 'separator' },
      {
        label: t.languageAuto,
        type: 'radio',
        checked: lang === 'auto',
        click: () => setLanguageAndRebuild('auto', getControlWindow),
      },
    ],
  });

  // Window
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

  // Help
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
  if (!isMac) {
    helpSubmenu.push(
      { type: 'separator' },
      {
        label: t.appCheckUpdates,
        click: () => checkForUpdatesInteractive(getControlWindow()),
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
  currentGetControlWindow = getControlWindow;
  rebuildMenu(getControlWindow);
  // Rebuild whenever the user flips language from the sidebar / Setup tab.
  onLanguageChange(() => {
    if (currentGetControlWindow) rebuildMenu(currentGetControlWindow);
  });
}
