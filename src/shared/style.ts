export type StyleSettings = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fontWeight: 400 | 500 | 600 | 700;
  textColor: string;
  bgColor: string;
  liveColor: string;
  paddingX: number;
  paddingY: number;
  textAlign: 'left' | 'center' | 'right';
  maxLines: number;
  transitionsEnabled: boolean;
  // Behaviour toggles surfaced in the Appearance tab.
  showPartial: boolean;
  autoScroll: boolean;
  presetId: StylePresetId | null;
};

export const DEFAULT_STYLE: StyleSettings = {
  fontSize: 84,
  lineHeight: 1.25,
  fontFamily: 'Inter',
  fontWeight: 700,
  textColor: '#FFFFFF',
  bgColor: '#000000',
  liveColor: '#FFFFFF',
  paddingX: 64,
  paddingY: 48,
  textAlign: 'left',
  maxLines: 6,
  transitionsEnabled: true,
  showPartial: true,
  autoScroll: true,
  presetId: 'high-contrast',
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

export type StylePresetId = 'high-contrast' | 'subtle' | 'long-reading';

const PRESET_BASE: Omit<StyleSettings, 'fontSize' | 'lineHeight' | 'fontWeight' | 'textColor' | 'bgColor' | 'liveColor' | 'fontFamily' | 'presetId'> = {
  paddingX: 64,
  paddingY: 48,
  textAlign: 'left',
  maxLines: 6,
  transitionsEnabled: true,
  showPartial: true,
  autoScroll: true,
};

export const STYLE_PRESETS: Record<StylePresetId, { settings: StyleSettings }> = {
  'high-contrast': {
    settings: {
      ...PRESET_BASE,
      fontFamily: 'Inter',
      fontWeight: 700,
      fontSize: 84,
      lineHeight: 1.25,
      textColor: '#FFFFFF',
      bgColor: '#000000',
      liveColor: '#FFFFFF',
      presetId: 'high-contrast',
    },
  },
  subtle: {
    settings: {
      ...PRESET_BASE,
      fontFamily: 'Inter',
      fontWeight: 500,
      fontSize: 64,
      lineHeight: 1.4,
      textColor: '#E8E6DC',
      bgColor: '#1B1A15',
      liveColor: '#A8A496',
      presetId: 'subtle',
    },
  },
  'long-reading': {
    settings: {
      ...PRESET_BASE,
      fontFamily: 'Atkinson Hyperlegible',
      fontWeight: 400,
      fontSize: 56,
      lineHeight: 1.6,
      textColor: '#F4F3EE',
      bgColor: '#14130F',
      liveColor: '#A8A496',
      maxLines: 8,
      presetId: 'long-reading',
    },
  },
};
