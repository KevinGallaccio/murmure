import type { ReactNode } from 'react';
import type { StyleSettings } from '../../shared/style';
import { FONT_FAMILY_IDS, STYLE_PRESETS, type FontFamilyId, type StylePresetId } from '../../shared/style';
import { useT } from '../i18n';

type Props = {
  sectionNumber: string;
  style: StyleSettings;
  onPatch: (patch: Partial<StyleSettings>) => void;
  onReset: () => void;
  onPreset: (id: StylePresetId) => void;
};

export function StyleControls({ sectionNumber, style, onPatch, onReset, onPreset }: Props): JSX.Element {
  const t = useT();
  return (
    <div className="inspector-panel">
      <header className="inspector-head">
        <span className="num">{sectionNumber}</span>
        <span className="title">{t.apparence.title}</span>
        <span className="rule" />
        <button
          type="button"
          className="reset-link"
          onClick={onReset}
          title={t.apparence.resetTooltip}
        >
          {t.apparence.reset}
        </button>
      </header>

      <div className="preset-row">
        {(Object.keys(STYLE_PRESETS) as StylePresetId[]).map((id) => (
          <button key={id} className="preset-pill" onClick={() => onPreset(id)}>
            {t.presets[id]}
          </button>
        ))}
      </div>

      <Group title={t.apparence.groups.type}>
        <Field label={t.apparence.fields.font}>
          <select
            value={style.fontFamily}
            onChange={(e) => onPatch({ fontFamily: e.target.value })}
          >
            {FONT_FAMILY_IDS.map((id: FontFamilyId) => (
              <option key={id} value={id}>
                {t.fonts[id]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.apparence.fields.weight}>
          <select
            value={style.fontWeight}
            onChange={(e) => onPatch({ fontWeight: Number(e.target.value) as 400 | 600 | 800 })}
          >
            <option value={400}>{t.apparence.weights.regular}</option>
            <option value={600}>{t.apparence.weights.semibold}</option>
            <option value={800}>{t.apparence.weights.extrabold}</option>
          </select>
        </Field>

        <Field label={t.apparence.fields.size} value={`${style.fontSize}px`}>
          <input
            type="range"
            min={24}
            max={200}
            step={1}
            value={style.fontSize}
            onChange={(e) => onPatch({ fontSize: Number(e.target.value) })}
          />
        </Field>

        <Field label={t.apparence.fields.lineHeight} value={style.lineHeight.toFixed(2)}>
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={style.lineHeight}
            onChange={(e) => onPatch({ lineHeight: Number(e.target.value) })}
          />
        </Field>
      </Group>

      <Group title={t.apparence.groups.colors}>
        <Field label={t.apparence.fields.text}>
          <ColorField
            value={style.textColor}
            onChange={(v) => onPatch({ textColor: v })}
            ariaLabel={t.apparence.fields.chooseColor}
          />
        </Field>
        <Field label={t.apparence.fields.background}>
          <ColorField
            value={style.bgColor}
            onChange={(v) => onPatch({ bgColor: v })}
            ariaLabel={t.apparence.fields.chooseColor}
          />
        </Field>
        <Field label={t.apparence.fields.live}>
          <ColorField
            value={style.liveColor}
            onChange={(v) => onPatch({ liveColor: v })}
            ariaLabel={t.apparence.fields.chooseColor}
          />
        </Field>
      </Group>

      <Group title={t.apparence.groups.layout}>
        <Field label={t.apparence.fields.paddingX} value={`${style.paddingX}px`}>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={style.paddingX}
            onChange={(e) => onPatch({ paddingX: Number(e.target.value) })}
          />
        </Field>

        <Field label={t.apparence.fields.paddingY} value={`${style.paddingY}px`}>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={style.paddingY}
            onChange={(e) => onPatch({ paddingY: Number(e.target.value) })}
          />
        </Field>

        <Field label={t.apparence.fields.align}>
          <div className="segment full">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                className={style.textAlign === a ? 'active' : ''}
                onClick={() => onPatch({ textAlign: a })}
              >
                {t.apparence.align[a]}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t.apparence.fields.maxLines} value={String(style.maxLines)}>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={style.maxLines}
            onChange={(e) => onPatch({ maxLines: Number(e.target.value) })}
          />
        </Field>

        <Field label={t.apparence.fields.animation}>
          <label className="check-row">
            <input
              type="checkbox"
              checked={style.transitionsEnabled}
              onChange={(e) => onPatch({ transitionsEnabled: e.target.checked })}
            />
            <span>{t.apparence.fields.animationDescription}</span>
          </label>
        </Field>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="insp-group">
      <div className="insp-group-title">
        <span>{title}</span>
        <span className="rule" />
      </div>
      <div className="insp-group-body">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="insp-field">
      <div className="insp-field-head">
        <span className="insp-label">{label}</span>
        {value !== undefined && <span className="insp-value">{value}</span>}
      </div>
      <div className="insp-field-control">{children}</div>
    </div>
  );
}

function ColorField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <label className="color-field full">
      <span className="swatch" style={{ background: value }} aria-hidden="true" />
      <span className="hex">{value.toUpperCase()}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
    </label>
  );
}
