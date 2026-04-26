import type { ReactNode } from 'react';
import type { StyleSettings } from '../../shared/style';
import { FONT_FAMILY_IDS, STYLE_PRESETS, type FontFamilyId, type StylePresetId } from '../../shared/style';
import { useT } from '../i18n';
import { IconEye, IconRefresh } from './Icons';

type Props = {
  appearance: StyleSettings;
  onPatch: (patch: Partial<StyleSettings>) => void;
  onPreset: (id: StylePresetId) => void;
  onReset: () => void;
};

export function AppearancePage({ appearance, onPatch, onPreset, onReset }: Props): JSX.Element {
  const t = useT();

  const previewTextStyle: React.CSSProperties = {
    fontFamily: `'${appearance.fontFamily}', sans-serif`,
    fontWeight: appearance.fontWeight,
    fontSize: `${Math.max(14, Math.round(appearance.fontSize * 0.32))}px`,
    lineHeight: appearance.lineHeight,
    color: appearance.textColor,
    textAlign: appearance.textAlign,
    padding: `${Math.round(appearance.paddingY * 0.5)}px ${Math.round(appearance.paddingX * 0.5)}px`,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="eyebrow">{t.appearance.eyebrow}</div>
        <h1 className="page-title">
          {t.appearance.titleA}
          <em>{t.appearance.titleEm}</em>
          {t.appearance.titleB}
        </h1>
        <p className="page-sub">{t.appearance.sub}</p>
      </div>

      <div className="appearance-grid">
        {/* Live preview */}
        <div className="monitor-card">
          <div className="monitor-head">
            <IconEye size={14} />
            <span className="title">{t.appearance.previewTitle}</span>
            <span className="meta">{t.appearance.previewMeta}</span>
          </div>
          <div
            className="monitor-screen"
            style={{
              background: appearance.bgColor,
              justifyContent:
                appearance.textAlign === 'center'
                  ? 'center'
                  : appearance.textAlign === 'right'
                    ? 'flex-end'
                    : 'flex-start',
            }}
          >
            <div className="monitor-text" style={previewTextStyle}>
              <div>Demain, dès l'aube, à l'heure où blanchit la campagne,</div>
              <div>je partirai. Vois-tu, je sais que tu m'attends.</div>
              <div>J'irai par la forêt, j'irai par la montagne.</div>
              <span className="partial" style={{ color: appearance.liveColor }}>
                Je ne puis demeurer loin de toi
              </span>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <h3 className="card-title" style={{ margin: 0 }}>
              {t.appearance.presetsTitle}
            </h3>
            <button type="button" className="btn ghost" onClick={onReset}>
              <IconRefresh size={12} />
              {t.appearance.reset}
            </button>
          </div>
          <p className="card-sub">{t.appearance.presetsSub}</p>
          <div className="preset-row">
            {(Object.keys(STYLE_PRESETS) as StylePresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`chip ${appearance.presetId === id ? 'active' : ''}`}
                onClick={() => onPreset(id)}
              >
                {t.presets[id]}
              </button>
            ))}
          </div>
        </div>

        {/* Controls grid */}
        <div className="controls-grid">
          {/* Type */}
          <div className="card control-block">
            <h4 className="section-h">{t.appearance.sectionType}</h4>

            <Field label={t.appearance.fieldFont}>
              <select
                className="select"
                value={appearance.fontFamily}
                onChange={(e) => onPatch({ fontFamily: e.target.value, presetId: null })}
              >
                {FONT_FAMILY_IDS.map((id: FontFamilyId) => (
                  <option key={id} value={id}>
                    {t.fonts[id]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t.appearance.fieldWeight}>
              <select
                className="select"
                value={appearance.fontWeight}
                onChange={(e) =>
                  onPatch({
                    fontWeight: Number(e.target.value) as 400 | 500 | 600 | 700,
                    presetId: null,
                  })
                }
              >
                <option value={400}>{t.appearance.weight400}</option>
                <option value={500}>{t.appearance.weight500}</option>
                <option value={600}>{t.appearance.weight600}</option>
                <option value={700}>{t.appearance.weight700}</option>
              </select>
            </Field>

            <SliderRow
              label={t.appearance.fieldSize}
              value={`${appearance.fontSize}px`}
              min={32}
              max={140}
              step={2}
              current={appearance.fontSize}
              onChange={(v) => onPatch({ fontSize: v, presetId: null })}
            />

            <SliderRow
              label={t.appearance.fieldLineHeight}
              value={appearance.lineHeight.toFixed(2)}
              min={1}
              max={2}
              step={0.05}
              current={appearance.lineHeight}
              onChange={(v) => onPatch({ lineHeight: v, presetId: null })}
            />
          </div>

          {/* Colors */}
          <div className="card control-block">
            <h4 className="section-h">{t.appearance.sectionColors}</h4>

            <Field label={t.appearance.fieldTextColor}>
              <ColorSwatch
                value={appearance.textColor}
                onChange={(v) => onPatch({ textColor: v, presetId: null })}
              />
            </Field>
            <Field label={t.appearance.fieldBgColor}>
              <ColorSwatch
                value={appearance.bgColor}
                onChange={(v) => onPatch({ bgColor: v, presetId: null })}
              />
            </Field>
            <Field label={t.appearance.fieldLiveColor}>
              <ColorSwatch
                value={appearance.liveColor}
                onChange={(v) => onPatch({ liveColor: v, presetId: null })}
              />
            </Field>
          </div>

          {/* Layout */}
          <div className="card control-block">
            <h4 className="section-h">{t.appearance.sectionLayout}</h4>

            <SliderRow
              label={t.appearance.fieldPaddingX}
              value={`${appearance.paddingX}px`}
              min={0}
              max={160}
              step={4}
              current={appearance.paddingX}
              onChange={(v) => onPatch({ paddingX: v, presetId: null })}
            />

            <SliderRow
              label={t.appearance.fieldPaddingY}
              value={`${appearance.paddingY}px`}
              min={0}
              max={160}
              step={4}
              current={appearance.paddingY}
              onChange={(v) => onPatch({ paddingY: v, presetId: null })}
            />

            <Field label={t.appearance.fieldAlignment}>
              <div className="seg">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={appearance.textAlign === a ? 'active' : ''}
                    onClick={() => onPatch({ textAlign: a, presetId: null })}
                  >
                    {a === 'left'
                      ? t.appearance.alignLeft
                      : a === 'center'
                        ? t.appearance.alignCenter
                        : t.appearance.alignRight}
                  </button>
                ))}
              </div>
            </Field>

            <SliderRow
              label={t.appearance.fieldMaxLines}
              value={String(appearance.maxLines)}
              min={2}
              max={12}
              step={1}
              current={appearance.maxLines}
              onChange={(v) => onPatch({ maxLines: v, presetId: null })}
            />
          </div>

          {/* Behavior */}
          <div className="card control-block">
            <h4 className="section-h">{t.appearance.sectionBehavior}</h4>

            <BehaviorRow
              title={t.appearance.behaviorFade}
              sub={t.appearance.behaviorFadeSub}
              on={appearance.transitionsEnabled}
              onChange={(v) => onPatch({ transitionsEnabled: v })}
            />
            <BehaviorRow
              title={t.appearance.behaviorPartial}
              sub={t.appearance.behaviorPartialSub}
              on={appearance.showPartial}
              onChange={(v) => onPatch({ showPartial: v })}
            />
            <BehaviorRow
              title={t.appearance.behaviorAutoScroll}
              sub={t.appearance.behaviorAutoScrollSub}
              on={appearance.autoScroll}
              onChange={(v) => onPatch({ autoScroll: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="field">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <div className="slider-block">
      <div className="slider-head">
        <span className="label">{label}</span>
        <span className="slider-value">{value}</span>
      </div>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <label className="swatch">
      <span className="swatch-chip" style={{ background: value }} aria-hidden="true" />
      <span className="swatch-name">{value.toUpperCase()}</span>
      <span className="swatch-hex">⌅</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function BehaviorRow({
  title,
  sub,
  on,
  onChange,
}: {
  title: string;
  sub: string;
  on: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <div className="behavior-row">
      <div>
        <div className="copy-title">{title}</div>
        <div className="copy-sub">{sub}</div>
      </div>
      <button
        type="button"
        className={`toggle ${on ? 'on' : ''}`}
        onClick={() => onChange(!on)}
        aria-pressed={on}
        aria-label={title}
      />
    </div>
  );
}
