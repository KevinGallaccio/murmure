import { useEffect, useRef, useState } from 'react';
import type { StyleSettings } from '../../shared/style';
import { MOCK_FRENCH_LINES } from '../../shared/constants';
import { useT } from '../i18n';

type Props = {
  style: StyleSettings;
  finalLines: string[];
  partial: string | null;
  demoActive: boolean;
  streaming: boolean;
};

const previewScale = 0.22;

export function Preview({ style, finalLines, partial, demoActive, streaming }: Props): JSX.Element {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mockLines, setMockLines] = useState<string[]>([]);
  const [mockPartial, setMockPartial] = useState<string | null>(null);

  useEffect(() => {
    if (finalLines.length > 0 || partial) {
      setMockLines([]);
      setMockPartial(null);
      return;
    }
    let cancelled = false;
    let idx = 0;

    async function run(): Promise<void> {
      while (!cancelled) {
        const sentence = MOCK_FRENCH_LINES[idx % MOCK_FRENCH_LINES.length];
        const words = sentence.split(' ');
        let acc = '';
        for (const w of words) {
          if (cancelled) return;
          acc = (acc ? acc + ' ' : '') + w;
          setMockPartial(acc);
          await sleep(180);
        }
        if (cancelled) return;
        setMockLines((prev) => [...prev, sentence].slice(-style.maxLines));
        setMockPartial(null);
        idx += 1;
        await sleep(700);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [finalLines.length, partial, style.maxLines]);

  const linesToShow = finalLines.length > 0 || partial ? finalLines : mockLines;
  const partialToShow = partial ?? (finalLines.length === 0 ? mockPartial : null);
  const visible = linesToShow.slice(-style.maxLines);
  const showDemoTag = demoActive && finalLines.length === 0 && !partial;
  const showLiveTag = streaming;

  const fs = Math.max(8, style.fontSize * previewScale);
  const px = style.paddingX * previewScale;
  const py = style.paddingY * previewScale;

  return (
    <div className="section">
      <div className="section-tag">
        <span>{t.preview.title}</span>
        <span className="rule" />
      </div>
      <div className="section-body">
        <div
          ref={containerRef}
          className="preview-frame"
          style={
            {
              '--p-font-family': `'${style.fontFamily}', system-ui, sans-serif`,
              '--p-font-weight': String(style.fontWeight),
              '--p-text-color': style.textColor,
              '--p-bg-color': style.bgColor,
              '--p-live-color': style.liveColor,
              '--p-font-size': `${fs}px`,
              '--p-line-height': String(style.lineHeight),
              '--p-padding-x': `${px}px`,
              '--p-padding-y': `${py}px`,
              '--p-text-align': style.textAlign,
            } as React.CSSProperties
          }
        >
          <div className="preview-content">
            <div className="preview-text">
              {visible.map((l, i) => (
                <span key={`f-${i}`} style={{ display: 'block' }}>
                  {l}
                </span>
              ))}
              {partialToShow && (
                <span className="partial" style={{ display: 'block' }}>
                  {partialToShow}
                </span>
              )}
            </div>
          </div>
          {showLiveTag && (
            <div className="preview-tag live" aria-label={t.preview.liveAria}>
              <span className="dot" aria-hidden="true" />
              {t.preview.liveTag}
            </div>
          )}
          {showDemoTag && !showLiveTag && (
            <div className="preview-tag" aria-label={t.preview.demoAria}>
              <span className="dot" aria-hidden="true" />
              {t.preview.demoTag}
            </div>
          )}
        </div>

        <div className="preview-caption">
          <span>{t.preview.caption}</span>
          <span className="help">{t.preview.help}</span>
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
