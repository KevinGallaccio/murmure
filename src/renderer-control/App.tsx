import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { StagePage } from './components/StagePage';
import { AppearancePage } from './components/AppearancePage';
import { SetupPage, type LogEntry } from './components/SetupPage';
import { useLocale } from './i18n';
import type {
  ApiKeyTestResult,
  AssemblyConfigPayload,
  DisplayInfo,
  DisplayState,
  LanguageChoice,
  MockState,
  StreamErrorPayload,
  StreamState,
  Tab,
  Theme,
  TranscriptFinal,
  TranscriptPartial,
  UsageUpdate,
} from '../shared/ipc';
import type { StyleSettings } from '../shared/style';
import { DEFAULT_STYLE, STYLE_PRESETS, type StylePresetId } from '../shared/style';
import { AudioCapture } from './audio/capture';

declare global {
  interface Window {
    diffuseur: {
      apikey: {
        status: () => Promise<{ hasKey: boolean }>;
        save: (plaintext: string) => Promise<{ hasKey: boolean }>;
        clear: () => Promise<{ hasKey: boolean }>;
        test: () => Promise<ApiKeyTestResult>;
      };
      stream: {
        start: () => Promise<{ ok: boolean; error?: string }>;
        stop: () => Promise<{ ok: boolean }>;
        sendAudioChunk: (buffer: ArrayBuffer) => void;
        onState: (cb: (s: StreamState) => void) => () => void;
        onError: (cb: (e: StreamErrorPayload) => void) => () => void;
        onFinal: (cb: (t: TranscriptFinal) => void) => () => void;
        onPartial: (cb: (t: TranscriptPartial) => void) => () => void;
      };
      style: {
        get: () => Promise<StyleSettings>;
        update: (partial: Partial<StyleSettings>) => Promise<StyleSettings>;
        reset: () => Promise<StyleSettings>;
        onApply: (cb: (s: StyleSettings) => void) => () => void;
      };
      display: {
        list: () => Promise<DisplayInfo[]>;
        open: (displayId?: number) => Promise<DisplayState>;
        close: () => Promise<DisplayState>;
        onState: (cb: (s: DisplayState) => void) => () => void;
        onChanged: (
          cb: (e: { kind: 'added' | 'removed'; displays: DisplayInfo[] }) => void,
        ) => () => void;
      };
      mock: {
        setEnabled: (enabled: boolean) => Promise<MockState>;
        onState: (cb: (s: MockState) => void) => () => void;
      };
      usage: {
        onUpdate: (cb: (u: UsageUpdate) => void) => () => void;
        reset: () => Promise<UsageUpdate>;
        setRate: (rate: number) => Promise<UsageUpdate>;
        openDashboard: () => Promise<{ ok: boolean }>;
      };
      theme: {
        get: () => Promise<Theme>;
        set: (theme: Theme) => Promise<Theme>;
        onChange: (cb: (t: Theme) => void) => () => void;
      };
      language: {
        get: () => Promise<{ choice: LanguageChoice; resolved: 'fr' | 'en' }>;
        set: (choice: LanguageChoice) => Promise<{ choice: LanguageChoice; resolved: 'fr' | 'en' }>;
        onChange: (cb: (s: { choice: LanguageChoice; resolved: 'fr' | 'en' }) => void) => () => void;
      };
      tab: {
        onNavigate: (cb: (t: Tab) => void) => () => void;
      };
      assembly: {
        get: () => Promise<AssemblyConfigPayload>;
        set: (cfg: AssemblyConfigPayload) => Promise<AssemblyConfigPayload>;
        onChange: (cb: (cfg: AssemblyConfigPayload) => void) => () => void;
      };
    };
  }
}

const STORAGE_DEVICE_ID = 'diffuseur.deviceId';
const STORAGE_TAB = 'murmure.tab';

export function App(): JSX.Element {
  const { choice: language, setChoice: setLanguage, cycle: cycleLanguage } = useLocale();

  const [tab, setTabState] = useState<Tab>(() => {
    const stored = window.sessionStorage.getItem(STORAGE_TAB);
    return stored === 'appearance' || stored === 'setup' ? stored : 'stage';
  });

  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    try {
      window.sessionStorage.setItem(STORAGE_TAB, next);
    } catch {
      /* ignore */
    }
  }, []);

  const [theme, setThemeState] = useState<Theme>('light');
  useEffect(() => {
    void window.diffuseur.theme.get().then((t) => setThemeState(t));
    const off = window.diffuseur.theme.onChange((t) => setThemeState(t));
    return off;
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const setTheme = useCallback((t: Theme) => {
    void window.diffuseur.theme.set(t);
  }, []);

  // Listen for menu-driven tab navigation
  useEffect(() => {
    const off = window.diffuseur.tab.onNavigate((next) => setTab(next));
    return off;
  }, [setTab]);

  // Keyboard shortcuts: ⌘1/2/3 fallback in case the menu accelerator misses
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '1') {
        setTab('stage');
        e.preventDefault();
      } else if (e.key === '2') {
        setTab('appearance');
        e.preventDefault();
      } else if (e.key === '3') {
        setTab('setup');
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTab]);

  /* ------- App state ---------- */

  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [usage, setUsage] = useState<UsageUpdate | null>(null);
  const [style, setStyle] = useState<StyleSettings>(DEFAULT_STYLE);
  const [displayState, setDisplayState] = useState<DisplayState>({
    isOpen: false,
    displayId: null,
    isFullscreen: false,
  });
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [mockEnabled, setMockEnabled] = useState(true);
  const [deviceId, setDeviceIdState] = useState<string | null>(
    () => window.localStorage.getItem(STORAGE_DEVICE_ID),
  );
  const [rms, setRms] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [finalLines, setFinalLines] = useState<string[]>([]);
  const [partial, setPartial] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [assemblyConfig, setAssemblyConfigState] = useState<AssemblyConfigPayload>({
    forceEndpointMs: 5000,
  });

  useEffect(() => {
    void window.diffuseur.assembly.get().then(setAssemblyConfigState);
    const off = window.diffuseur.assembly.onChange(setAssemblyConfigState);
    return off;
  }, []);

  const onAssemblyConfigChange = useCallback((cfg: AssemblyConfigPayload) => {
    setAssemblyConfigState(cfg);
    void window.diffuseur.assembly.set(cfg);
  }, []);

  const captureRef = useRef<AudioCapture | null>(null);
  const streamStateRef = useRef<StreamState>('idle');
  const tRef = useRef(useLocale().t);

  useEffect(() => {
    streamStateRef.current = streamState;
  }, [streamState]);

  // Keep the latest translations reachable from non-React effect callbacks
  const localeCtx = useLocale();
  useEffect(() => {
    tRef.current = localeCtx.t;
  }, [localeCtx.t]);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLog((prev) =>
      [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now(), level, message },
        ...prev,
      ].slice(0, 50),
    );
  }, []);

  /* ------- Bootstrap subscriptions ---------- */

  useEffect(() => {
    void window.diffuseur.style.get().then(setStyle);
    void window.diffuseur.display.list().then(setDisplays);
    void window.diffuseur.apikey.status().then((r) => setHasKey(r.hasKey));

    const offState = window.diffuseur.stream.onState((s) => {
      setStreamState((prev) => {
        if (prev !== s) {
          const localized = tRef.current.state[s];
          addLog('info', tRef.current.log.streamState(localized));
        }
        if (s === 'streaming') setFinalLines([]);
        return s;
      });
    });
    const offErr = window.diffuseur.stream.onError((e) => addLog('error', e.message));
    const offFinal = window.diffuseur.stream.onFinal((tx) => {
      setFinalLines((prev) => [...prev, tx.text].slice(-style.maxLines * 2));
      setPartial(null);
    });
    const offPartial = window.diffuseur.stream.onPartial((tx) => setPartial(tx.text));
    const offStyle = window.diffuseur.style.onApply((s) => setStyle(s));
    const offDisplay = window.diffuseur.display.onState(setDisplayState);
    const offDispChange = window.diffuseur.display.onChanged((e) => {
      setDisplays(e.displays);
      const msg = e.kind === 'added' ? tRef.current.toast.newScreen : tRef.current.toast.screenLost;
      setToast(msg);
      setTimeout(() => setToast(null), 6000);
    });
    const offMock = window.diffuseur.mock.onState((s) => setMockEnabled(s.enabled));
    const offUsage = window.diffuseur.usage.onUpdate(setUsage);
    return () => {
      offState();
      offErr();
      offFinal();
      offPartial();
      offStyle();
      offDisplay();
      offDispChange();
      offMock();
      offUsage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll API key status (in case ApiKeyForm changes it)
  useEffect(() => {
    const id = setInterval(() => {
      void window.diffuseur.apikey.status().then((r) => setHasKey(r.hasKey));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Session timer (1Hz tick for the visible counter)
  useEffect(() => {
    const id = setInterval(() => {
      if (streamState === 'streaming' && usage) {
        setUsage((prev) => (prev ? { ...prev, sessionSeconds: prev.sessionSeconds + 1 } : prev));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [streamState]);

  /* ------- Audio capture lifecycle ---------- */

  useEffect(() => {
    if (deviceId) {
      void startCapture();
    } else {
      void stopCapture();
    }
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  async function startCapture(): Promise<void> {
    if (!captureRef.current) {
      captureRef.current = new AudioCapture({
        onChunk: (buf) => {
          if (streamStateRef.current === 'streaming') {
            window.diffuseur.stream.sendAudioChunk(buf);
          }
        },
        onRms: (v) => setRms(v),
        onError: (err) => addLog('error', err.message),
      });
    }
    if (captureRef.current.isRunning() && captureRef.current.currentDeviceId() === deviceId) return;
    try {
      await captureRef.current.start(deviceId);
    } catch (err) {
      addLog('error', tRef.current.log.captureError((err as Error).message));
    }
  }

  async function stopCapture(): Promise<void> {
    if (captureRef.current) await captureRef.current.stop();
    setRms(0);
  }

  /* ------- Action handlers ---------- */

  const onDeviceChange = useCallback((id: string | null) => {
    setDeviceIdState(id);
    if (id) window.localStorage.setItem(STORAGE_DEVICE_ID, id);
    else window.localStorage.removeItem(STORAGE_DEVICE_ID);
  }, []);

  const onPatchStyle = useCallback((patch: Partial<StyleSettings>) => {
    setStyle((prev) => ({ ...prev, ...patch }));
    void window.diffuseur.style.update(patch);
  }, []);

  const onPreset = useCallback((id: StylePresetId) => {
    const next = STYLE_PRESETS[id].settings;
    setStyle(next);
    void window.diffuseur.style.update(next);
  }, []);

  const onResetStyle = useCallback(() => {
    void window.diffuseur.style.reset().then(setStyle);
  }, []);

  const onBroadcastToggle = useCallback(async () => {
    if (streamState === 'streaming' || streamState === 'connecting') {
      await window.diffuseur.stream.stop();
    } else {
      const r = await window.diffuseur.stream.start();
      if (!r.ok) addLog('error', r.error ?? tRef.current.log.streamStartFailed);
    }
  }, [streamState, addLog]);

  const onDisplayToggle = useCallback(async () => {
    if (displayState.isOpen) {
      await window.diffuseur.display.close();
    } else {
      const secondary = displays.find((d) => !d.isPrimary);
      await window.diffuseur.display.open(secondary?.id);
    }
  }, [displayState.isOpen, displays]);

  const onClearLog = useCallback(() => setLog([]), []);

  /* ------- Derived state ---------- */

  const sessionTimer = useMemo(() => {
    if (!usage) return '00:00:00';
    return formatHms(usage.sessionSeconds);
  }, [usage]);

  const sessionCost = useMemo(() => {
    if (!usage) return '0.000';
    return ((usage.sessionSeconds / 3600) * usage.ratePerHour).toFixed(3);
  }, [usage]);

  const ratePerHour = usage?.ratePerHour ?? 0.45;
  const hasMic = !!deviceId;

  /* ------- Render ---------- */

  // Suppress unused-warning lint (mockEnabled is read by display window via IPC)
  void mockEnabled;

  return (
    <div className="app">
      <div className="body">
        <Sidebar
          tab={tab}
          setTab={setTab}
          streamState={streamState}
          hasKey={hasKey}
          hasMic={hasMic}
          displayOpen={displayState.isOpen}
          language={language}
          cycleLanguage={cycleLanguage}
          theme={theme}
          setTheme={setTheme}
        />

        <main className="main">
          {tab === 'stage' && (
            <StagePage
              streamState={streamState}
              hasKey={hasKey}
              hasMic={hasMic}
              displayOpen={displayState.isOpen}
              displayFullscreen={displayState.isFullscreen}
              sessionTimer={sessionTimer}
              sessionCost={sessionCost}
              ratePerHour={ratePerHour}
              finalLines={finalLines}
              partial={partial}
              appearance={style}
              onBroadcastToggle={onBroadcastToggle}
              onDisplayToggle={onDisplayToggle}
              onGoToSetup={() => setTab('setup')}
            />
          )}
          {tab === 'appearance' && (
            <AppearancePage
              appearance={style}
              onPatch={onPatchStyle}
              onPreset={onPreset}
              onReset={onResetStyle}
            />
          )}
          {tab === 'setup' && (
            <SetupPage
              language={language}
              setLanguage={setLanguage}
              usage={usage}
              rms={rms}
              selectedDeviceId={deviceId}
              onDeviceChange={onDeviceChange}
              deviceDisabled={streamState === 'streaming' || streamState === 'connecting'}
              log={log}
              onClearLog={onClearLog}
              onResetUsage={() => void window.diffuseur.usage.reset()}
              onSetRate={(r) => void window.diffuseur.usage.setRate(r)}
              onOpenDashboard={() => void window.diffuseur.usage.openDashboard()}
              onApiKeyStatusChange={() => {
                /* status surfaced inline within ApiKeyForm; not yet promoted to sidebar badge */
              }}
              assemblyConfig={assemblyConfig}
              onAssemblyConfigChange={onAssemblyConfigChange}
            />
          )}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function formatHms(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => n.toString().padStart(2, '0')).join(':');
}
