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
 * Type size for a quote, stepped down as it gets longer.
 *
 * The overlay is a single calm page with no scrolling, so a long passage has to
 * fit rather than overflow. At 27px roughly 35 characters fit per line, and an
 * iPhone 12 affords about 300px of text height — so anything past ~90
 * characters needs to come down to stay on one screen.
 *
 * `MaxQuoteLength` is enforced in the input, so there is no tier beyond this.
 */
export const MaxQuoteLength = 300;

export function quoteTypeScale(text: string): { fontSize: number; lineHeight: number } {
  const length = text.trim().length;
  if (length <= 90) return { fontSize: 27, lineHeight: 38 };
  if (length <= 180) return { fontSize: 22, lineHeight: 31 };
  return { fontSize: 18, lineHeight: 26 };
}
