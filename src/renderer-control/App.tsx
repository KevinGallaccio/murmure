import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiKeyPanel } from './components/ApiKeyPanel';
import { DevicePicker } from './components/DevicePicker';
import { VuMeter } from './components/VuMeter';
import { DiffuseButton } from './components/DiffuseButton';
import { StyleControls } from './components/StyleControls';
import { Preview } from './components/Preview';
import { UsagePanel } from './components/UsagePanel';
import { Accordion } from './components/Accordion';
import { StatusDot } from './components/StatusDot';
import { useLocale } from './i18n';
import type {
  DisplayInfo,
  DisplayState,
  MockState,
  StreamErrorPayload,
  StreamState,
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
        test: () => Promise<{ ok: boolean; error?: string }>;
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
    };
  }
}

type LogLevel = 'info' | 'success' | 'error';
type LogEntry = { id: string; ts: number; level: LogLevel; message: string };
type ApiKeyStatus = 'unknown' | 'absent' | 'saved' | 'verified' | 'invalid';

const STORAGE_DEVICE_ID = 'diffuseur.deviceId';

export function App(): JSX.Element {
  const { t, locale, setLocale } = useLocale();

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
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('unknown');

  const captureRef = useRef<AudioCapture | null>(null);
  const streamStateRef = useRef<StreamState>('idle');
  const tRef = useRef(t);

  useEffect(() => {
    streamStateRef.current = streamState;
  }, [streamState]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const addLog = useCallback((level: LogLevel, message: string) => {
    setLog((prev) =>
      [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now(), level, message },
        ...prev,
      ].slice(0, 50),
    );
  }, []);

  // bootstrap
  useEffect(() => {
    void window.diffuseur.style.get().then(setStyle);
    void window.diffuseur.display.list().then(setDisplays);
    void window.diffuseur.apikey.status().then((r) => setHasKey(r.hasKey));

    const offState = window.diffuseur.stream.onState((s) => {
      setStreamState((prev) => {
        if (prev !== s) {
          const localized = tRef.current.state[s];
          addLog('info', tRef.current.journal.streamState(localized));
        }
        if (s === 'streaming') {
          setFinalLines([]);
        }
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

  useEffect(() => {
    const id = setInterval(() => void window.diffuseur.apikey.status().then((r) => setHasKey(r.hasKey)), 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (streamState === 'streaming' && usage) {
        setUsage((prev) => (prev ? { ...prev, sessionSeconds: prev.sessionSeconds + 1 } : prev));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [streamState]);

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
      addLog('error', tRef.current.journal.captureError((err as Error).message));
    }
  }

  async function stopCapture(): Promise<void> {
    if (captureRef.current) await captureRef.current.stop();
    setRms(0);
  }

  const onDeviceChange = useCallback((id: string | null) => {
    setDeviceIdState(id);
    if (id) window.localStorage.setItem(STORAGE_DEVICE_ID, id);
    else window.localStorage.removeItem(STORAGE_DEVICE_ID);
  }, []);

  const onPatchStyle = useCallback((patch: Partial<StyleSettings>) => {
    setStyle((prev) => ({ ...prev, ...patch }));
    void window.diffuseur.style.update(patch);
  }, []);

  const onResetStyle = useCallback(() => {
    void window.diffuseur.style.reset().then(setStyle);
  }, []);

  const onPreset = useCallback((id: StylePresetId) => {
    const next = STYLE_PRESETS[id].settings;
    setStyle(next);
    void window.diffuseur.style.update(next);
  }, []);

  const onDiffuse = useCallback(async () => {
    if (streamState === 'streaming' || streamState === 'connecting') {
      await window.diffuseur.stream.stop();
    } else {
      const r = await window.diffuseur.stream.start();
      if (!r.ok) addLog('error', r.error ?? tRef.current.journal.streamStartFailed);
    }
  }, [streamState, addLog]);

  const onOpenDisplay = useCallback(async () => {
    const secondary = displays.find((d) => !d.isPrimary);
    await window.diffuseur.display.open(secondary?.id);
  }, [displays]);

  const onCloseDisplay = useCallback(async () => {
    await window.diffuseur.display.close();
  }, []);

  const sessionTimer = useMemo(() => {
    if (!usage) return '00:00:00';
    return formatHms(usage.sessionSeconds);
  }, [usage]);

  const sessionCost = useMemo(() => {
    if (!usage) return '0.000';
    return ((usage.sessionSeconds / 3600) * usage.ratePerHour).toFixed(3);
  }, [usage]);

  const diffuseDisabled = !hasKey || !deviceId;

  const guard = !hasKey
    ? t.guards.noKey
    : !deviceId
      ? t.guards.noDevice
      : displays.length === 1 && !displayState.isOpen
        ? t.guards.singleScreen
        : null;

  const displayStatusLabel = !displayState.isOpen
    ? t.display.closed
    : displayState.isFullscreen
      ? t.display.fullscreen
      : t.display.open;

  const apiKeyBadge = useMemo(() => {
    if (apiKeyStatus === 'verified') return <StatusDot tone="ok" />;
    if (apiKeyStatus === 'invalid') return <StatusDot tone="err" />;
    if (apiKeyStatus === 'saved') return <StatusDot tone="warn" />;
    return <StatusDot tone="idle" />;
  }, [apiKeyStatus]);

  const sourceTone: 'idle' | 'warn' | 'ok' = !deviceId ? 'idle' : rms > 0.01 ? 'ok' : 'warn';
  const sourceBadge = <StatusDot tone={sourceTone} pulse={sourceTone === 'ok'} />;

  const journalBadge = useMemo(() => {
    if (log.length === 0) return null;
    const recentErrors = log.slice(0, 5).some((e) => e.level === 'error');
    return <span className={`count-badge ${recentErrors ? 'has-errors' : ''}`}>{log.length}</span>;
  }, [log]);

  const costsBadge = useMemo(() => {
    return <span className="cost-badge">${sessionCost}</span>;
  }, [sessionCost]);

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 100 100" aria-hidden="true">
            <rect x="0" y="0" width="100" height="100" rx="22" fill="#FAFAF7" />
            <circle cx="20" cy="50" r="5.5" fill="#2745CF" />
            <circle cx="34" cy="50" r="5.5" fill="#000000" />
            <circle cx="48" cy="50" r="5.5" fill="#000000" />
            <rect x="60.5" y="44.5" width="25" height="11" rx="5.5" fill="#000000" />
          </svg>
          <span className="brand-wordmark">murmure</span>
        </div>
        <div className="actions">
          <div
            className="lang-switch"
            role="group"
            aria-label={t.language.tooltip}
            title={t.language.tooltip}
          >
            <GlobeGlyph />
            <button
              type="button"
              className={`lang-opt ${locale === 'fr' ? 'active' : ''}`}
              onClick={() => setLocale('fr')}
              aria-pressed={locale === 'fr'}
              aria-label="Français"
            >
              {t.language.fr}
            </button>
            <span className="lang-sep" aria-hidden="true">·</span>
            <button
              type="button"
              className={`lang-opt ${locale === 'en' ? 'active' : ''}`}
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
              aria-label="English"
            >
              {t.language.en}
            </button>
          </div>
          <span className="version">v 1.0.4</span>
        </div>
      </header>

      <section className="hero" data-state={streamState}>
        <div className="hero-state">
          <div className="label">
            <span>{t.hero.stateLabel}</span>
          </div>
          <div className="value">
            <span className="live-dot" aria-hidden="true" />
            <span className="timer">{sessionTimer}</span>
          </div>
          <div className="meta">
            <span>{t.state[streamState]}</span>
            <span className="sep">·</span>
            <span className="cost">${sessionCost} {t.hero.sessionSuffix}</span>
          </div>
        </div>

        <div className="hero-action">
          <DiffuseButton state={streamState} disabled={diffuseDisabled} onClick={onDiffuse} />
        </div>

        <div className="hero-display">
          <div className="label">{t.display.label}</div>
          <div className="status">{displayStatusLabel}</div>
          {!displayState.isOpen ? (
            <button
              className="ghost"
              onClick={onOpenDisplay}
              disabled={displays.length === 0}
            >
              {t.display.openButton}
            </button>
          ) : (
            <button className="ghost" onClick={onCloseDisplay}>
              {t.display.closeButton}
            </button>
          )}
        </div>

        {guard && <div className="hero-guard">{guard}</div>}
      </section>

      <div className="workspace">
        <aside className="sidebar" aria-label={t.sidebar.caption}>
          <div className="sidebar-caption">{t.sidebar.caption}</div>
          <Accordion
            id="config"
            number="01"
            title={t.sidebar.sections.config}
            badge={apiKeyBadge}
            defaultOpen={!hasKey}
          >
            <ApiKeyPanel onStatusChange={setApiKeyStatus} />
          </Accordion>

          <Accordion
            id="source"
            number="02"
            title={t.sidebar.sections.source}
            badge={sourceBadge}
            defaultOpen={true}
          >
            <DevicePicker
              selectedDeviceId={deviceId}
              onChange={onDeviceChange}
              disabled={streamState === 'streaming' || streamState === 'connecting'}
            />
            <VuMeter rms={rms} active={!!deviceId} />
          </Accordion>

          <Accordion
            id="journal"
            number="03"
            title={t.sidebar.sections.journal}
            badge={journalBadge}
            defaultOpen={false}
          >
            <div className="log">
              {log.length === 0 && <span className="log-empty">{t.journal.empty}</span>}
              {log.map((e) => (
                <div key={e.id} className={`log-entry ${e.level}`}>
                  <span className="ts">
                    {new Date(e.ts).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                  </span>
                  <span className="msg">{e.message}</span>
                </div>
              ))}
            </div>
          </Accordion>

          <Accordion
            id="costs"
            number="04"
            title={t.sidebar.sections.costs}
            badge={costsBadge}
            defaultOpen={false}
          >
            <UsagePanel
              usage={usage}
              onResetUsage={() => void window.diffuseur.usage.reset()}
              onSetRate={(r) => void window.diffuseur.usage.setRate(r)}
              onOpenDashboard={() => void window.diffuseur.usage.openDashboard()}
            />
          </Accordion>
        </aside>

        <main className="main" aria-label={t.preview.title}>
          <Preview
            style={style}
            finalLines={finalLines}
            partial={partial}
            demoActive={mockEnabled && streamState !== 'streaming'}
            streaming={streamState === 'streaming'}
          />
        </main>

        <aside className="inspector" aria-label={t.apparence.title}>
          <StyleControls
            sectionNumber="05"
            style={style}
            onPatch={onPatchStyle}
            onReset={onResetStyle}
            onPreset={onPreset}
          />
        </aside>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function GlobeGlyph(): JSX.Element {
  return (
    <svg
      className="globe"
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.5" />
      <path d="M1.5 7h11" />
      <path d="M7 1.5c1.7 1.5 2.6 3.4 2.6 5.5s-.9 4-2.6 5.5C5.3 11 4.4 9.1 4.4 7s.9-4 2.6-5.5z" />
    </svg>
  );
}

function formatHms(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => n.toString().padStart(2, '0')).join(':');
}
