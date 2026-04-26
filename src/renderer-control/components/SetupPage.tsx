import { useEffect, useState, type ReactNode } from 'react';
import type { LanguageChoice, UsageUpdate } from '../../shared/ipc';
import { useT } from '../i18n';
import { IconCheck, IconExternal, IconEye, IconEyeOff, IconRefresh } from './Icons';

type LogLevel = 'info' | 'success' | 'error';
export type LogEntry = { id: string; ts: number; level: LogLevel; message: string };

type ApiKeyStatus = 'unknown' | 'absent' | 'saved' | 'verified' | 'invalid';

type Props = {
  language: LanguageChoice;
  setLanguage: (l: LanguageChoice) => void;
  usage: UsageUpdate | null;
  rms: number;
  selectedDeviceId: string | null;
  onDeviceChange: (id: string | null) => void;
  deviceDisabled: boolean;
  log: LogEntry[];
  onClearLog: () => void;
  onResetUsage: () => void;
  onSetRate: (rate: number) => void;
  onOpenDashboard: () => void;
  onApiKeyStatusChange: (status: ApiKeyStatus) => void;
};

export function SetupPage({
  language,
  setLanguage,
  usage,
  rms,
  selectedDeviceId,
  onDeviceChange,
  deviceDisabled,
  log,
  onClearLog,
  onResetUsage,
  onSetRate,
  onOpenDashboard,
  onApiKeyStatusChange,
}: Props): JSX.Element {
  const t = useT();

  return (
    <div className="page">
      <div className="page-head">
        <div className="eyebrow">{t.setup.eyebrow}</div>
        <h1 className="page-title">
          {t.setup.titleA}
          <em>{t.setup.titleEm}</em>
          {t.setup.titleB}
        </h1>
        <p className="page-sub">{t.setup.sub}</p>
      </div>

      <div className="setup-grid">
        {/* Language */}
        <div className="card full">
          <div className="setup-row">
            <div>
              <h3 className="card-title">{t.setup.languageTitle}</h3>
              <p className="card-sub" style={{ margin: 0 }}>
                {t.setup.languageSub}
              </p>
            </div>
            <div className="right">
              <div className="seg">
                {(
                  [
                    { v: 'en' as const, label: t.setup.languageEnglish },
                    { v: 'fr' as const, label: t.setup.languageFrench },
                    { v: 'auto' as const, label: t.setup.languageAuto },
                  ]
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    className={language === o.v ? 'active' : ''}
                    onClick={() => setLanguage(o.v)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AssemblyAI key */}
        <div className="card full">
          <div className="setup-row top">
            <div>
              <h3 className="card-title">{t.setup.keyTitle}</h3>
              <p className="card-sub">{t.setup.keySub}</p>
            </div>
            <ApiKeyForm onStatusChange={onApiKeyStatusChange} />
          </div>
        </div>

        {/* Audio source */}
        <div className="card">
          <h3 className="card-title">{t.setup.audioTitle}</h3>
          <p className="card-sub">{t.setup.audioSub}</p>

          <DevicePickerControl
            selectedDeviceId={selectedDeviceId}
            onChange={onDeviceChange}
            disabled={deviceDisabled}
          />

          <Field label={t.setup.levelLabel} style={{ marginTop: 16 }}>
            <VuMeter level={rms} />
          </Field>
        </div>

        {/* Costs */}
        <div className="card">
          <h3 className="card-title">{t.setup.costsTitle}</h3>
          <p className="card-sub">{t.setup.costsSub}</p>

          <CostsBlock usage={usage} onSetRate={onSetRate} onOpenDashboard={onOpenDashboard} onResetUsage={onResetUsage} />
        </div>

        {/* Activity log */}
        <div className="card full">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h3 className="card-title">{t.setup.logTitle}</h3>
              <p className="card-sub" style={{ margin: 0 }}>
                {t.setup.logSub}
              </p>
            </div>
            <button type="button" className="btn ghost" onClick={onClearLog}>
              <IconRefresh size={12} />
              {t.setup.logClear}
            </button>
          </div>

          <div className="log-list" style={{ marginTop: 12 }}>
            {log.length === 0 && (
              <div className="log-line" style={{ borderBottom: 0 }}>
                <span className="t" />
                <span className="lvl info">—</span>
                <span style={{ color: 'var(--ink-4)' }}>{t.setup.logEmpty}</span>
              </div>
            )}
            {log.map((e) => (
              <div key={e.id} className="log-line">
                <span className="t">{new Date(e.ts).toLocaleTimeString(undefined, { hour12: false })}</span>
                <span className={`lvl ${e.level === 'success' ? 'ok' : e.level}`}>
                  {e.level === 'success' ? 'ok' : e.level}
                </span>
                <span>{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <div className="field" style={style}>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function ApiKeyForm({
  onStatusChange,
}: {
  onStatusChange: (status: ApiKeyStatus) => void;
}): JSX.Element {
  const t = useT();
  const [hasKey, setHasKey] = useState(false);
  const [status, setStatus] = useState<ApiKeyStatus>('unknown');
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void window.diffuseur.apikey.status().then((r) => {
      setHasKey(r.hasKey);
      setStatus(r.hasKey ? 'saved' : 'absent');
    });
  }, []);

  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  async function save(): Promise<void> {
    if (!draft.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const r = await window.diffuseur.apikey.save(draft.trim());
      setHasKey(r.hasKey);
      setStatus('saved');
      setDraft('');
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clear(): Promise<void> {
    setSaving(true);
    setErrorMessage(null);
    const r = await window.diffuseur.apikey.clear();
    setHasKey(r.hasKey);
    setStatus('absent');
    setSaving(false);
  }

  async function test(): Promise<void> {
    setTesting(true);
    setErrorMessage(null);
    const r = await window.diffuseur.apikey.test();
    if (r.ok) setStatus('verified');
    else {
      setStatus('invalid');
      setErrorMessage(r.error ?? null);
    }
    setTesting(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="key-row">
        <div className="key-input-wrap">
          <input
            className="input mono"
            type={showKey ? 'text' : 'password'}
            placeholder={t.setup.keyPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            className="eye"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={save}
          disabled={!draft.trim() || saving}
        >
          {t.setup.save}
        </button>
        {hasKey ? (
          <button type="button" className="btn" onClick={test} disabled={testing}>
            {testing ? t.setup.testing : t.setup.test}
          </button>
        ) : (
          <button type="button" className="btn" onClick={test} disabled>
            {t.setup.test}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {status === 'verified' ? (
          <span className="status-line ok">
            <IconCheck size={12} />
            {t.setup.keyValid}
          </span>
        ) : status === 'invalid' ? (
          <span className="status-line err">{errorMessage ?? t.setup.keyInvalid}</span>
        ) : status === 'saved' ? (
          <span className="status-line ok">
            <IconCheck size={12} />
            {t.setup.keyValid}
          </span>
        ) : (
          <span className="status-line">
            <span className="dot idle" /> {t.setup.keyAbsent}
          </span>
        )}
        {hasKey && (
          <button type="button" className="btn ghost danger" onClick={clear} disabled={saving}>
            {t.setup.clear}
          </button>
        )}
      </div>
    </div>
  );
}

function DevicePickerControl({
  selectedDeviceId,
  onChange,
  disabled,
}: {
  selectedDeviceId: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}): JSX.Element {
  const t = useT();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh(): Promise<void> {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        probe.getTracks().forEach((tr) => tr.stop());
      } catch (err) {
        setPermissionError((err as Error).message ?? t.setup.permissionDenied);
        return;
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      const inputs = all.filter((d) => d.kind === 'audioinput');
      setDevices(inputs);
      if (selectedDeviceId && !inputs.find((d) => d.deviceId === selectedDeviceId)) {
        onChange(null);
      } else if (!selectedDeviceId && inputs.length > 0) {
        onChange(inputs[0].deviceId);
      }
    }
    void refresh();
    const onDevChange = () => void refresh();
    navigator.mediaDevices.addEventListener('devicechange', onDevChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', onDevChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Field label={t.setup.deviceLabel}>
      <select
        className="select"
        value={selectedDeviceId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
      >
        {devices.length === 0 && <option value="">{t.setup.deviceNone}</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone (${d.deviceId.slice(0, 6)})`}
          </option>
        ))}
      </select>
      {permissionError && (
        <span className="status-line err" style={{ marginTop: 6 }}>
          {permissionError}
        </span>
      )}
    </Field>
  );
}

function VuMeter({ level }: { level: number }): JSX.Element {
  // Apply same log scaling as the old meter so visuals match at low signal levels.
  const normalized = Math.max(0, Math.min(1, Math.log10(1 + level * 50) / Math.log10(51)));
  const bars = 32;
  const items: JSX.Element[] = [];
  for (let i = 0; i < bars; i++) {
    const lit = i / bars < normalized;
    const color = i < bars * 0.6 ? '#15803D' : i < bars * 0.85 ? '#C2A015' : '#C2410C';
    items.push(
      <div
        key={i}
        className="vu-bar"
        style={{ background: lit ? color : 'transparent' }}
      />,
    );
  }
  return (
    <>
      <div className="vu" aria-label="Input level">
        {items}
      </div>
      <div className="vu-scale">
        <span>−∞</span>
        <span>−24</span>
        <span>−12</span>
        <span>−6</span>
        <span>0 dB</span>
      </div>
    </>
  );
}

function CostsBlock({
  usage,
  onSetRate,
  onOpenDashboard,
  onResetUsage,
}: {
  usage: UsageUpdate | null;
  onSetRate: (r: number) => void;
  onOpenDashboard: () => void;
  onResetUsage: () => void;
}): JSX.Element {
  const t = useT();
  const [rateDraft, setRateDraft] = useState<string>(() => usage?.ratePerHour.toFixed(2) ?? '0.45');

  const sessionSpend = usage ? (usage.sessionSeconds / 3600) * usage.ratePerHour : 0;
  const totalSpend = usage?.estimatedCost ?? 0;
  const totalHours = usage ? usage.totalSeconds / 3600 : 0;
  const sessionMinutes = usage ? Math.floor(usage.sessionSeconds / 60) : 0;
  const sessionSecs = usage ? Math.floor(usage.sessionSeconds % 60) : 0;

  return (
    <>
      <div className="cost-grid">
        <div className="cost-card">
          <div className="cost-label">{t.setup.sessionLabel}</div>
          <div className="cost-value">${sessionSpend.toFixed(3)}</div>
          <div className="cost-meta">
            {t.setup.elapsed(sessionMinutes, sessionSecs.toString().padStart(2, '0'))}
          </div>
        </div>
        <div className="cost-card">
          <div className="cost-label">{t.setup.cumulLabel}</div>
          <div className="cost-value">${totalSpend.toFixed(2)}</div>
          <div className="cost-meta">{t.setup.hoursAndSessions(totalHours.toFixed(2), usage?.sessionCount ?? 0)}</div>
        </div>
      </div>

      <div className="divider" />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Field label={t.setup.rateLabel} style={{ flex: 1, minWidth: 120 }}>
          <input
            className="input mono"
            type="number"
            step={0.01}
            min={0}
            value={rateDraft}
            onChange={(e) => setRateDraft(e.target.value)}
            onBlur={() => {
              const n = Number(rateDraft);
              if (Number.isFinite(n) && n >= 0) onSetRate(n);
              else setRateDraft(usage?.ratePerHour.toFixed(2) ?? '0.45');
            }}
            style={{ maxWidth: 140 }}
          />
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={onOpenDashboard}>
            <IconExternal size={13} />
            {t.setup.dashboard}
          </button>
          <button type="button" className="btn ghost" onClick={onResetUsage}>
            {t.setup.resetUsage}
          </button>
        </div>
      </div>
    </>
  );
}
