import type { StreamState } from '../../shared/ipc';
import { useT } from '../i18n';

type Props = {
  state: StreamState;
  disabled: boolean;
  onClick: () => void;
};

export function DiffuseButton({ state, disabled, onClick }: Props): JSX.Element {
  const t = useT();
  const label = t.diffuse[state];
  return (
    <button
      type="button"
      className="diffuse-btn"
      data-state={state}
      onClick={onClick}
      disabled={disabled || state === 'connecting'}
      aria-label={label}
    >
      <span className="glyph" aria-hidden="true">
        {state === 'streaming' ? <SquareGlyph /> : <TriangleGlyph />}
      </span>
      <span>{label}</span>
    </button>
  );
}

function TriangleGlyph(): JSX.Element {
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 1.2v10.6L10 6.5L1 1.2z" fill="currentColor" />
    </svg>
  );
}

function SquareGlyph(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}
