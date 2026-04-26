import { useEffect, useRef, useState } from 'react';
import type { StyleSettings } from '../shared/style';
import { DEFAULT_STYLE } from '../shared/style';

declare global {
  interface Window {
    diffuseurDisplay: {
      onStyleApply: (cb: (s: StyleSettings) => void) => () => void;
      onPartial: (cb: (t: { text: string; turnId: string }) => void) => () => void;
      onFinal: (cb: (t: { text: string; turnId: string; timestamp: number }) => void) => () => void;
      onMockState: (cb: (s: { enabled: boolean }) => void) => () => void;
      onStreamState: (cb: (s: 'idle' | 'connecting' | 'streaming' | 'error') => void) => () => void;
      onDisplayState: (
        cb: (s: { isOpen: boolean; displayId: number | null; isFullscreen: boolean }) => void,
      ) => () => void;
    };
  }
}

type Line = { id: string; text: string; partial: boolean };

function applyStyleVars(settings: StyleSettings): void {
  const root = document.documentElement.style;
  root.setProperty('--font-size', `${settings.fontSize}px`);
  root.setProperty('--line-height', String(settings.lineHeight));
  root.setProperty('--font-family', `'${settings.fontFamily}', system-ui, sans-serif`);
  root.setProperty('--font-weight', String(settings.fontWeight));
  root.setProperty('--text-color', settings.textColor);
  root.setProperty('--bg-color', settings.bgColor);
  root.setProperty('--live-color', settings.liveColor);
  root.setProperty('--padding-x', `${settings.paddingX}px`);
  root.setProperty('--padding-y', `${settings.paddingY}px`);
  root.setProperty('--text-align', settings.textAlign);
}

export function Display(): JSX.Element {
  const [style, setStyle] = useState<StyleSettings>(DEFAULT_STYLE);
  const [lines, setLines] = useState<Line[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const turnRef = useRef<string>('');

  useEffect(() => {
    applyStyleVars(style);
  }, [style]);

  useEffect(() => {
    const offStyle = window.diffuseurDisplay.onStyleApply((s) => setStyle(s));
    const offPartial = window.diffuseurDisplay.onPartial(({ text, turnId }) => {
      setLines((prev) => mergePartial(prev, { id: turnId, text, partial: true }, style.maxLines));
      turnRef.current = turnId;
    });
    const offFinal = window.diffuseurDisplay.onFinal(({ text, turnId }) => {
      setLines((prev) => commitFinal(prev, { id: turnId, text, partial: false }, style.maxLines));
    });
    const offFs = window.diffuseurDisplay.onDisplayState((s) => {
      document.body.classList.toggle('fullscreen', s.isFullscreen);
      setIsFullscreen(s.isFullscreen);
    });
    return () => {
      offStyle();
      offPartial();
      offFinal();
      offFs();
    };
  }, [style.maxLines]);

  // The audience display never shows mock content. The Hugo loop is a tool
  // for the operator's preview pane (in the Stage / Appearance tabs of the
  // control window), not for the people in the room. When the window is
  // open but no transcript has arrived yet, we show the brand mark as a
  // calm, identity-anchored placeholder.
  const visibleLines = lines.slice(-style.maxLines);
  const showPlaceholder = visibleLines.length === 0;

  return (
    <div className="display-stage">
      {showPlaceholder ? (
        <div className="display-placeholder" aria-hidden="true">
          <svg viewBox="0 0 100 100" width="160" height="160">
            <circle cx="20" cy="50" r="5.5" fill="currentColor" />
            <circle cx="34" cy="50" r="5.5" fill="currentColor" />
            <circle cx="48" cy="50" r="5.5" fill="currentColor" />
            <rect x="60.5" y="44.5" width="25" height="11" rx="5.5" fill="currentColor" />
          </svg>
        </div>
      ) : (
        <div className="display-text">
          {visibleLines.map((line) => (
            <span
              key={line.id + (line.partial ? ':p' : ':f')}
              className={`display-line ${line.partial ? 'partial' : ''} ${
                style.transitionsEnabled ? 'transition' : ''
              }`}
            >
              {line.text}
              {'\n'}
            </span>
          ))}
        </div>
      )}
      {!isFullscreen && (
        <div className="windowed-hint">Glissez pour déplacer · Échap quitte le plein écran</div>
      )}
    </div>
  );
}

function mergePartial(prev: Line[], next: Line, maxLines: number): Line[] {
  const withoutPartialOfSameTurn = prev.filter((l) => !(l.partial && l.id === next.id));
  const withoutAnyPartial = withoutPartialOfSameTurn.filter((l) => !l.partial);
  return [...withoutAnyPartial, next].slice(-maxLines);
}

function commitFinal(prev: Line[], finalLine: Line, maxLines: number): Line[] {
  const withoutPartials = prev.filter((l) => !l.partial);
  // replace any final with same id (shouldn't happen) and append
  const dedup = withoutPartials.filter((l) => l.id !== finalLine.id);
  return [...dedup, finalLine].slice(-maxLines);
}
