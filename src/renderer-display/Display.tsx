import { useEffect, useRef, useState } from 'react';
import type { StyleSettings } from '../shared/style';
import { DEFAULT_STYLE } from '../shared/style';
import { useMockText } from './MockText';

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
  const [mockEnabled, setMockEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const turnRef = useRef<string>('');

  useEffect(() => {
    applyStyleVars(style);
  }, [style]);

  useEffect(() => {
    const offStyle = window.diffuseurDisplay.onStyleApply((s) => setStyle(s));
    const offMock = window.diffuseurDisplay.onMockState((s) => setMockEnabled(s.enabled));
    const offPartial = window.diffuseurDisplay.onPartial(({ text, turnId }) => {
      setLines((prev) => mergePartial(prev, { id: turnId, text, partial: true }, style.maxLines));
      turnRef.current = turnId;
    });
    const offFinal = window.diffuseurDisplay.onFinal(({ text, turnId }) => {
      setLines((prev) => commitFinal(prev, { id: turnId, text, partial: false }, style.maxLines));
    });
    const offStream = window.diffuseurDisplay.onStreamState((s) => {
      if (s === 'idle' || s === 'connecting') {
        // keep last lines until we are actually streaming or mock takes over
      }
    });
    const offFs = window.diffuseurDisplay.onDisplayState((s) => {
      document.body.classList.toggle('fullscreen', s.isFullscreen);
      setIsFullscreen(s.isFullscreen);
    });
    return () => {
      offStyle();
      offMock();
      offPartial();
      offFinal();
      offStream();
      offFs();
    };
  }, [style.maxLines]);

  // Mock pipeline overrides lines when enabled and no real stream is active
  const mockLines = useMockText(mockEnabled, style.maxLines);
  const renderLines = mockEnabled && lines.length === 0 ? mockLines : lines;

  return (
    <div className="display-stage">
      <div className="display-text">
        {renderLines.slice(-style.maxLines).map((line) => (
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
