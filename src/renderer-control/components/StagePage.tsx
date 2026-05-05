import { useEffect, useRef, useState } from 'react';
import type { StreamState } from '../../shared/ipc';
import type { StyleSettings } from '../../shared/style';
import { useT } from '../i18n';
import { IconPlay, IconStop, IconExternal, IconEye, IconVideo, IconVideoOff } from './Icons';
import { MOCK_FRENCH_LINES } from '../../shared/constants';

// Same shadow string the audience window uses, so the operator preview
// matches the audience read exactly when subtitleBackdrop === 'shadow'.
const SUBTITLE_TEXT_SHADOW =
  '0 2px 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.6), 0 1px 0 rgba(0,0,0,0.5)';

type Props = {
  streamState: StreamState;
  hasKey: boolean;
  hasMic: boolean;
  displayOpen: boolean;
  displayFullscreen: boolean;
  sessionTimer: string;
  sessionCost: string;
  ratePerHour: number;
  finalLines: string[];
  partial: string | null;
  appearance: StyleSettings;
  videoEnabled: boolean;
  videoDeviceId: string | null;
  onBroadcastToggle: () => void;
  onDisplayToggle: () => void;
  onVideoToggle: () => void;
  onGoToSetup: () => void;
};

export function StagePage({
  streamState,
  hasKey,
  hasMic,
  displayOpen,
  displayFullscreen,
  sessionTimer,
  sessionCost,
  ratePerHour,
  finalLines,
  partial,
  appearance,
  videoEnabled,
  videoDeviceId,
  onBroadcastToggle,
  onDisplayToggle,
  onVideoToggle,
  onGoToSetup,
}: Props): JSX.Element {
  const t = useT();
  const ready = hasKey && hasMic;
  const broadcasting = streamState === 'streaming';
  const connecting = streamState === 'connecting';

  const statusLabel = broadcasting
    ? t.state.onAir
    : ready
      ? t.state.ready
      : t.state.needsConfig;

  const broadcastLabel = broadcasting ? t.stage.stopBroadcast : t.stage.startBroadcast;

  const monitorMeta = broadcasting ? t.stage.monitorLive : t.stage.monitorIdle;

  const visibleLines = finalLines.length > 0 || partial ? finalLines : MOCK_FRENCH_LINES.slice(0, 4);

  // Scaled-down preview of the audience screen — match font + colors but shrink size to fit card
  const monitorTextStyle: React.CSSProperties = {
    fontFamily: `'${appearance.fontFamily}', sans-serif`,
    fontWeight: appearance.fontWeight,
    fontSize: `${Math.max(14, Math.round(appearance.fontSize * 0.32))}px`,
    lineHeight: appearance.lineHeight,
    color: appearance.textColor,
    textAlign: appearance.textAlign,
    padding: `${Math.round(appearance.paddingY * 0.5)}px ${Math.round(appearance.paddingX * 0.5)}px`,
    textShadow:
      videoEnabled && appearance.subtitleBackdrop === 'shadow' ? SUBTITLE_TEXT_SHADOW : 'none',
    position: 'relative',
    zIndex: 2,
  };

  const hasVideoDevice = !!videoDeviceId;

  return (
    <div className="page">
      <div className="page-head">
        <div className="eyebrow">{t.stage.eyebrow}</div>
        <h1 className="page-title">
          {t.stage.titleA}
          <em>{t.stage.titleEm}</em>
          {t.stage.titleB}
        </h1>
        <p className="page-sub">{t.stage.sub}</p>
      </div>

      <div className="stage-grid">
        {/* Outputs deck — destinations of the broadcast (display + video).
            Lives above the broadcast card so the operator sets up the
            audience-screen plumbing before pressing the central CTA. */}
        <div className="outputs-deck">
          <div className="output-cell">
            <div className="output-row">
              <span className="output-num">01</span>
              <span className="output-label">{t.display.label}</span>
              <span
                className={`output-dot ${displayOpen ? 'on' : ''}`}
                aria-hidden="true"
              />
            </div>
            <div className="output-state">
              {!displayOpen
                ? t.display.statusClosed
                : displayFullscreen
                  ? t.display.fullscreen
                  : t.display.statusOpen}
            </div>
            <button
              type="button"
              className="output-action"
              onClick={onDisplayToggle}
            >
              <span className="output-action-text">
                {displayOpen ? t.display.closeButton : t.display.openButton}
              </span>
              <IconExternal size={11} />
            </button>
          </div>

          <div className="output-cell">
            <div className="output-row">
              <span className="output-num">02</span>
              <span className="output-label">{t.video.label}</span>
              <span
                className={`output-dot ${videoEnabled ? 'on' : ''}`}
                aria-hidden="true"
              />
            </div>
            <div className="output-state">
              {videoEnabled ? t.video.statusOn : t.video.statusOff}
            </div>
            <button
              type="button"
              className="output-action"
              onClick={onVideoToggle}
              disabled={!hasVideoDevice}
              title={!hasVideoDevice ? t.video.pickFirst : undefined}
            >
              <span className="output-action-text">
                {videoEnabled ? t.video.toggleOff : t.video.toggleOn}
              </span>
              {videoEnabled ? <IconVideoOff size={11} /> : <IconVideo size={11} />}
            </button>
          </div>
        </div>

        {/* Broadcast control card */}
        <div className="broadcast-card">
          <div className="timer-block">
            <div className="timer-label">{t.stage.sessionLabel}</div>
            <div className="timer">{sessionTimer}</div>
            <div className="timer-meta">
              ≈ ${sessionCost} · ${ratePerHour.toFixed(2)}/h
            </div>
          </div>

          <div className="broadcast-status">
            <div className={`status-pill ${broadcasting ? 'live' : ''}`}>
              <span className={`dot ${broadcasting ? 'live' : 'idle'}`} aria-hidden="true" />
              {statusLabel}
            </div>
            <button
              type="button"
              className={`broadcast-btn ${broadcasting ? 'live' : 'idle'}`}
              onClick={onBroadcastToggle}
              disabled={!ready && !broadcasting}
            >
              {broadcasting ? <IconStop size={14} /> : <IconPlay size={14} />}
              {connecting ? t.state.connecting : broadcastLabel}
            </button>
          </div>
        </div>

        {/* Audience monitor */}
        <div className="monitor-card">
          <div className="monitor-head">
            <IconEye size={14} />
            <span className="title">{t.stage.monitorTitle}</span>
            <span className="meta">{monitorMeta}</span>
          </div>
          <div
            className="monitor-screen"
            style={{
              background: videoEnabled ? '#000' : appearance.bgColor,
              justifyContent:
                appearance.textAlign === 'center'
                  ? 'center'
                  : appearance.textAlign === 'right'
                    ? 'flex-end'
                    : 'flex-start',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {videoEnabled && videoDeviceId && (
              <MonitorVideoPreview deviceId={videoDeviceId} />
            )}
            {videoEnabled && appearance.subtitleBackdrop === 'scrim' && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '45%',
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
            )}
            {broadcasting && (
              <div className="badge">
                <span className="pdot" aria-hidden="true" />
                LIVE
              </div>
            )}
            <div className="monitor-text" style={monitorTextStyle}>
              {visibleLines.map((line, i) => (
                <MonitorLine
                  key={`f-${i}-${line.length}`}
                  text={line}
                  transitions={appearance.transitionsEnabled}
                />
              ))}
              {partial && (
                <MonitorLine
                  text={partial}
                  partial
                  color={appearance.liveColor}
                  transitions={appearance.transitionsEnabled}
                />
              )}
            </div>
          </div>
        </div>

        {/* Setup-needed card */}
        {!ready && (
          <div className="card tinted setup-needed">
            <div className="setup-needed-icon">
              <span className="dot warn" aria-hidden="true" />
            </div>
            <div className="setup-needed-body">
              <div className="setup-needed-title">{t.stage.setupNeededTitle}</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                {t.stage.setupNeededBody}
                <button type="button" className="setup-needed-link" onClick={onGoToSetup}>
                  {t.stage.setupNeededLink}
                </button>
                .
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MonitorLine({
  text,
  partial,
  color,
  transitions,
}: {
  text: string;
  partial?: boolean;
  color?: string;
  transitions: boolean;
}): JSX.Element {
  const tokens = tokenizeForStream(text);
  const className = `monitor-line ${partial ? 'partial' : 'final'} ${transitions ? 'transition' : ''}`;
  return (
    <div className={className} style={color ? { color } : undefined}>
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
    </div>
  );
}

type StreamToken = { kind: 'word' | 'space'; text: string };

function tokenizeForStream(text: string): StreamToken[] {
  const parts = text.split(/(\s+)/);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ kind: /^\s+$/.test(p) ? ('space' as const) : ('word' as const), text: p }));
}

// Independent webcam stream for the operator's monitor card. The audience
// display opens its own stream in the renderer-display process; modern OS
// webcam stacks support multiple consumers, but on rare older Windows UVC
// drivers the second open fails and we surface that gently to the operator.
function MonitorVideoPreview({ deviceId }: { deviceId: string }): JSX.Element {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    const open = async (): Promise<void> => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message ?? t.video.previewUnavailable);
      }
    };
    void open();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [deviceId, t.video.previewUnavailable]);

  if (error) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 12,
          padding: 16,
          textAlign: 'center',
          zIndex: 0,
        }}
      >
        {t.video.previewUnavailable}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 0,
      }}
    />
  );
}
