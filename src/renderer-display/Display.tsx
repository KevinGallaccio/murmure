import { useEffect, useRef, useState } from 'react';
import type { StyleSettings } from '../shared/style';
import { DEFAULT_STYLE } from '../shared/style';

type VideoState = { enabled: boolean; deviceId: string | null };

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
      onVideoState: (cb: (s: VideoState) => void) => () => void;
    };
  }
}

// Strong drop-shadow tuned for white text on arbitrary photographic
// backgrounds — the same look TV captioning uses.
const SUBTITLE_TEXT_SHADOW =
  '0 2px 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.6), 0 1px 0 rgba(0,0,0,0.5)';

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
  root.setProperty(
    '--text-shadow',
    settings.subtitleBackdrop === 'shadow' ? SUBTITLE_TEXT_SHADOW : 'none',
  );
}

export function Display(): JSX.Element {
  const [style, setStyle] = useState<StyleSettings>(DEFAULT_STYLE);
  const [lines, setLines] = useState<Line[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [video, setVideo] = useState<VideoState>({ enabled: false, deviceId: null });
  const turnRef = useRef<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    applyStyleVars(style);
  }, [style]);

  // Toggle a body class so CSS can override --bg-color (the user-configured
  // solid background) with black behind the video element. Without this the
  // bgColor still bleeds through the letterboxed margins of object-fit:cover.
  useEffect(() => {
    document.body.classList.toggle('video-mode', video.enabled);
  }, [video.enabled]);

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
    const offVideo = window.diffuseurDisplay.onVideoState((s) => setVideo(s));
    return () => {
      offStyle();
      offPartial();
      offFinal();
      offFs();
      offVideo();
    };
  }, [style.maxLines]);

  // Webcam lifecycle: open when (enabled + deviceId), tear down otherwise.
  // We request the camera's native max resolution via aspirational ideals —
  // getUserMedia negotiates down on its own when the camera or CPU can't
  // sustain it. If `deviceId: { exact }` fails (camera unplugged since the
  // id was persisted), fall back to the default device so the audience
  // screen still gets some video instead of going black.
  useEffect(() => {
    let cancelled = false;
    const stopCurrent = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    if (!video.enabled || !video.deviceId) {
      stopCurrent();
      return () => {};
    }

    const open = async (): Promise<void> => {
      stopCurrent();
      const baseConstraints: MediaTrackConstraints = {
        width: { ideal: 4096 },
        height: { ideal: 2160 },
      };
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { ...baseConstraints, deviceId: { exact: video.deviceId! } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        if (cancelled) return;
        // Most likely OverconstrainedError (camera missing). Retry with no
        // deviceId pin so the audience screen still gets *some* video.
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({
            video: baseConstraints,
            audio: false,
          });
          if (cancelled) {
            fallback.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = fallback;
          if (videoRef.current) videoRef.current.srcObject = fallback;
        } catch (fallbackErr) {
          // Surface to console only — operator notices the absence on screen.
          console.error('[murmure] camera open failed', err, fallbackErr);
        }
      }
    };

    void open();
    return () => {
      cancelled = true;
      stopCurrent();
    };
  }, [video.enabled, video.deviceId]);

  // The audience display never shows mock content. The Hugo loop is a tool
  // for the operator's preview pane (in the Stage / Appearance tabs of the
  // control window), not for the people in the room. When the window is
  // open but no transcript has arrived yet, we show the brand mark as a
  // calm, identity-anchored placeholder — but suppress it once video is on,
  // since the camera feed already fills the space.
  const visibleLines = lines.slice(-style.maxLines);
  const showPlaceholder = visibleLines.length === 0 && !video.enabled;

  return (
    <div className="display-stage">
      {video.enabled && (
        <video
          ref={videoRef}
          className="display-video"
          autoPlay
          muted
          playsInline
        />
      )}
      {video.enabled && style.subtitleBackdrop === 'scrim' && (
        <div className="display-scrim" aria-hidden="true" />
      )}
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
            <StreamLine
              key={line.id + (line.partial ? ':p' : ':f')}
              line={line}
              transitions={style.transitionsEnabled}
            />
          ))}
        </div>
      )}
      {!isFullscreen && (
        <div className="windowed-hint">Glissez pour déplacer · Échap quitte le plein écran</div>
      )}
    </div>
  );
}

// Splits a line into words and renders each with a key derived from its
// position + content so React's reconciliation only animates words that
// actually changed since the last partial. Trailing cursor shows for the
// in-flight partial only.
function StreamLine({ line, transitions }: { line: Line; transitions: boolean }): JSX.Element {
  const tokens = tokenize(line.text);
  return (
    <span
      className={`display-line ${line.partial ? 'partial' : 'final'} ${transitions ? 'transition' : ''}`}
    >
      {tokens.map((tok, i) =>
        tok.kind === 'word' ? (
          <span
            key={`${i}-${tok.text}`}
            className={`stream-word ${transitions ? 'animate' : ''}`}
          >
            {tok.text}
          </span>
        ) : (
          <span key={`s-${i}`}>{tok.text}</span>
        ),
      )}
      {'\n'}
    </span>
  );
}

type Token = { kind: 'word' | 'space'; text: string };

function tokenize(text: string): Token[] {
  // Split on whitespace runs, preserving them as separate tokens so spaces
  // don't get re-keyed and re-animated when a new word appears next to them.
  const parts = text.split(/(\s+)/);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ kind: /^\s+$/.test(p) ? ('space' as const) : ('word' as const), text: p }));
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
