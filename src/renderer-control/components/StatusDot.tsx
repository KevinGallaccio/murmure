type Tone = 'idle' | 'ok' | 'warn' | 'err' | 'live';

type Props = {
  tone: Tone;
  pulse?: boolean;
};

export function StatusDot({ tone, pulse }: Props): JSX.Element {
  return (
    <span
      className={`status-dot tone-${tone}${pulse ? ' pulsing' : ''}`}
      role="presentation"
      aria-hidden="true"
    />
  );
}
