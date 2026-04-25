import { useState } from 'react';
import type { UsageUpdate } from '../../shared/ipc';
import { useT } from '../i18n';

type Props = {
  usage: UsageUpdate | null;
  onResetUsage: () => void;
  onSetRate: (rate: number) => void;
  onOpenDashboard: () => void;
};

export function UsagePanel({
  usage,
  onResetUsage,
  onSetRate,
  onOpenDashboard,
}: Props): JSX.Element {
  const t = useT();
  const [rateDraft, setRateDraft] = useState<string>(() => usage?.ratePerHour.toFixed(2) ?? '0.45');

  const sessionSpend = usage ? (usage.sessionSeconds / 3600) * usage.ratePerHour : 0;
  const totalSpend = usage?.estimatedCost ?? 0;
  const totalHours = usage ? usage.totalSeconds / 3600 : 0;
  const sessionMinutes = usage ? Math.floor(usage.sessionSeconds / 60) : 0;
  const sessionSecs = usage ? Math.floor(usage.sessionSeconds % 60) : 0;

  return (
    <div className="usage-panel">
      <div className="spend-stack">
        <div className="spend-card">
          <div className="label">{t.usage.sessionLabel}</div>
          <div className="value">
            <span className="currency">$</span>
            {sessionSpend.toFixed(3)}
          </div>
          <div className="sub">
            {t.usage.elapsed(sessionMinutes, sessionSecs.toString().padStart(2, '0'))}
          </div>
        </div>
        <div className="spend-card">
          <div className="label">{t.usage.cumulLabel}</div>
          <div className="value">
            <span className="currency">$</span>
            {totalSpend.toFixed(2)}
          </div>
          <div className="sub">{t.usage.hoursAndSessions(totalHours.toFixed(2), usage?.sessionCount ?? 0)}</div>
        </div>
      </div>

      <div className="spend-rate">
        <label htmlFor="rate-input">{t.usage.rateLabel}</label>
        <input
          id="rate-input"
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
        />
        <span className="rate-suffix">{t.usage.rateSuffix}</span>
      </div>

      <p className="help">{t.usage.help}</p>

      <div className="spend-actions">
        <button onClick={onOpenDashboard}>{t.usage.dashboard}</button>
        <button className="ghost" onClick={onResetUsage}>
          {t.usage.reset}
        </button>
      </div>
      {usage?.resetAt && (
        <span className="reset-since">
          {t.usage.resetSince(new Date(usage.resetAt).toLocaleDateString())}
        </span>
      )}
    </div>
  );
}
