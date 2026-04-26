import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LanguageChoice, Provider, ResolvedLocale } from '../shared/ipc';

export type Locale = ResolvedLocale;

export type Messages = {
  brand: { workspace: string };
  tabs: { stage: string; appearance: string; setup: string };
  state: {
    idle: string;
    connecting: string;
    streaming: string;
    error: string;
    ready: string;
    onAir: string;
    needsConfig: string;
    broadcasting: string;
    setupNeeded: string;
  };
  display: {
    open: string;
    closed: string;
    fullscreen: string;
    openButton: string;
    closeButton: string;
    statusOpen: string;
    statusClosed: string;
    label: string;
  };
  stage: {
    eyebrow: string;
    titleA: string;
    titleEm: string;
    titleB: string;
    sub: string;
    sessionLabel: string;
    rateSuffix: string;
    startBroadcast: string;
    stopBroadcast: string;
    monitorTitle: string;
    monitorIdle: string;
    monitorLive: string;
    setupNeededTitle: string;
    setupNeededBody: string;
    setupNeededLink: string;
  };
  appearance: {
    eyebrow: string;
    titleA: string;
    titleEm: string;
    titleB: string;
    sub: string;
    previewTitle: string;
    previewMeta: string;
    presetsTitle: string;
    presetsSub: string;
    reset: string;
    sectionType: string;
    sectionColors: string;
    sectionLayout: string;
    sectionBehavior: string;
    fieldFont: string;
    fieldWeight: string;
    fieldSize: string;
    fieldLineHeight: string;
    fieldTextColor: string;
    fieldBgColor: string;
    fieldLiveColor: string;
    fieldPaddingX: string;
    fieldPaddingY: string;
    fieldAlignment: string;
    fieldMaxLines: string;
    weight400: string;
    weight500: string;
    weight600: string;
    weight700: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    behaviorFade: string;
    behaviorFadeSub: string;
    behaviorPartial: string;
    behaviorPartialSub: string;
    behaviorAutoScroll: string;
    behaviorAutoScrollSub: string;
  };
  presets: { 'high-contrast': string; subtle: string; 'long-reading': string };
  fonts: Record<string, string>;
  setup: {
    eyebrow: string;
    titleA: string;
    titleEm: string;
    titleB: string;
    sub: string;
    languageTitle: string;
    languageSub: string;
    languageEnglish: string;
    languageFrench: string;
    languageAuto: string;
    providerTitle: string;
    providerSub: string;
    providerAssembly: string;
    providerSpeechmatics: string;
    keyTitle: Record<Provider, string>;
    keySub: Record<Provider, string>;
    keyPlaceholder: Record<Provider, string>;
    keyGetAccount: Record<Provider, string>;
    save: string;
    test: string;
    testing: string;
    clear: string;
    keyValid: string;
    keyAbsent: string;
    keyInvalid: string;
    audioTitle: string;
    audioSub: string;
    deviceLabel: string;
    deviceNone: string;
    permissionDenied: string;
    levelLabel: string;
    costsTitle: string;
    costsSub: string;
    sessionLabel: string;
    cumulLabel: string;
    elapsed: (m: number, s: string) => string;
    hoursAndSessions: (h: string, n: number) => string;
    rateLabel: string;
    dashboard: string;
    resetUsage: string;
    logTitle: string;
    logSub: string;
    logEmpty: string;
    logClear: string;
  };
  log: {
    streamState: (state: string) => string;
    captureError: (msg: string) => string;
    streamStartFailed: string;
  };
  toast: { newScreen: string; screenLost: string };
  languagePill: { tooltip: string };
  themeToggle: { tooltip: string };
};

const fr: Messages = {
  brand: { workspace: 'Espace de travail' },
  tabs: { stage: 'Régie', appearance: 'Apparence', setup: 'Réglages' },
  state: {
    idle: 'au repos',
    connecting: 'connexion en cours',
    streaming: 'en diffusion',
    error: 'erreur',
    ready: 'Prêt',
    onAir: 'En direct',
    needsConfig: 'Configuration requise',
    broadcasting: 'En diffusion',
    setupNeeded: 'À configurer',
  },
  display: {
    open: 'ouvert',
    closed: 'fermé',
    fullscreen: 'plein écran',
    openButton: "Ouvrir l'affichage",
    closeButton: "Fermer l'affichage",
    statusOpen: 'Ouvert',
    statusClosed: 'Fermé',
    label: 'Affichage',
  },
  stage: {
    eyebrow: 'Régie',
    titleA: 'Rendre la parole ',
    titleEm: 'lisible',
    titleB: '.',
    sub: "Ouvrez l'écran d'audience, cliquez sur diffuser, puis suivez la transcription en direct ici comme elle apparaît dans la salle.",
    sessionLabel: 'Session',
    rateSuffix: '$/h',
    startBroadcast: 'Démarrer la diffusion',
    stopBroadcast: 'Arrêter la diffusion',
    monitorTitle: 'Ce que voit le public',
    monitorIdle: 'aperçu',
    monitorLive: 'en direct',
    setupNeededTitle: 'Configuration en une fois',
    setupNeededBody: "Il vous faut une clé d'API et un microphone avant de diffuser. Configurez-les dans l'onglet ",
    setupNeededLink: 'Réglages',
  },
  appearance: {
    eyebrow: 'Apparence',
    titleA: 'Ce que voit votre ',
    titleEm: 'audience',
    titleB: '.',
    sub: "Réglez l'écran d'audience pour qu'il fonctionne pour le dernier rang. Les modifications s'appliquent en direct.",
    previewTitle: 'Aperçu pour le public',
    previewMeta: "reflète exactement l'écran d'audience",
    presetsTitle: 'Presets',
    presetsSub: 'Trois points de départ, calibrés pour différentes salles.',
    reset: 'Réinitialiser',
    sectionType: 'Typographie',
    sectionColors: 'Couleurs',
    sectionLayout: 'Mise en page',
    sectionBehavior: 'Comportement',
    fieldFont: 'Police',
    fieldWeight: 'Épaisseur',
    fieldSize: 'Taille',
    fieldLineHeight: 'Interligne',
    fieldTextColor: 'Texte (final)',
    fieldBgColor: 'Fond',
    fieldLiveColor: 'En direct (partiel)',
    fieldPaddingX: 'Marge horizontale',
    fieldPaddingY: 'Marge verticale',
    fieldAlignment: 'Alignement',
    fieldMaxLines: 'Lignes maximum',
    weight400: 'Régulier',
    weight500: 'Moyen',
    weight600: 'Demi-gras',
    weight700: 'Gras',
    alignLeft: 'Gauche',
    alignCenter: 'Centre',
    alignRight: 'Droite',
    behaviorFade: "Fondu doux à l'apparition",
    behaviorFadeSub: 'Les nouvelles lignes apparaissent en fondu plutôt que sèchement',
    behaviorPartial: 'Afficher les transcriptions partielles',
    behaviorPartialSub: 'Les mots apparaissent au fur et à mesure',
    behaviorAutoScroll: 'Défilement automatique',
    behaviorAutoScrollSub: 'Toujours afficher la dernière ligne',
  },
  presets: {
    'high-contrast': 'Grand contraste',
    subtle: 'Sobre',
    'long-reading': 'Lecture longue',
  },
  fonts: {
    Inter: 'Inter',
    Manrope: 'Manrope',
    'Atkinson Hyperlegible': 'Atkinson Hyperlegible',
    'IBM Plex Sans': 'IBM Plex Sans',
    'Roboto Slab': 'Roboto Slab',
    'JetBrains Mono': 'JetBrains Mono',
  },
  setup: {
    eyebrow: 'Réglages',
    titleA: 'Configuration ',
    titleEm: 'unique',
    titleB: '.',
    sub: "Choisissez un fournisseur de transcription, collez votre clé, sélectionnez un microphone. Tout reste sur cette machine.",
    languageTitle: "Langue de l'interface",
    languageSub: "Interface opérateur uniquement. La langue de transcription se règle dans shared/constants.ts.",
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageAuto: 'Auto · langue du système',
    providerTitle: 'Fournisseur de transcription',
    providerSub:
      "Speechmatics excelle sur la parole continue (interviews en direct, débats sans pauses) et offre 480 minutes gratuites par mois. AssemblyAI reste disponible comme alternative.",
    providerAssembly: 'AssemblyAI',
    providerSpeechmatics: 'Speechmatics',
    keyTitle: {
      assemblyai: 'Clé AssemblyAI',
      speechmatics: 'Clé Speechmatics',
    },
    keySub: {
      assemblyai: "Chiffrée au repos dans le trousseau du système. Envoyée uniquement à AssemblyAI.",
      speechmatics: "Chiffrée au repos dans le trousseau du système. Envoyée uniquement à Speechmatics.",
    },
    keyPlaceholder: {
      assemblyai: 'Coller votre clé AssemblyAI ici…',
      speechmatics: 'Coller votre clé Speechmatics ici…',
    },
    keyGetAccount: {
      assemblyai: 'Pas encore de compte AssemblyAI ?',
      speechmatics: 'Pas encore de compte Speechmatics ?',
    },
    save: 'Enregistrer',
    test: 'Tester',
    testing: 'Vérification…',
    clear: 'Effacer',
    keyValid: 'Clé valide · enregistrée dans le trousseau',
    keyAbsent: 'Aucune clé enregistrée',
    keyInvalid: 'Clé invalide',
    audioTitle: 'Source audio',
    audioSub: 'Surveillez le vumètre pour vérifier que le micro reçoit du signal.',
    deviceLabel: "Périphérique d'entrée",
    deviceNone: 'Aucun périphérique détecté',
    permissionDenied: 'Accès microphone refusé.',
    levelLabel: "Niveau d'entrée",
    costsTitle: 'Coûts & usage',
    costsSub: 'Estimation locale basée sur la durée de session.',
    sessionLabel: 'Session en cours',
    cumulLabel: 'Cumul estimé',
    elapsed: (m, s) => `${m}m ${s}s écoulé`,
    hoursAndSessions: (h, n) => `${h} h · ${n} sessions`,
    rateLabel: 'Tarif ($/heure)',
    dashboard: 'Tableau de bord',
    resetUsage: 'Remettre à zéro',
    logTitle: 'Journal',
    logSub: 'Événements récents de cette session.',
    logEmpty: 'Aucun événement.',
    logClear: 'Effacer',
  },
  log: {
    streamState: (state) => `État du flux: ${state}`,
    captureError: (msg) => `Capture audio: ${msg}`,
    streamStartFailed: 'Démarrage impossible.',
  },
  toast: {
    newScreen: "Nouvel écran détecté — déplacer l'affichage ?",
    screenLost: "Écran déconnecté — l'affichage est revenu sur l'écran principal.",
  },
  languagePill: { tooltip: 'Changer de langue' },
  themeToggle: { tooltip: 'Changer le thème' },
};

const en: Messages = {
  brand: { workspace: 'Workspace' },
  tabs: { stage: 'Stage', appearance: 'Appearance', setup: 'Setup' },
  state: {
    idle: 'idle',
    connecting: 'connecting',
    streaming: 'broadcasting',
    error: 'error',
    ready: 'Ready',
    onAir: 'On air',
    needsConfig: 'Configure to begin',
    broadcasting: 'Broadcasting',
    setupNeeded: 'Setup needed',
  },
  display: {
    open: 'open',
    closed: 'closed',
    fullscreen: 'fullscreen',
    openButton: 'Open display',
    closeButton: 'Close display',
    statusOpen: 'Open',
    statusClosed: 'Closed',
    label: 'Display',
  },
  stage: {
    eyebrow: 'Stage',
    titleA: 'Make the spoken word ',
    titleEm: 'readable',
    titleB: '.',
    sub: 'Open the audience display, hit broadcast, and watch the live transcript here as it appears in the room.',
    sessionLabel: 'Session',
    rateSuffix: '$/h',
    startBroadcast: 'Start broadcast',
    stopBroadcast: 'Stop broadcast',
    monitorTitle: 'What the audience sees',
    monitorIdle: 'idle preview',
    monitorLive: 'mirroring · live',
    setupNeededTitle: 'One-time setup',
    setupNeededBody: "You'll need an API key and a microphone before broadcasting. Set them up under ",
    setupNeededLink: 'Setup',
  },
  appearance: {
    eyebrow: 'Appearance',
    titleA: 'How the room ',
    titleEm: 'reads',
    titleB: '.',
    sub: 'Tune the audience screen until it works for the back row. Changes apply live to the broadcast and to the preview below.',
    previewTitle: 'Audience preview',
    previewMeta: 'mirrors the audience screen exactly',
    presetsTitle: 'Presets',
    presetsSub: 'Three starting points, tuned for different rooms and audiences.',
    reset: 'Reset',
    sectionType: 'Type',
    sectionColors: 'Colors',
    sectionLayout: 'Layout',
    sectionBehavior: 'Behavior',
    fieldFont: 'Font',
    fieldWeight: 'Weight',
    fieldSize: 'Size',
    fieldLineHeight: 'Line height',
    fieldTextColor: 'Text (final)',
    fieldBgColor: 'Background',
    fieldLiveColor: 'Live (partial)',
    fieldPaddingX: 'Horizontal padding',
    fieldPaddingY: 'Vertical padding',
    fieldAlignment: 'Alignment',
    fieldMaxLines: 'Maximum lines',
    weight400: 'Regular',
    weight500: 'Medium',
    weight600: 'Semibold',
    weight700: 'Bold',
    alignLeft: 'Left',
    alignCenter: 'Center',
    alignRight: 'Right',
    behaviorFade: 'Soft fade on appearance',
    behaviorFadeSub: 'New lines fade in instead of cutting',
    behaviorPartial: 'Show partial transcripts',
    behaviorPartialSub: "Words appear as they're recognized",
    behaviorAutoScroll: 'Auto-scroll',
    behaviorAutoScrollSub: 'Always show the most recent line',
  },
  presets: {
    'high-contrast': 'High contrast',
    subtle: 'Subtle',
    'long-reading': 'Long reading',
  },
  fonts: {
    Inter: 'Inter',
    Manrope: 'Manrope',
    'Atkinson Hyperlegible': 'Atkinson Hyperlegible',
    'IBM Plex Sans': 'IBM Plex Sans',
    'Roboto Slab': 'Roboto Slab',
    'JetBrains Mono': 'JetBrains Mono',
  },
  setup: {
    eyebrow: 'Setup',
    titleA: 'One-time ',
    titleEm: 'configuration',
    titleB: '.',
    sub: 'Pick a transcription provider, paste your key, choose a microphone. Everything stays on this machine.',
    languageTitle: 'Interface language',
    languageSub: 'Operator UI only. Transcription language is set separately in shared/constants.ts.',
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageAuto: 'Auto · OS',
    providerTitle: 'Transcription provider',
    providerSub:
      'Speechmatics excels at continuous speech (live interviews, debates without pauses) and offers 480 free minutes per month. AssemblyAI is kept as an alternative.',
    providerAssembly: 'AssemblyAI',
    providerSpeechmatics: 'Speechmatics',
    keyTitle: {
      assemblyai: 'AssemblyAI key',
      speechmatics: 'Speechmatics key',
    },
    keySub: {
      assemblyai: 'Encrypted at rest in your OS Keychain. Never sent anywhere except AssemblyAI.',
      speechmatics: 'Encrypted at rest in your OS Keychain. Never sent anywhere except Speechmatics.',
    },
    keyPlaceholder: {
      assemblyai: 'Paste your AssemblyAI key here…',
      speechmatics: 'Paste your Speechmatics key here…',
    },
    keyGetAccount: {
      assemblyai: "Don't have an AssemblyAI account?",
      speechmatics: "Don't have a Speechmatics account?",
    },
    save: 'Save',
    test: 'Test',
    testing: 'Verifying…',
    clear: 'Clear',
    keyValid: 'Key valid · saved to Keychain',
    keyAbsent: 'No key saved',
    keyInvalid: 'Invalid key',
    audioTitle: 'Audio source',
    audioSub: 'Watch the meter dance to verify your mic.',
    deviceLabel: 'Input device',
    deviceNone: 'No device detected',
    permissionDenied: 'Microphone access denied.',
    levelLabel: 'Input level',
    costsTitle: 'Costs & usage',
    costsSub: 'Local estimate based on session duration.',
    sessionLabel: 'Current session',
    cumulLabel: 'Estimated total',
    elapsed: (m, s) => `${m}m ${s}s elapsed`,
    hoursAndSessions: (h, n) => `${h} h · ${n} sessions`,
    rateLabel: 'Rate ($/hour)',
    dashboard: 'Dashboard',
    resetUsage: 'Reset',
    logTitle: 'Activity log',
    logSub: 'Recent events from this session.',
    logEmpty: 'No events yet.',
    logClear: 'Clear',
  },
  log: {
    streamState: (state) => `Stream state: ${state}`,
    captureError: (msg) => `Audio capture: ${msg}`,
    streamStartFailed: 'Could not start.',
  },
  toast: {
    newScreen: 'New screen detected — move the display?',
    screenLost: 'Screen disconnected — display moved back to the primary screen.',
  },
  languagePill: { tooltip: 'Switch language' },
  themeToggle: { tooltip: 'Switch theme' },
};

const dictionaries: Record<Locale, Messages> = { fr, en };

type LocaleContextValue = {
  choice: LanguageChoice;
  resolved: Locale;
  setChoice: (next: LanguageChoice) => void;
  cycle: () => void;
  t: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }): JSX.Element {
  const [choice, setChoiceState] = useState<LanguageChoice>('auto');
  const [resolved, setResolved] = useState<Locale>('en');

  // Initial bootstrap from main.
  useEffect(() => {
    let active = true;
    void window.diffuseur.language.get().then((s) => {
      if (!active) return;
      setChoiceState(s.choice);
      setResolved(s.resolved);
    });
    const off = window.diffuseur.language.onChange((s) => {
      setChoiceState(s.choice);
      setResolved(s.resolved);
    });
    return () => {
      active = false;
      off();
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = resolved;
  }, [resolved]);

  const setChoice = useCallback((next: LanguageChoice) => {
    void window.diffuseur.language.set(next);
  }, []);

  const cycle = useCallback(() => {
    const order: LanguageChoice[] = ['en', 'fr', 'auto'];
    const idx = order.indexOf(choice);
    const next = order[(idx + 1) % order.length];
    void window.diffuseur.language.set(next);
  }, [choice]);

  const value = useMemo<LocaleContextValue>(
    () => ({ choice, resolved, setChoice, cycle, t: dictionaries[resolved] }),
    [choice, resolved, setChoice, cycle],
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
