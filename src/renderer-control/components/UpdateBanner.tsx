import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../shared/ipc';
import { useT } from '../i18n';
import { IconClose, IconExternal, IconParty, IconRefresh } from './Icons';

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

  const view = bannerView(status, t);

  return (
    <div className={`update-banner update-banner-${status.type}`} role="status">
      <button
        type="button"
        className="update-banner-dismiss"
        onClick={dismiss}
        aria-label={t.update.dismiss}
        title={t.update.dismiss}
      >
        <IconClose size={10} />
      </button>

      <div className="update-banner-head">
        <span className="update-banner-icon" aria-hidden="true">
          {view.icon}
        </span>
        <h3 className="update-banner-title">{view.title}</h3>
      </div>

      {view.body && <p className="update-banner-body">{view.body}</p>}

      {status.type === 'downloading' && (
        <div className="update-banner-progress" aria-hidden="true">
          <div
            className="update-banner-progress-fill"
            style={{ width: `${status.percent}%` }}
          />
        </div>
      )}

      {view.cta && (
        <button type="button" className="update-banner-cta" onClick={view.cta.onClick}>
          {view.cta.icon}
          <span>{view.cta.label}</span>
        </button>
      )}
    </div>
  );
}

type BannerView = {
  icon: JSX.Element;
  title: string;
  body: string | null;
  cta: { label: string; onClick: () => void; icon?: JSX.Element } | null;
};

function bannerView(status: UpdateStatus, t: ReturnType<typeof useT>): BannerView {
  switch (status.type) {
    case 'available':
      return {
        icon: <IconParty size={14} />,
        title: t.update.availableTitle,
        body: t.update.availableBody(status.version),
        cta: isManualMacFlow
          ? {
              label: t.update.viewReleaseNotes,
              icon: <IconExternal size={12} />,
              onClick: () => void window.diffuseur.update.openReleases(),
            }
          : {
              label: t.update.downloadInstall,
              icon: <IconExternal size={12} />,
              onClick: () => void window.diffuseur.update.download(),
            },
      };
    case 'downloading':
      return {
        icon: <IconRefresh size={14} />,
        title: t.update.downloadingTitle,
        body: t.update.downloadingBody(status.percent),
        cta: null,
      };
    case 'downloaded':
      return {
        icon: <IconParty size={14} />,
        title: t.update.readyTitle,
        body: t.update.readyBody,
        cta: {
          label: t.update.restartNow,
          onClick: () => void window.diffuseur.update.install(),
        },
      };
    case 'error':
      return {
        icon: <IconRefresh size={14} />,
        title: t.update.failedTitle,
        body: t.update.failedBody,
        cta: {
          label: t.update.retry,
          icon: <IconRefresh size={12} />,
          onClick: () => void window.diffuseur.update.download(),
        },
      };
    default:
      return { icon: <IconParty size={14} />, title: '', body: null, cta: null };
  }
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
