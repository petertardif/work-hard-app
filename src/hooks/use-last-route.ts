/**
 * Remembers the last top-level screen, so a later open that day returns to it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { isRestorableRoute, lastRouteStorageKey } from '@/lib/launch';

/**
 * Writes the current route to storage whenever it is one worth returning to.
 *
 * Deeper screens are ignored rather than cleared: walking into the list editor
 * and backing out again should leave Lists remembered, not reset to Today.
 */
export function useLastRoute(userId: string | null): void {
  const pathname = usePathname();

  useEffect(() => {
    if (!userId) return;
    if (!isRestorableRoute(pathname)) return;

    void AsyncStorage.setItem(lastRouteStorageKey(userId), pathname).catch(() => {
      // Worst case the next launch opens on Today. Not worth surfacing.
    });
  }, [userId, pathname]);
}
