/**
 * What happens when the app is opened.
 *
 * Two things are rationed to once a day: the cold-open animation and the daily
 * quote. Every other launch skips straight back to where you were.
 *
 * Pure and dependency-free so the rules are testable; the React wiring lives in
 * `src/app/_layout.tsx`.
 */

import type { DayKey } from '@/lib/run-logic';

/**
 * Routes worth returning to.
 *
 * Deliberately only the top-level screens. The list editor, the new-list form
 * and the duration picker all hold draft state that a cold launch has already
 * thrown away, so reopening them would look like the app had lost your work.
 * Those fall back to Today.
 */
export const RESTORABLE_ROUTES = ['/', '/lists', '/settings', '/quotes'] as const;

export type RestorableRoute = (typeof RESTORABLE_ROUTES)[number];

export function isRestorableRoute(path: string | null | undefined): path is RestorableRoute {
  return (
    typeof path === 'string' && (RESTORABLE_ROUTES as readonly string[]).includes(path)
  );
}

/** AsyncStorage key for the day the cold open last played, scoped per user. */
export function introStorageKey(userId: string): string {
  return `work-hard:intro-last-shown:${userId}`;
}

/** AsyncStorage key for the last top-level route, scoped per user. */
export function lastRouteStorageKey(userId: string): string {
  return `work-hard:last-route:${userId}`;
}

export type LaunchPlan = {
  /** Play the cold-open animation. */
  playIntro: boolean;
  /** Where to land once the cover lifts. */
  destination: RestorableRoute;
};

/**
 * Decides the launch sequence.
 *
 * The first open of a day gets the full treatment and lands on Today — that
 * launch is about the day ahead, so coming back to Settings because that is
 * where you happened to be last night would be strange. Every later open that
 * day skips the animation and returns you to where you were.
 */
export function planLaunch(input: {
  today: DayKey;
  /** The day the intro last played, or null if never. */
  introLastShown: DayKey | null;
  /** The last top-level route visited, or null if none stored. */
  lastRoute: string | null;
}): LaunchPlan {
  const firstToday = input.introLastShown !== input.today;

  if (firstToday) {
    return { playIntro: true, destination: '/' };
  }

  return {
    playIntro: false,
    destination: isRestorableRoute(input.lastRoute) ? input.lastRoute : '/',
  };
}
