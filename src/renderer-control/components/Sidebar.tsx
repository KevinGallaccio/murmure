import type { LanguageChoice, StreamState, Tab, Theme } from '../../shared/ipc';
import { useT } from '../i18n';
import { IconStage, IconAppearance, IconSetup, IconGlobe, IconSun, IconMoon } from './Icons';
import { UpdateBanner } from './UpdateBanner';

type Props = {
  tab: Tab;
  setTab: (tab: Tab) => void;
  streamState: StreamState;
  hasKey: boolean;
  hasMic: boolean;
  displayOpen: boolean;
  language: LanguageChoice;
  cycleLanguage: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  appVersion: string;
};

export function Sidebar({
  tab,
  setTab,
  streamState,
  hasKey,
  hasMic,
  displayOpen,
  language,
  cycleLanguage,
  theme,
  setTheme,
  appVersion,
}: Props): JSX.Element {
  const t = useT();
  const broadcasting = streamState === 'streaming';

  const items: Array<{ id: Tab; label: string; kbd: string; Icon: typeof IconStage }> = [
    { id: 'stage', label: t.tabs.stage, kbd: '⌘1', Icon: IconStage },
    { id: 'appearance', label: t.tabs.appearance, kbd: '⌘2', Icon: IconAppearance },
    { id: 'setup', label: t.tabs.setup, kbd: '⌘3', Icon: IconSetup },
  ];

  const broadcastDot = broadcasting ? 'live' : hasKey && hasMic ? 'ok' : 'warn';
  const broadcastText = broadcasting
    ? t.state.broadcasting
    : hasKey && hasMic
      ? t.state.ready
      : t.state.setupNeeded;

  const langLabel = language === 'fr' ? 'FR' : language === 'auto' ? 'AUTO' : 'EN';

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="brand-block">
        <div className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="20" cy="50" r="5.5" fill="#2745CF" />
            <circle cx="34" cy="50" r="5.5" fill="currentColor" />
            <circle cx="48" cy="50" r="5.5" fill="currentColor" />
            <rect x="60.5" y="44.5" width="25" height="11" rx="5.5" fill="currentColor" />
          </svg>
        </div>
        <div className="brand-name">murmure</div>
        <div className="brand-version">v {appVersion}</div>
      </div>

      <div className="nav-label">{t.brand.workspace}</div>
      {items.map((it) => {
        const Icon = it.Icon;
        return (
          <button
            key={it.id}
            type="button"
            className={`nav-item ${tab === it.id ? 'active' : ''}`}
            onClick={() => setTab(it.id)}
          >
            <Icon size={16} />
            <span>{it.label}</span>
            <span className="kbd">{it.kbd}</span>
          </button>
        );
      })}

      <div className="sidebar-bottom">
        <UpdateBanner />

        <div className="sidebar-foot">
          <div className="status-row">
            <span className={`dot ${broadcastDot}`} aria-hidden="true" />
            <span>{broadcastText}</span>
          </div>
        <div className="status-row">
          <span className={`dot ${displayOpen ? 'ok' : 'idle'}`} aria-hidden="true" />
          <span>
            {t.display.label} {displayOpen ? t.display.open : t.display.closed}
          </span>
        </div>

        <div className="sidebar-controls">
          <button
            type="button"
            className="sidebar-pill"
            onClick={cycleLanguage}
            title={t.languagePill.tooltip}
          >
            <IconGlobe size={12} />
            <span>{langLabel}</span>
          </button>

          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={t.themeToggle.tooltip}
            aria-label={t.themeToggle.tooltip}
          >
            <span className={`tt-thumb ${theme}`} />
            <span className={`tt-icon sun ${theme === 'light' ? 'on' : ''}`}>
              <IconSun size={12} />
            </span>
            <span className={`tt-icon moon ${theme === 'dark' ? 'on' : ''}`}>
              <IconMoon size={12} />
            </span>
          </button>
        </div>
        </div>
      </div>
    </aside>
  );
}
