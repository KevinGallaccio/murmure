import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';

type Props = {
  rms: number;
  active: boolean;
};

export function VuMeter({ rms, active }: Props): JSX.Element {
  const t = useT();
  const normalized = Math.max(0, Math.min(1, Math.log10(1 + rms * 50) / Math.log10(51)));

  const [peak, setPeak] = useState(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const dt = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;
    setPeak((prev) => {
      const decayed = Math.max(0, prev - dt * 0.35);
      return Math.max(decayed, normalized);
    });
  }, [normalized]);

  return (
    <div className="field">
      <label>{t.vu.label}</label>
      <div className="vu" aria-label={t.vu.label}>
        <div className="vu-track">
          <div
            className="vu-fill"
            style={{ width: `${(active ? normalized : 0) * 100}%` }}
          />
          {active && peak > 0.02 && (
            <div className="vu-peak" style={{ left: `calc(${peak * 100}% - 1px)` }} />
          )}
        </div>
        <div className="vu-scale">
          <span>−∞</span>
          <span>−24</span>
          <span>−12</span>
          <span>−6</span>
          <span>0 dB</span>
        </div>
      </div>
    </div>
  );
}
