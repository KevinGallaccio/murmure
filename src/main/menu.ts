import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { checkForUpdatesInteractive } from './updater';

export function createAppMenu(getControlWindow: () => BrowserWindow | null): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [];

  // App menu (macOS only)
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: 'À propos de murmure' },
        { type: 'separator' },
        {
          label: 'Vérifier les mises à jour…',
          click: () => {
            checkForUpdatesInteractive(getControlWindow());
          },
        },
        { type: 'separator' },
        { role: 'services', label: 'Services' },
        { type: 'separator' },
        { role: 'hide', label: 'Masquer murmure' },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Tout afficher' },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter murmure' },
      ],
    });
  }

  // Edit menu
  template.push({
    label: 'Édition',
    submenu: [
      { role: 'undo', label: 'Annuler' },
      { role: 'redo', label: 'Rétablir' },
      { type: 'separator' },
      { role: 'cut', label: 'Couper' },
      { role: 'copy', label: 'Copier' },
      { role: 'paste', label: 'Coller' },
      { role: 'selectAll', label: 'Tout sélectionner' },
    ],
  });

  // View menu
  template.push({
    label: 'Affichage',
    submenu: [
      { role: 'reload', label: 'Recharger' },
      { role: 'forceReload', label: 'Forcer le rechargement' },
      { role: 'toggleDevTools', label: 'Outils de développement' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Taille réelle' },
      { role: 'zoomIn', label: 'Zoom avant' },
      { role: 'zoomOut', label: 'Zoom arrière' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran' },
    ],
  });

  // Window menu
  template.push({
    label: 'Fenêtre',
    submenu: [
      { role: 'minimize', label: 'Réduire' },
      { role: 'zoom', label: 'Zoom' },
      ...(isMac
        ? [
            { type: 'separator' } as MenuItemConstructorOptions,
            { role: 'front', label: 'Tout ramener au premier plan' } as MenuItemConstructorOptions,
          ]
        : [{ role: 'close', label: 'Fermer' } as MenuItemConstructorOptions]),
    ],
  });

  // Help menu
  const helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Documentation',
      click: () => {
        shell.openExternal('https://github.com/KevinGallaccio/murmure#readme');
      },
    },
    {
      label: 'Signaler un problème',
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
        label: 'Vérifier les mises à jour…',
        click: () => {
          checkForUpdatesInteractive(getControlWindow());
        },
      },
    );
  }

  template.push({
    label: 'Aide',
    role: 'help',
    submenu: helpSubmenu,
  });

  return Menu.buildFromTemplate(template);
}

export function setupAppMenu(getControlWindow: () => BrowserWindow | null): void {
  const menu = createAppMenu(getControlWindow);
  Menu.setApplicationMenu(menu);
}
