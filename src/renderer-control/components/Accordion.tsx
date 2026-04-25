import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  id: string;
  number: string;
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

const STORAGE_KEY = (id: string) => `accordion.${id}`;

export function Accordion({ id, number, title, badge, defaultOpen = false, children }: Props): JSX.Element {
  const [open, setOpen] = useState<boolean>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY(id));
    if (stored === null) return defaultOpen;
    return stored === 'true';
  });
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.localStorage.setItem(STORAGE_KEY(id), String(open));
  }, [id, open]);

  return (
    <section className={`accordion ${open ? 'open' : 'closed'}`}>
      <button
        type="button"
        className="accordion-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`accordion-body-${id}`}
      >
        <span className="num">{number}</span>
        <span className="title">{title}</span>
        {badge && <span className="badge-slot">{badge}</span>}
        <span className="rule" aria-hidden="true" />
        <Chevron open={open} />
      </button>
      <div className="accordion-body" id={`accordion-body-${id}`} role="region">
        <div className="accordion-content">{children}</div>
      </div>
    </section>
  );
}

function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      className={`chevron ${open ? 'down' : 'up'}`}
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1L5 5L9 1" />
    </svg>
  );
}
