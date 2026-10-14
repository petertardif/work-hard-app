/// <reference types="jest" />

import {
  RESTORABLE_ROUTES,
  introStorageKey,
  isRestorableRoute,
  lastRouteStorageKey,
  planLaunch,
} from '@/lib/launch';

describe('isRestorableRoute', () => {
  it('accepts the top-level screens', () => {
    for (const route of RESTORABLE_ROUTES) {
      expect(isRestorableRoute(route)).toBe(true);
    }
  });

  it('rejects screens holding unsaved draft state', () => {
    // Reopening these after a cold launch would look like lost work.
    expect(isRestorableRoute('/lists/new')).toBe(false);
    expect(isRestorableRoute('/lists/abc-123/edit')).toBe(false);
    expect(isRestorableRoute('/lists/abc-123/duration')).toBe(false);
  });

  it('rejects the auth screen and anything unknown', () => {
    expect(isRestorableRoute('/sign-in')).toBe(false);
    expect(isRestorableRoute('/_sitemap')).toBe(false);
    expect(isRestorableRoute('')).toBe(false);
    expect(isRestorableRoute(null)).toBe(false);
    expect(isRestorableRoute(undefined)).toBe(false);
  });
});

describe('planLaunch', () => {
  const TODAY = '2026-10-14';

  it('plays the intro on the first open of a day', () => {
    expect(planLaunch({ today: TODAY, introLastShown: null, lastRoute: null })).toEqual({
      playIntro: true,
      destination: '/',
    });
  });

  it('plays the intro again the next day', () => {
    expect(
      planLaunch({ today: TODAY, introLastShown: '2026-10-13', lastRoute: '/settings' }),
    ).toEqual({ playIntro: true, destination: '/' });
  });

  it('lands on Today on the first open, ignoring where you were', () => {
    // That launch is about the day ahead, not last night's browsing.
    const plan = planLaunch({ today: TODAY, introLastShown: null, lastRoute: '/settings' });
    expect(plan.destination).toBe('/');
  });

  it('skips the intro on a later open the same day', () => {
    expect(
      planLaunch({ today: TODAY, introLastShown: TODAY, lastRoute: '/lists' }),
    ).toEqual({ playIntro: false, destination: '/lists' });
  });

  it('returns you to each of the restorable screens', () => {
    for (const route of RESTORABLE_ROUTES) {
      expect(
        planLaunch({ today: TODAY, introLastShown: TODAY, lastRoute: route }).destination,
      ).toBe(route);
    }
  });

  it('falls back to Today when the stored route is not restorable', () => {
    for (const route of ['/lists/new', '/lists/x/edit', '/sign-in', 'nonsense']) {
      expect(
        planLaunch({ today: TODAY, introLastShown: TODAY, lastRoute: route }).destination,
      ).toBe('/');
    }
  });

  it('falls back to Today when nothing was stored', () => {
    expect(
      planLaunch({ today: TODAY, introLastShown: TODAY, lastRoute: null }).destination,
    ).toBe('/');
  });
});

describe('storage keys', () => {
  it('scopes both keys per user', () => {
    expect(introStorageKey('a')).not.toBe(introStorageKey('b'));
    expect(lastRouteStorageKey('a')).not.toBe(lastRouteStorageKey('b'));
  });

  it('keeps the intro and route keys distinct', () => {
    expect(introStorageKey('a')).not.toBe(lastRouteStorageKey('a'));
  });
});
