import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FontFamilyId, StylePresetId } from '../shared/style';

export type Locale = 'fr' | 'en';

export type Messages = {
  state: {
    idle: string;
    connecting: string;
    streaming: string;
    error: string;
  };
  display: {
    label: string;
    open: string;
    closed: string;
    fullscreen: string;
    openButton: string;
    closeButton: string;
  };
  hero: {
    stateLabel: string;
    sessionSuffix: string;
  };
  guards: {
    noKey: string;
    noDevice: string;
    singleScreen: string;
  };
  sidebar: {
    caption: string;
    sections: {
      config: string;
      source: string;
      journal: string;
      costs: string;
    };
  };
  apikey: {
    placeholder: string;
    placeholderSet: string;
    show: string;
    hide: string;
    showAria: string;
    hideAria: string;
    save: string;
    test: string;
    testing: string;
    clear: string;
    saved: string;
    verified: string;
    absent: string;
    unknownError: string;
  };
  device: {
    label: string;
    none: string;
    micFallback: (suffix: string) => string;
    permissionDenied: string;
  };
  vu: {
    label: string;
  };
  diffuse: {
    idle: string;
    connecting: string;
    streaming: string;
    error: string;
  };
  preview: {
    title: string;
    caption: string;
    help: string;
    demoTag: string;
    liveTag: string;
    demoAria: string;
    liveAria: string;
  };
  apparence: {
    title: string;
    reset: string;
    resetTooltip: string;
    groups: {
      type: string;
      colors: string;
      layout: string;
    };
    fields: {
      font: string;
      weight: string;
      size: string;
      lineHeight: string;
      text: string;
      background: string;
      live: string;
      paddingX: string;
      paddingY: string;
      align: string;
      maxLines: string;
      animation: string;
      animationDescription: string;
      chooseColor: string;
    };
    weights: {
      regular: string;
      semibold: string;
      extrabold: string;
    };
    align: {
      left: string;
      center: string;
      right: string;
    };
  };
  fonts: Record<FontFamilyId, string>;
  presets: Record<StylePresetId, string>;
  usage: {
    sessionLabel: string;
    cumulLabel: string;
    elapsed: (m: number, s: string) => string;
    hoursAndSessions: (h: string, n: number) => string;
    rateLabel: string;
    rateSuffix: string;
    help: string;
    dashboard: string;
    reset: string;
    resetSince: (date: string) => string;
  };
  journal: {
    empty: string;
    streamState: (state: string) => string;
    captureError: (msg: string) => string;
    streamStartFailed: string;
  };
  toast: {
    newScreen: string;
    screenLost: string;
  };
  language: {
    tooltip: string;
    fr: string;
    en: string;
  };
};

const fr: Messages = {
  state: {
    idle: 'au repos',
    connecting: 'connexion en cours',
    streaming: 'en diffusion',
    error: 'erreur',
  },
  display: {
    label: 'Affichage',
    open: 'ouvert',
    closed: 'fermé',
    fullscreen: 'plein écran',
    openButton: "Ouvrir l'affichage",
    closeButton: "Fermer l'affichage",
  },
  hero: {
    stateLabel: 'État',
    sessionSuffix: 'session',
  },
  guards: {
    noKey: "Enregistrez d'abord une clé API.",
    noDevice: "Sélectionnez un périphérique d'entrée audio.",
    singleScreen:
      'Un seul écran détecté — branchez un second écran pour passer en plein écran.',
  },
  sidebar: {
    caption: 'Préparation',
    sections: {
      config: 'Configuration',
      source: 'Source audio',
      journal: 'Journal',
      costs: 'Coûts & usage',
    },
  },
  apikey: {
    placeholder: 'Coller votre clé AssemblyAI ici',
    placeholderSet: '•••••••••••••• (clé enregistrée)',
    show: 'Afficher',
    hide: 'Masquer',
    showAria: 'Afficher la clé',
    hideAria: 'Masquer la clé',
    save: 'Enregistrer',
    test: 'Tester la clé',
    testing: 'Vérification…',
    clear: 'Effacer',
    saved: 'chiffrée et enregistrée localement',
    verified: 'clé valide — connexion à AssemblyAI réussie',
    absent: 'aucune clé enregistrée',
    unknownError: 'Erreur inconnue.',
  },
  device: {
    label: "Périphérique d'entrée",
    none: 'Aucun périphérique détecté',
    micFallback: (suffix) => `Microphone (${suffix})`,
    permissionDenied: 'Accès microphone refusé.',
  },
  vu: {
    label: "Niveau d'entrée",
  },
  diffuse: {
    idle: 'Diffuser',
    connecting: 'Connexion…',
    streaming: 'Arrêter la diffusion',
    error: 'Réessayer',
  },
  preview: {
    title: 'Aperçu',
    caption: 'Ce que voit le public',
    help: "reflète exactement l'écran d'audience",
    demoTag: 'Démo',
    liveTag: 'En direct',
    demoAria: 'Mode démo actif',
    liveAria: 'Diffusion en direct',
  },
  apparence: {
    title: 'Apparence',
    reset: 'Réinitialiser',
    resetTooltip: 'Réinitialiser tous les paramètres',
    groups: {
      type: 'Type',
      colors: 'Couleurs',
      layout: 'Mise en page',
    },
    fields: {
      font: 'Police',
      weight: 'Épaisseur',
      size: 'Taille',
      lineHeight: 'Interligne',
      text: 'Texte',
      background: 'Fond',
      live: 'Texte en direct',
      paddingX: 'Marge horizontale',
      paddingY: 'Marge verticale',
      align: 'Alignement',
      maxLines: 'Lignes maximum',
      animation: 'Animation',
      animationDescription: "Fondu doux à l'apparition",
      chooseColor: 'Choisir une couleur',
    },
    weights: {
      regular: 'Régulier (400)',
      semibold: 'Demi-gras (600)',
      extrabold: 'Extra-gras (800)',
    },
    align: {
      left: 'Gauche',
      center: 'Centre',
      right: 'Droite',
    },
  },
  fonts: {
    Inter: 'Inter (sans)',
    Manrope: 'Manrope (sans géométrique)',
    'Atkinson Hyperlegible': 'Atkinson Hyperlegible (lecture facile)',
    'IBM Plex Sans': 'IBM Plex Sans',
    'Roboto Slab': 'Roboto Slab (serif)',
    'JetBrains Mono': 'JetBrains Mono (mono)',
  },
  presets: {
    'grand-contraste': 'Grand contraste',
    sobre: 'Sobre',
    'lecture-longue': 'Lecture longue',
  },
  usage: {
    sessionLabel: 'Session en cours',
    cumulLabel: 'Cumul estimé',
    elapsed: (m, s) => `${m}m ${s}s écoulé`,
    hoursAndSessions: (h, n) => `${h} h · ${n} sessions`,
    rateLabel: 'Tarif',
    rateSuffix: '$/h',
    help:
      'Estimation locale basée sur la durée de session. Vérifiez le montant réel sur le tableau de bord AssemblyAI.',
    dashboard: 'Tableau de bord ↗',
    reset: 'Remettre à zéro',
    resetSince: (date) => `depuis le ${date}`,
  },
  journal: {
    empty: '— aucun événement —',
    streamState: (state) => `État du flux: ${state}`,
    captureError: (msg) => `Capture audio: ${msg}`,
    streamStartFailed: 'Démarrage impossible.',
  },
  toast: {
    newScreen: "Nouvel écran détecté — déplacer l'affichage ?",
    screenLost: "Écran déconnecté — l'affichage est revenu sur l'écran principal.",
  },
  language: {
    tooltip: 'Changer de langue',
    fr: 'FR',
    en: 'EN',
  },
};

const en: Messages = {
  state: {
    idle: 'idle',
    connecting: 'connecting',
    streaming: 'broadcasting',
    error: 'error',
  },
  display: {
    label: 'Display',
    open: 'open',
    closed: 'closed',
    fullscreen: 'fullscreen',
    openButton: 'Open display',
    closeButton: 'Close display',
  },
  hero: {
    stateLabel: 'State',
    sessionSuffix: 'session',
  },
  guards: {
    noKey: 'Save an API key first.',
    noDevice: 'Select an audio input device.',
    singleScreen: 'Only one screen detected — connect a second screen to go fullscreen.',
  },
  sidebar: {
    caption: 'Setup',
    sections: {
      config: 'Configuration',
      source: 'Audio source',
      journal: 'Log',
      costs: 'Costs & usage',
    },
  },
  apikey: {
    placeholder: 'Paste your AssemblyAI key here',
    placeholderSet: '•••••••••••••• (key saved)',
    show: 'Show',
    hide: 'Hide',
    showAria: 'Show key',
    hideAria: 'Hide key',
    save: 'Save',
    test: 'Test key',
    testing: 'Verifying…',
    clear: 'Clear',
    saved: 'encrypted and stored locally',
    verified: 'key valid — connection to AssemblyAI succeeded',
    absent: 'no key saved',
    unknownError: 'Unknown error.',
  },
  device: {
    label: 'Input device',
    none: 'No device detected',
    micFallback: (suffix) => `Microphone (${suffix})`,
    permissionDenied: 'Microphone access denied.',
  },
  vu: {
    label: 'Input level',
  },
  diffuse: {
    idle: 'Broadcast',
    connecting: 'Connecting…',
    streaming: 'Stop broadcast',
    error: 'Retry',
  },
  preview: {
    title: 'Preview',
    caption: 'What the audience sees',
    help: 'mirrors the audience screen exactly',
    demoTag: 'Demo',
    liveTag: 'Live',
    demoAria: 'Demo mode active',
    liveAria: 'Broadcasting live',
  },
  apparence: {
    title: 'Appearance',
    reset: 'Reset',
    resetTooltip: 'Reset all settings',
    groups: {
      type: 'Type',
      colors: 'Colors',
      layout: 'Layout',
    },
    fields: {
      font: 'Font',
      weight: 'Weight',
      size: 'Size',
      lineHeight: 'Line height',
      text: 'Text',
      background: 'Background',
      live: 'Live text',
      paddingX: 'Horizontal padding',
      paddingY: 'Vertical padding',
      align: 'Alignment',
      maxLines: 'Maximum lines',
      animation: 'Animation',
      animationDescription: 'Soft fade on appearance',
      chooseColor: 'Choose a color',
    },
    weights: {
      regular: 'Regular (400)',
      semibold: 'Semibold (600)',
      extrabold: 'Extrabold (800)',
    },
    align: {
      left: 'Left',
      center: 'Center',
      right: 'Right',
    },
  },
  fonts: {
    Inter: 'Inter (sans)',
    Manrope: 'Manrope (geometric sans)',
    'Atkinson Hyperlegible': 'Atkinson Hyperlegible (low-vision friendly)',
    'IBM Plex Sans': 'IBM Plex Sans',
    'Roboto Slab': 'Roboto Slab (serif)',
    'JetBrains Mono': 'JetBrains Mono (mono)',
  },
  presets: {
    'grand-contraste': 'High contrast',
    sobre: 'Subtle',
    'lecture-longue': 'Long reading',
  },
  usage: {
    sessionLabel: 'Current session',
    cumulLabel: 'Estimated total',
    elapsed: (m, s) => `${m}m ${s}s elapsed`,
    hoursAndSessions: (h, n) => `${h} h · ${n} sessions`,
    rateLabel: 'Rate',
    rateSuffix: '$/h',
    help:
      'Local estimate based on session duration. Check the actual amount on the AssemblyAI dashboard.',
    dashboard: 'Dashboard ↗',
    reset: 'Reset',
    resetSince: (date) => `since ${date}`,
  },
  journal: {
    empty: '— no events —',
    streamState: (state) => `Stream state: ${state}`,
    captureError: (msg) => `Audio capture: ${msg}`,
    streamStartFailed: 'Could not start.',
  },
  toast: {
    newScreen: 'New screen detected — move the display?',
    screenLost: 'Screen disconnected — display moved back to the primary screen.',
  },
  language: {
    tooltip: 'Switch language',
    fr: 'FR',
    en: 'EN',
  },
};

const dictionaries: Record<Locale, Messages> = { fr, en };

const STORAGE_KEY = 'murmure.locale';

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'fr';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    // localStorage may be inaccessible; fall through
  }
  const lang = (navigator.language || 'fr').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  return 'fr';
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === 'fr' ? 'en' : 'fr';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, toggleLocale, t: dictionaries[locale] }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

export function useT(): Messages {
  return useLocale().t;
}
