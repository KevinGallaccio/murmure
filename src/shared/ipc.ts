import type { StyleSettings } from './style';

export type StreamState = 'idle' | 'connecting' | 'streaming' | 'error';

export type TranscriptPartial = { text: string; turnId: string };
export type TranscriptFinal = { text: string; turnId: string; timestamp: number };

export type StreamErrorPayload = { code?: string; message: string };

export type UsageUpdate = {
  sessionSeconds: number;
  totalSeconds: number;
  estimatedCost: number;
  ratePerHour: number;
  sessionCount: number;
  resetAt: string;
};

export type DisplayInfo = {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
};

export type ApiKeyStatus = { hasKey: boolean };

export type ApiKeyTestResult = { ok: boolean; error?: string };

export const IPC = {
  ApiKeySave: 'apikey:save',
  ApiKeyTest: 'apikey:test',
  ApiKeyClear: 'apikey:clear',
  ApiKeyStatus: 'apikey:status',

  StreamStart: 'stream:start',
  StreamStop: 'stream:stop',
  StreamState: 'stream:state',
  StreamError: 'stream:error',

  AudioChunk: 'audio:chunk',

  TranscriptPartial: 'transcript:partial',
  TranscriptFinal: 'transcript:final',

  StyleUpdate: 'style:update',
  StyleReset: 'style:reset',
  StyleApply: 'style:apply',
  StyleGet: 'style:get',

  DisplayList: 'display:list',
  DisplayOpen: 'display:open',
  DisplayClose: 'display:close',
  DisplayState: 'display:state',
  DisplayChanged: 'display:changed',

  MockSetEnabled: 'mock:set-enabled',
  MockState: 'mock:state',

  UsageReset: 'usage:reset',
  UsageGetRate: 'usage:get-rate',
  UsageSetRate: 'usage:set-rate',
  UsageUpdate: 'usage:update',
  UsageOpenDashboard: 'usage:open-dashboard',

  // Theme & language are persisted in electron-store so both the renderer
  // and the main process (menu / dialogs) can read them.
  ThemeGet: 'theme:get',
  ThemeSet: 'theme:set',
  ThemeChanged: 'theme:changed',

  LanguageGet: 'language:get',
  LanguageSet: 'language:set',
  LanguageChanged: 'language:changed',

  // Main → renderer: instructs the operator UI to switch to a specific
  // tab (e.g. when the user clicks "Settings…" in the native menu).
  TabNavigate: 'tab:navigate',
} as const;

export type StyleUpdate = Partial<StyleSettings>;

export type DisplayState = {
  isOpen: boolean;
  displayId: number | null;
  isFullscreen: boolean;
};

export type MockState = { enabled: boolean };

export type Theme = 'light' | 'dark';
export type LanguageChoice = 'en' | 'fr' | 'auto';
export type ResolvedLocale = 'en' | 'fr';
export type Tab = 'stage' | 'appearance' | 'setup';

export type LanguageState = {
  choice: LanguageChoice;
  resolved: ResolvedLocale;
};
