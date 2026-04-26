import type { StreamState } from '../../shared/ipc';
import type { StyleSettings } from '../../shared/style';
import { useT } from '../i18n';
import { IconPlay, IconStop, IconExternal, IconEye } from './Icons';
import { MOCK_FRENCH_LINES } from '../../shared/constants';

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
  onBroadcastToggle: () => void;
  onDisplayToggle: () => void;
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
  onBroadcastToggle,
  onDisplayToggle,
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
  };

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

          <div className="display-block">
            <div className="display-status">
              {t.display.label}
              <span className="v">
                {!displayOpen
                  ? t.display.statusClosed
                  : displayFullscreen
                    ? t.display.fullscreen
                    : t.display.statusOpen}
              </span>
            </div>
            <button type="button" className="btn" onClick={onDisplayToggle}>
              <IconExternal size={13} />
              {displayOpen ? t.display.closeButton : t.display.openButton}
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
              background: appearance.bgColor,
              justifyContent:
                appearance.textAlign === 'center'
                  ? 'center'
                  : appearance.textAlign === 'right'
                    ? 'flex-end'
                    : 'flex-start',
            }}
          >
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
