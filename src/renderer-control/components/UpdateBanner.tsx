import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../shared/ipc';
import { useT } from '../i18n';
import { IconClose, IconExternal, IconRefresh } from './Icons';

const DISMISSED_PREFIX = 'murmure.update.dismissed.';
// Detect the manual-only macOS flow once; the renderer doesn't otherwise
// need to know the platform. Falls back to false (= can install in place)
// if navigator.platform is somehow unavailable.
const isManualMacFlow = (() => {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform ?? navigator.userAgent ?? '');
})();

export function UpdateBanner(): JSX.Element | null {
  const t = useT();
  const [status, setStatus] = useState<UpdateStatus>({ type: 'idle' });
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.diffuseur.update.get().then((s) => setStatus(s));
    const off = window.diffuseur.update.onStatus((s) => setStatus(s));
    return off;
  }, []);

  const versionInPlay = versionFromStatus(status);
  // Hide if there's nothing to show, or if the user dismissed *this exact*
  // version — a later release will re-show because the version key changes.
  if (!shouldShow(status)) return null;
  if (versionInPlay && dismissedVersion === versionInPlay) return null;

  const dismiss = () => {
    if (versionInPlay) {
      try {
        window.localStorage.setItem(`${DISMISSED_PREFIX}${versionInPlay}`, '1');
      } catch {
        /* ignore quota / private mode */
      }
    }
    setDismissedVersion(versionInPlay ?? null);
  };

  return (
    <div className={`update-banner update-banner-${status.type}`} role="status">
      <BannerBody status={status} t={t} />
      <BannerActions status={status} t={t} onDismiss={dismiss} />
    </div>
  );
}

function BannerBody({ status, t }: { status: UpdateStatus; t: ReturnType<typeof useT> }): JSX.Element {
  switch (status.type) {
    case 'available':
      return (
        <div className="update-banner-text">
          <div className="update-banner-title">{t.update.available(status.version)}</div>
        </div>
      );
    case 'downloading':
      return (
        <div className="update-banner-text">
          <div className="update-banner-title">{t.update.downloading(status.percent)}</div>
          <div className="update-banner-progress" aria-hidden="true">
            <div className="update-banner-progress-fill" style={{ width: `${status.percent}%` }} />
          </div>
        </div>
      );
    case 'downloaded':
      return (
        <div className="update-banner-text">
          <div className="update-banner-title">{t.update.readyToRestart}</div>
        </div>
      );
    case 'error':
      return (
        <div className="update-banner-text">
          <div className="update-banner-title">{t.update.failed}</div>
        </div>
      );
    default:
      return <div className="update-banner-text" />;
  }
}

function BannerActions({
  status,
  t,
  onDismiss,
}: {
  status: UpdateStatus;
  t: ReturnType<typeof useT>;
  onDismiss: () => void;
}): JSX.Element {
  const dismissBtn = (
    <button
      type="button"
      className="update-banner-dismiss"
      onClick={onDismiss}
      aria-label={t.update.dismiss}
      title={t.update.dismiss}
    >
      <IconClose size={11} />
    </button>
  );

  // Useful action depends on platform + state. macOS without Developer ID
  // can't swap-on-restart, so we send the user to GitHub instead of
  // attempting an install that would silently fall back to the old binary.
  if (status.type === 'available') {
    return (
      <div className="update-banner-actions">
        <button
          type="button"
          className="update-banner-cta"
          onClick={() => {
            if (isManualMacFlow) void window.diffuseur.update.openReleases();
            else void window.diffuseur.update.download();
          }}
        >
          {isManualMacFlow ? <IconExternal size={11} /> : null}
          {isManualMacFlow ? t.update.viewReleaseNotes : t.update.downloadInstall}
        </button>
        {dismissBtn}
      </div>
    );
  }
  if (status.type === 'downloaded') {
    return (
      <div className="update-banner-actions">
        <button
          type="button"
          className="update-banner-cta"
          onClick={() => void window.diffuseur.update.install()}
        >
          {t.update.restartNow}
        </button>
        {dismissBtn}
      </div>
    );
  }
  if (status.type === 'error') {
    return (
      <div className="update-banner-actions">
        <button
          type="button"
          className="update-banner-cta"
          onClick={() => void window.diffuseur.update.download()}
        >
          <IconRefresh size={11} />
          {t.update.retry}
        </button>
        {dismissBtn}
      </div>
    );
  }
  // Downloading — only allow dismiss (download keeps going in main; user
  // can come back to it via the menu's "Check for Updates" if they dismiss).
  return <div className="update-banner-actions">{dismissBtn}</div>;
}

function shouldShow(status: UpdateStatus): boolean {
  return (
    status.type === 'available' ||
    status.type === 'downloading' ||
    status.type === 'downloaded' ||
    status.type === 'error'
  );
}

function versionFromStatus(status: UpdateStatus): string | null {
  if (status.type === 'available' || status.type === 'downloaded') return status.version;
  return null;
}
