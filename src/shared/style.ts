export type StyleSettings = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fontWeight: 400 | 600 | 800;
  textColor: string;
  bgColor: string;
  liveColor: string;
  paddingX: number;
  paddingY: number;
  textAlign: 'left' | 'center' | 'right';
  maxLines: number;
  transitionsEnabled: boolean;
};

export const DEFAULT_STYLE: StyleSettings = {
  fontSize: 72,
  lineHeight: 1.3,
  fontFamily: 'Inter',
  fontWeight: 600,
  textColor: '#FFFFFF',
  bgColor: '#000000',
  liveColor: '#A0A0A0',
  paddingX: 64,
  paddingY: 48,
  textAlign: 'left',
  maxLines: 6,
  transitionsEnabled: true,
};

// Font IDs only — display labels live in the renderer's i18n layer.
export const FONT_FAMILY_IDS = [
  'Inter',
  'Manrope',
  'Atkinson Hyperlegible',
  'IBM Plex Sans',
  'Roboto Slab',
  'JetBrains Mono',
] as const;
export type FontFamilyId = (typeof FONT_FAMILY_IDS)[number];

export type StylePresetId = 'grand-contraste' | 'sobre' | 'lecture-longue';

export const STYLE_PRESETS: Record<StylePresetId, { settings: StyleSettings }> = {
  'grand-contraste': {
    settings: {
      ...DEFAULT_STYLE,
      fontSize: 96,
      fontWeight: 800,
      textColor: '#FFFFFF',
      bgColor: '#000000',
      liveColor: '#888888',
      fontFamily: 'Atkinson Hyperlegible',
    },
  },
  sobre: {
    settings: {
      ...DEFAULT_STYLE,
      fontSize: 56,
      fontWeight: 400,
      textColor: '#E8E4DA',
      bgColor: '#1A1A1A',
      liveColor: '#807A6E',
      fontFamily: 'Inter',
    },
  },
  'lecture-longue': {
    settings: {
      ...DEFAULT_STYLE,
      fontSize: 64,
      lineHeight: 1.5,
      fontWeight: 400,
      textColor: '#F5F5F5',
      bgColor: '#1C1C24',
      liveColor: '#9090A0',
      fontFamily: 'Atkinson Hyperlegible',
      maxLines: 8,
    },
  },
};
