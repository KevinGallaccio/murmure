import { useEffect, useState } from 'react';
import { useT } from '../i18n';

type Status = 'unknown' | 'absent' | 'saved' | 'verified' | 'invalid';

type Props = {
  onStatusChange?: (status: Status) => void;
};

export function ApiKeyPanel({ onStatusChange }: Props): JSX.Element {
  const t = useT();
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('unknown');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void window.diffuseur.apikey.status().then((r) => {
      setHasKey(r.hasKey);
      setStatus(r.hasKey ? 'saved' : 'absent');
    });
  }, []);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  async function save(): Promise<void> {
    if (!draft.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const r = await window.diffuseur.apikey.save(draft.trim());
      setHasKey(r.hasKey);
      setStatus('saved');
      setDraft('');
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clear(): Promise<void> {
    setSaving(true);
    setErrorMessage(null);
    const r = await window.diffuseur.apikey.clear();
    setHasKey(r.hasKey);
    setStatus('absent');
    setSaving(false);
  }

  async function test(): Promise<void> {
    setTesting(true);
    setErrorMessage(null);
    const r = await window.diffuseur.apikey.test();
    if (r.ok) {
      setStatus('verified');
    } else {
      setStatus('invalid');
      setErrorMessage(r.error ?? t.apikey.unknownError);
    }
    setTesting(false);
  }

  return (
    <div className="apikey-panel">
      <div className="apikey-input">
        <input
          type={showKey ? 'text' : 'password'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={hasKey ? t.apikey.placeholderSet : t.apikey.placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <button
          type="button"
          className="eye"
          onClick={() => setShowKey((v) => !v)}
          title={showKey ? t.apikey.hide : t.apikey.show}
          aria-label={showKey ? t.apikey.hideAria : t.apikey.showAria}
        >
          {showKey ? <EyeOff /> : <EyeOn />}
        </button>
      </div>

      <div className="apikey-actions">
        <button className="primary" onClick={save} disabled={!draft.trim() || saving}>
          {t.apikey.save}
        </button>
        <button onClick={test} disabled={!hasKey || testing}>
          {testing ? t.apikey.testing : t.apikey.test}
        </button>
        {hasKey && (
          <button className="danger" onClick={clear} disabled={saving}>
            {t.apikey.clear}
          </button>
        )}
      </div>

      {status === 'saved' && (
        <span className="status-line">
          <span className="glyph">·</span>
          {t.apikey.saved}
        </span>
      )}
      {status === 'verified' && (
        <span className="status-line ok">
          <span className="glyph">✓</span>
          {t.apikey.verified}
        </span>
      )}
      {status === 'invalid' && errorMessage && (
        <span className="status-line err">
          <span className="glyph">!</span>
          {errorMessage}
        </span>
      )}
      {status === 'absent' && (
        <span className="status-line">
          <span className="glyph">·</span>
          {t.apikey.absent}
        </span>
      )}
      {errorMessage && status !== 'invalid' && (
        <span className="status-line err">
          <span className="glyph">!</span>
          {errorMessage}
        </span>
      )}
    </div>
  );
}

function EyeOn(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1 7s2.4-4 6-4 6 4 6 4-2.4 4-6 4S1 7 1 7z" />
      <circle cx="7" cy="7" r="1.6" />
    </svg>
  );
}

function EyeOff(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1.5 1.5l11 11" strokeLinecap="round" />
      <path d="M3 4.5C2 5.6 1 7 1 7s2.4 4 6 4c1 0 1.9-.2 2.7-.5M5.4 3.3C5.9 3.1 6.4 3 7 3c3.6 0 6 4 6 4-.5.7-1.2 1.6-2.1 2.3" />
    </svg>
  );
}
