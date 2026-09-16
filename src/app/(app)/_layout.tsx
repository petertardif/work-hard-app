import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { Colors } from '@/constants/theme';
import { adjudicateRuns, syncServerClock } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export default function AppLayout() {
  useLaunchAdjudication();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

/**
 * Re-judges every active run against the server's clock, on launch and every
 * time the app comes back to the foreground.
 *
 * This is what catches a day that ended while the app was closed. It runs
 * before the user sees Today, so a dead run never renders as alive.
 */
function useLaunchAdjudication() {
  const qc = useQueryClient();

  const check = useCallback(async () => {
    try {
      await syncServerClock();
      await adjudicateRuns();
    } catch {
      // Offline. The locally projected status carries the UI until reconnect,
      // at which point refetchOnReconnect brings the server's verdict back.
      return;
    }
    void qc.invalidateQueries({ queryKey: queryKeys.activeRun });
    void qc.invalidateQueries({ queryKey: queryKeys.runs });
  }, [qc]);

  useEffect(() => {
    void check();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);
}
