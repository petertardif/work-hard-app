/**
 * Design tokens for Work Hard.
 *
 * The palette is lifted directly from the Claude Design mockups. The app is
 * dark-only (`userInterfaceStyle: "dark"` in app.json) — `Colors.light` is kept
 * so the `ThemeColor` type stays a valid key union, but nothing renders it.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#E0E1E6',
    borderStrong: '#C9CBD1',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    /** Card and grouped-row fill, and the hairline between task rows. */
    backgroundElement: '#212225',
    /** Outlined-button and grouped-row separator stroke. */
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#212225',
    borderStrong: '#2E3135',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Spline Sans is loaded at runtime by `useFonts` in the root layout. React
 * Native does not synthesize weights for custom fonts, so each weight is its
 * own family name — set `fontFamily`, never `fontWeight`, on styled text.
 */
export const FontFamily = {
  regular: 'SplineSans_400Regular',
  medium: 'SplineSans_500Medium',
  semibold: 'SplineSans_600SemiBold',
  bold: 'SplineSans_700Bold',
  monoMedium: 'SplineSansMono_500Medium',
  monoSemibold: 'SplineSansMono_600SemiBold',
  monoBold: 'SplineSansMono_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * The mockups express tracking in `em`; React Native's `letterSpacing` is
 * absolute points, so these are pre-multiplied against their own font size.
 */
export const Typography = {
  /** The giant day numeral on Today. 104px / .8 / -.05em */
  display: {
    fontFamily: FontFamily.bold,
    fontSize: 104,
    lineHeight: 83,
    letterSpacing: -5.2,
  },
  /** "Lists", "Settings". 32px / 600 / -.02em */
  screenTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 32,
    letterSpacing: -0.64,
  },
  /** A task on Today. 22px / 28 / 500 */
  taskRow: {
    fontFamily: FontFamily.medium,
    fontSize: 22,
    lineHeight: 28,
  },
  /** Card headline, e.g. an active list's name. 20px / 600 */
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 20,
  },
  /** Grouped-row text in Settings and the editor. 16-17px */
  body: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  /** The ubiquitous uppercase mono caption. 12px / 600 / .18em */
  monoLabel: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: 12,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
  },
  /** Tighter variant used for section headers. 11px / 600 / .12em */
  monoLabelSmall: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
  },
  /** Mono detail text that is not a label, e.g. "5 tasks · never run". 13px */
  monoValue: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 13,
  },
} as const;

/** Opacity applied to a struck-through, completed task row. */
export const CompletedRowOpacity = 0.38;

/**
 * Horizontal screen padding. The mockups use 24 on Today, where the giant day
 * numeral needs room, and 20 on the denser list-style screens.
 */
export const Gutter = {
  wide: 24,
  narrow: 20,
} as const;

export {
  DefaultDayEndsAt,
  DurationPresets,
  FallbackTimezone,
  MaxRunDays,
  MaxTasksPerList,
  MinRunDays,
} from '@/constants/limits';

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
