import type { ComponentType, CSSProperties } from 'react';
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Moon,
  PartyPopper,
  Play,
  Radio,
  RefreshCw,
  Settings,
  Square,
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
// to 1.5 here so every site picks up the same density.
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

// Variant for transport controls (Play, Stop). Lucide's defaults are
// hollow outlines, but Diffuser's start/stop button reads as a recording
// transport where solid glyphs are the convention (DAWs, video players).
// Filling with currentColor and dropping stroke gives the same look the
// hand-drawn versions had.
function lucideFilled(Icon: ComponentType<LucideProps>) {
  const Wrapped = (p: IconProps): JSX.Element => (
    <Icon
      size={p.size ?? DEFAULT_SIZE}
      strokeWidth={0}
      fill="currentColor"
      className={`ico ${p.className ?? ''}`}
      style={p.style}
      aria-hidden="true"
    />
  );
  return Wrapped;
}

// Stage tab represents broadcast control ("régie" in French — the room
// where a live show is orchestrated). Lucide's Radio (a sphere emitting
// waves) is the most direct visual handle for that.
export const IconStage = lucide(Radio);

export const IconPlay = lucideFilled(Play);
export const IconStop = lucideFilled(Square);

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
