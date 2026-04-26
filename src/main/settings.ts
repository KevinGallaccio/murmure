import Store from 'electron-store';
import { app, safeStorage } from 'electron';
import { DEFAULT_STYLE, type StyleSettings } from '../shared/style';
import {
  ASSEMBLY_DEFAULT_RATE_PER_HOUR,
  SPEECHMATICS_DEFAULT_RATE_PER_HOUR,
} from '../shared/constants';
import type {
  LanguageChoice,
  Provider,
  ResolvedLocale,
  Theme,
  TranscriptionLanguage,
} from '../shared/ipc';

export type SessionRecord = {
  startedAt: string;
  endedAt: string;
  seconds: number;
};

type EncryptedKey = { ciphertext: string };
type ApiKeys = Partial<Record<Provider, EncryptedKey>>;

type PerProviderRate = Partial<Record<Provider, number>>;

export type PersistedState = {
  // Legacy single-key field. Migrated into `apiKeys.assemblyai` on first boot
  // of a build that knows about per-provider keys, then nulled out. Kept in
  // the type so existing stores with this field still type-check.
  apiKey?: EncryptedKey | null;
  apiKeys: ApiKeys;
  provider: Provider;
  // Language spoken by the people being transcribed. Defaults to French
  // (this app shipped first as a French podcast festival tool) but the
  // operator can switch in Setup. Both providers receive this in their
  // session config — AssemblyAI as a query param, Speechmatics as a field
  // in StartRecognition.
  transcriptionLanguage: TranscriptionLanguage;
  selectedDeviceId: string | null;
  style: StyleSettings;
  theme: Theme;
  language: LanguageChoice;
  usage: {
    totalSeconds: number;
    sessions: SessionRecord[];
    // Per-provider rate so flipping the provider seg-control reflects the
    // right $/hour without clobbering the user's customization for the other
    // provider. Older builds wrote a single `ratePerHour: number` here; the
    // migrateUsageRate() pass below upgrades it on first boot.
    ratePerHour: PerProviderRate | number;
    resetAt: string;
  };
};

const initialState: PersistedState = {
  apiKey: null,
  apiKeys: {},
  // Default the first-launch experience to Speechmatics (better at continuous
  // speech, cheaper, has a free tier). Legacy installs that already had a key
  // get pinned to AssemblyAI by migrateApiKeys() below.
  provider: 'speechmatics',
  transcriptionLanguage: 'fr',
  selectedDeviceId: null,
  style: DEFAULT_STYLE,
  theme: 'light',
  language: 'auto',
  usage: {
    totalSeconds: 0,
    sessions: [],
    ratePerHour: {
      assemblyai: ASSEMBLY_DEFAULT_RATE_PER_HOUR,
      speechmatics: SPEECHMATICS_DEFAULT_RATE_PER_HOUR,
    },
    resetAt: new Date().toISOString(),
  },
};

const store = new Store<PersistedState>({
  name: 'murmure',
  defaults: initialState,
});

const cachedKeys: Partial<Record<Provider, string>> = {};

migrateApiKeys();
migrateUsageRate();

function migrateUsageRate(): void {
  // v1.1.x stored a single number; this migration upgrades it to a per-
  // provider record, treating the legacy value as the AssemblyAI rate (the
  // only provider those builds knew about). Speechmatics gets its default.
  const usage = store.get('usage');
  if (!usage) return;
  const rate = usage.ratePerHour as PerProviderRate | number | undefined;
  if (rate === undefined || typeof rate === 'number') {
    const legacyAssembly = typeof rate === 'number' ? rate : ASSEMBLY_DEFAULT_RATE_PER_HOUR;
    store.set('usage', {
      ...usage,
      ratePerHour: {
        assemblyai: legacyAssembly,
        speechmatics: SPEECHMATICS_DEFAULT_RATE_PER_HOUR,
      },
    });
  }
}

function migrateApiKeys(): void {
  const apiKeys = store.get('apiKeys') as ApiKeys | undefined;
  const legacy = store.get('apiKey') as EncryptedKey | null | undefined;
  if (apiKeys && Object.keys(apiKeys).length > 0) {
    // already migrated
    if (legacy) store.set('apiKey', null);
    return;
  }
  if (legacy && legacy.ciphertext) {
    // Pre-Speechmatics installs only had an AssemblyAI key. Move it under
    // apiKeys.assemblyai and pin the provider to AssemblyAI so the user
    // doesn't see "no key saved" after upgrade.
    store.set('apiKeys', { assemblyai: legacy });
    store.set('provider', 'assemblyai');
    store.set('apiKey', null);
  } else {
    // Fresh install — keep the Speechmatics default.
    store.set('apiKeys', {});
  }
}

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

export function saveApiKey(provider: Provider, plaintext: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Le système de chiffrement n'est pas disponible sur cette machine.");
  }
  const ciphertext = safeStorage.encryptString(plaintext).toString('base64');
  const apiKeys = { ...(store.get('apiKeys') ?? {}) } as ApiKeys;
  apiKeys[provider] = { ciphertext };
  store.set('apiKeys', apiKeys);
  cachedKeys[provider] = plaintext;
}

export function clearApiKey(provider: Provider): void {
  const apiKeys = { ...(store.get('apiKeys') ?? {}) } as ApiKeys;
  delete apiKeys[provider];
  store.set('apiKeys', apiKeys);
  delete cachedKeys[provider];
}

export function hasApiKey(provider: Provider): boolean {
  const apiKeys = store.get('apiKeys') ?? {};
  return Boolean(apiKeys[provider]);
}

export function getApiKey(provider: Provider): string | null {
  const cached = cachedKeys[provider];
  if (cached !== undefined) return cached;
  const apiKeys = store.get('apiKeys') ?? {};
  const stored = apiKeys[provider];
  if (!stored) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const plaintext = safeStorage.decryptString(Buffer.from(stored.ciphertext, 'base64'));
    cachedKeys[provider] = plaintext;
    return plaintext;
  } catch {
    return null;
  }
}

export function getProvider(): Provider {
  return (store.get('provider') as Provider | undefined) ?? 'speechmatics';
}

export function setProvider(provider: Provider): Provider {
  store.set('provider', provider);
  return provider;
}

export function getTranscriptionLanguage(): TranscriptionLanguage {
  return (store.get('transcriptionLanguage') as TranscriptionLanguage | undefined) ?? 'fr';
}

export function setTranscriptionLanguage(lang: TranscriptionLanguage): TranscriptionLanguage {
  store.set('transcriptionLanguage', lang);
  return lang;
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

function defaultRateFor(provider: Provider): number {
  return provider === 'speechmatics'
    ? SPEECHMATICS_DEFAULT_RATE_PER_HOUR
    : ASSEMBLY_DEFAULT_RATE_PER_HOUR;
}

function ratesFromUsage(usage: PersistedState['usage']): PerProviderRate {
  // After migration this is always an object, but keep the number-fallback
  // for safety in case migration didn't run for any reason.
  const r = usage.ratePerHour;
  if (typeof r === 'number') {
    return { assemblyai: r, speechmatics: SPEECHMATICS_DEFAULT_RATE_PER_HOUR };
  }
  return r;
}

export function getRatePerHour(provider: Provider = getProvider()): number {
  const rates = ratesFromUsage(getUsage());
  return rates[provider] ?? defaultRateFor(provider);
}

export function setRatePerHour(rate: number, provider: Provider = getProvider()): PersistedState['usage'] {
  const usage = getUsage();
  const rates = { ...ratesFromUsage(usage) };
  rates[provider] = rate;
  const next = { ...usage, ratePerHour: rates };
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
