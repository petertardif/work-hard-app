import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, onlineManager } from '@tanstack/react-query';

import { setCompletion } from '@/lib/api';

/**
 * Teach TanStack Query what "online" means on a phone. Without this it assumes
 * a browser's `navigator.onLine` and never pauses anything.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  }),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Must outlive the persisted cache's max age or restored entries are
      // dropped on the way back in.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      staleTime: 1000 * 30,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Mutation defaults keyed by `mutationKey`.
 *
 * This is what lets a write survive the app being killed: a mutation paused
 * while offline is rehydrated from storage with no function attached, and
 * TanStack looks the function up here to resume it.
 */
queryClient.setMutationDefaults(['setCompletion'], {
  mutationFn: setCompletion,
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'work-hard-query-cache',
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
  // Bump when a cached shape changes, to discard stale entries on upgrade.
  buster: 'v1',
};

export const queryKeys = {
  profile: ['profile'] as const,
  lists: ['lists'] as const,
  runs: ['runs'] as const,
  activeRun: ['runs', 'active'] as const,
  completions: (runId: string) => ['completions', runId] as const,
};
