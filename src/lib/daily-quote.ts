/**
 * Decides whether the daily quote overlay should appear, and which quote.
 *
 * Pure and side-effect free so the rules can be tested exhaustively — the
 * overlay is a gate in front of the whole app, so "shows when it shouldn't" and
 * "never shows" are both bad failures.
 */

import type { DayKey } from '@/lib/run-logic';

export type Quote = {
  id: string;
  text: string;
  /** Null for proverbs and anything unsourced; the overlay omits the row. */
  author: string | null;
};

export type QuoteDecisionInput = {
  /** False while the stored day key is still being read. */
  resolved: boolean;
  /** Null when signed out. */
  userId: string | null;
  /** The user's `show_daily_quote` preference. */
  enabled: boolean;
  /** Today, as the user's own day boundary reckons it. */
  today: DayKey | null;
  /** The day the quote was last dismissed, or null if never. */
  lastShown: DayKey | null;
  /** Quotes available to draw from; empty while the fetch is in flight. */
  quotes: readonly Quote[];
};

/**
 * Whether to show the overlay right now.
 *
 * Deliberately conservative: anything unresolved means "not yet" rather than
 * "no", so a slow profile or quote fetch delays the overlay instead of skipping
 * it. The caller treats its own `hidden` state as terminal, so a late `true`
 * can never resurrect a dismissed overlay.
 */
export function shouldShowQuote(input: QuoteDecisionInput): boolean {
  if (!input.resolved) return false;
  if (!input.userId) return false;
  if (!input.enabled) return false;
  if (!input.today) return false;
  if (input.quotes.length === 0) return false;
  return input.lastShown !== input.today;
}

/**
 * Picks one quote at random.
 *
 * `random` is injectable so the choice can be pinned in tests. Callers must
 * call this once and hold the result — calling it during render would reshuffle
 * the quote on every re-render.
 */
export function pickQuote(
  quotes: readonly Quote[],
  random: () => number = Math.random,
): Quote | null {
  if (quotes.length === 0) return null;
  const index = Math.floor(random() * quotes.length);
  // Math.random() can in principle return values that floor to the length when
  // multiplied by it; clamp rather than hand back undefined.
  return quotes[Math.min(index, quotes.length - 1)] ?? null;
}

/**
 * AsyncStorage key for the last day the quote was dismissed.
 *
 * Scoped per user so two accounts on one device do not consume each other's
 * quote for the day.
 */
export function quoteStorageKey(userId: string): string {
  return `work-hard:quote-last-shown:${userId}`;
}

/**
 * Largest type size at which a quote still fits the space it is given.
 *
 * Fixed tiers by character count were the previous approach, and they could not
 * be both large and safe: a size that suited an iPhone 12 overflowed a smaller
 * screen, and a size safe everywhere was needlessly small on a big one. This
 * measures against the actual box instead, so short quotes get genuinely large
 * type and long ones step down only as far as they must.
 *
 * `MaxQuoteLength` caps input, so there is always some size in the ladder that
 * fits.
 */
export const MaxQuoteLength = 300;

/** Candidate sizes, largest first. The first one that fits wins. */
const QUOTE_SIZES = [38, 34, 30, 26, 23, 20, 18, 16] as const;

/** Leading as a multiple of font size. Always > 1, or glyphs clip. */
const LINE_HEIGHT_RATIO = 1.38;

/**
 * Average glyph advance as a fraction of font size, for Spline Sans Medium.
 *
 * Deliberately a slight overestimate: erring high predicts more lines than
 * actually render, so the result is a size that definitely fits rather than one
 * that just about might.
 */
const AVG_CHAR_RATIO = 0.54;

export type QuoteTypeScale = {
  fontSize: number;
  lineHeight: number;
};

/**
 * Picks the largest size whose wrapped height fits `availableHeight`.
 *
 * The line estimate adds one line of slack because words do not break
 * mid-word — real wrapping always costs at least as many lines as dividing
 * characters by characters-per-line suggests, and usually one more.
 */
export function quoteTypeScale(
  text: string,
  availableWidth: number,
  availableHeight: number,
): QuoteTypeScale {
  const length = text.trim().length;

  for (const fontSize of QUOTE_SIZES) {
    const lineHeight = Math.round(fontSize * LINE_HEIGHT_RATIO);
    const charsPerLine = Math.max(1, Math.floor(availableWidth / (fontSize * AVG_CHAR_RATIO)));
    const lines = Math.ceil(length / charsPerLine) + 1;

    if (lines * lineHeight <= availableHeight) {
      return { fontSize, lineHeight };
    }
  }

  // Nothing fit — hand back the smallest rather than something that overflows.
  const smallest = QUOTE_SIZES[QUOTE_SIZES.length - 1];
  return { fontSize: smallest, lineHeight: Math.round(smallest * LINE_HEIGHT_RATIO) };
}
