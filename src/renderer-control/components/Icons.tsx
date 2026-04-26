import type { ComponentType, CSSProperties, ReactNode } from 'react';
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Moon,
  PartyPopper,
  RefreshCw,
  Settings,
  Sun,
  TriangleAlert,
  Type,
  X,
  type LucideProps,
} from 'lucide-react';

type IconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

// Lucide ships at strokeWidth=2; murmure's hand-drawn icons used 1.5 and
// the rest of the visual language was tuned to that lighter weight. Lock
// to 1.5 here so the swap is visually a no-op for callers.
const DEFAULT_STROKE = 1.5;
const DEFAULT_SIZE = 16;

function lucide(Icon: ComponentType<LucideProps>) {
  const Wrapped = (p: IconProps): JSX.Element => (
    <Icon
      size={p.size ?? DEFAULT_SIZE}
      strokeWidth={p.strokeWidth ?? DEFAULT_STROKE}
      className={`ico ${p.className ?? ''}`}
      style={p.style}
      aria-hidden="true"
    />
  );
  return Wrapped;
}

// ---- Brand-specific custom icons (kept hand-drawn) ------------------
//
// These three earn their custom-SVG status:
//
// IconStage mirrors the brand mark itself (three dots resolving into a
// rounded rectangle = "scattered sound becoming continuous text"). Using a
// generic stage/wave icon would break that identity loop.
//
// IconPlay and IconStop are deliberately *filled* glyphs — Lucide's defaults
// are stroked, and the broadcast button reads as a transport control where
// solid shapes are the convention (DAWs, video players). Keeping them
// custom keeps the fill consistent without per-icon prop overrides.

function Svg({
  size = 16,
  className,
  style,
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 1.5,
  viewBox = '0 0 24 24',
  children,
}: IconProps & { viewBox?: string; children: ReactNode }): JSX.Element {
  return (
    <svg
      className={`ico ${className ?? ''}`}
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconStage = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="10" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <rect x="18.5" y="10.4" width="3.2" height="3.2" rx="1.6" />
  </Svg>
);

export const IconPlay = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M6 4l14 8L6 20z" />
  </Svg>
);

export const IconStop = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </Svg>
);

// ---- Lucide-backed icons --------------------------------------------

export const IconAppearance = lucide(Type);
export const IconSetup = lucide(Settings);
export const IconExternal = lucide(ExternalLink);
export const IconEye = lucide(Eye);
export const IconEyeOff = lucide(EyeOff);
export const IconCheck = lucide(Check);
export const IconClose = lucide(X);
export const IconParty = lucide(PartyPopper);
export const IconRefresh = lucide(RefreshCw);
export const IconGlobe = lucide(Globe);
export const IconSun = lucide(Sun);
export const IconMoon = lucide(Moon);
export const IconWarn = lucide(TriangleAlert);
