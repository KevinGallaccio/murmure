import Store from 'electron-store';
import { app, safeStorage } from 'electron';
import { DEFAULT_STYLE, type StyleSettings } from '../shared/style';
import { DEFAULT_RATE_PER_HOUR } from '../shared/constants';
import type { LanguageChoice, ResolvedLocale, Theme } from '../shared/ipc';

export type SessionRecord = {
  startedAt: string;
  endedAt: string;
  seconds: number;
};

export type AssemblyConfig = {
  // Watchdog: if a turn keeps growing for this long (ms) without a final,
  // send ForceEndpoint to commit the current partial. null = disabled, rely
  // entirely on natural end-of-turn detection. 0 < n < 60_000 are valid.
  forceEndpointMs: number | null;
};

export const DEFAULT_ASSEMBLY_CONFIG: AssemblyConfig = {
  forceEndpointMs: 5000,
};

export type PersistedState = {
  apiKey: { ciphertext: string } | null;
  selectedDeviceId: string | null;
  style: StyleSettings;
  theme: Theme;
  language: LanguageChoice;
  assembly: AssemblyConfig;
  usage: {
    totalSeconds: number;
    sessions: SessionRecord[];
    ratePerHour: number;
    resetAt: string;
  };
};

const initialState: PersistedState = {
  apiKey: null,
  selectedDeviceId: null,
  style: DEFAULT_STYLE,
  theme: 'light',
  language: 'auto',
  assembly: DEFAULT_ASSEMBLY_CONFIG,
  usage: {
    totalSeconds: 0,
    sessions: [],
    ratePerHour: DEFAULT_RATE_PER_HOUR,
    resetAt: new Date().toISOString(),
  },
};

const store = new Store<PersistedState>({
  name: 'murmure',
  defaults: initialState,
});

let cachedKey: string | null = null;

export function getStyleSettings(): StyleSettings {
  return { ...DEFAULT_STYLE, ...store.get('style') };
}

export function updateStyle(partial: Partial<StyleSettings>): StyleSettings {
  const merged = { ...getStyleSettings(), ...partial };
  store.set('style', merged);
  return merged;
}

export function resetStyle(): StyleSettings {
  store.set('style', DEFAULT_STYLE);
  return DEFAULT_STYLE;
}

export function getSelectedDeviceId(): string | null {
  return store.get('selectedDeviceId');
}

export function setSelectedDeviceId(id: string | null): void {
  store.set('selectedDeviceId', id);
}

export function saveApiKey(plaintext: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Le système de chiffrement n'est pas disponible sur cette machine.");
  }
  const ciphertext = safeStorage.encryptString(plaintext).toString('base64');
  store.set('apiKey', { ciphertext });
  cachedKey = plaintext;
}

export function clearApiKey(): void {
  store.set('apiKey', null);
  cachedKey = null;
}

export function hasApiKey(): boolean {
  return store.get('apiKey') !== null;
}

export function getApiKey(): string | null {
  if (cachedKey !== null) return cachedKey;
  const stored = store.get('apiKey');
  if (!stored) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    cachedKey = safeStorage.decryptString(Buffer.from(stored.ciphertext, 'base64'));
    return cachedKey;
  } catch {
    return null;
  }
}

export function getUsage() {
  return store.get('usage');
}

export function appendSession(record: SessionRecord): PersistedState['usage'] {
  const usage = getUsage();
  const next = {
    ...usage,
    totalSeconds: usage.totalSeconds + record.seconds,
    sessions: [...usage.sessions, record].slice(-200),
  };
  store.set('usage', next);
  return next;
}

export function bumpTotalSeconds(deltaSeconds: number): PersistedState['usage'] {
  const usage = getUsage();
  const next = { ...usage, totalSeconds: usage.totalSeconds + deltaSeconds };
  store.set('usage', next);
  return next;
}

export function setRatePerHour(rate: number): PersistedState['usage'] {
  const usage = getUsage();
  const next = { ...usage, ratePerHour: rate };
  store.set('usage', next);
  return next;
}

export function resetUsage(): PersistedState['usage'] {
  const usage = getUsage();
  const next = {
    ...usage,
    totalSeconds: 0,
    sessions: [],
    resetAt: new Date().toISOString(),
  };
  store.set('usage', next);
  return next;
}

export function getTheme(): Theme {
  return store.get('theme') ?? 'light';
}

export function setTheme(theme: Theme): Theme {
  store.set('theme', theme);
  return theme;
}

export function getLanguageChoice(): LanguageChoice {
  return store.get('language') ?? 'auto';
}

export function setLanguageChoice(choice: LanguageChoice): LanguageChoice {
  store.set('language', choice);
  return choice;
}

export function resolveLocale(choice: LanguageChoice = getLanguageChoice()): ResolvedLocale {
  if (choice === 'fr') return 'fr';
  if (choice === 'en') return 'en';
  // 'auto' — prefer the OS-level locale (System Settings → Language & Region)
  // over Electron's getLocale, which can drift from the user's preferred
  // language when region/locale codes diverge (e.g. English language on a
  // French region setting).
  const sys = (app.getSystemLocale?.() || app.getLocale() || '').toLowerCase();
  return sys.startsWith('fr') ? 'fr' : 'en';
}

export function getAssemblyConfig(): AssemblyConfig {
  return { ...DEFAULT_ASSEMBLY_CONFIG, ...(store.get('assembly') ?? {}) };
}

export function setAssemblyConfig(partial: Partial<AssemblyConfig>): AssemblyConfig {
  const next = { ...getAssemblyConfig(), ...partial };
  store.set('assembly', next);
  return next;
}
