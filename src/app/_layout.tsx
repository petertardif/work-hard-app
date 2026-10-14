import {
  SplineSans_400Regular,
  SplineSans_500Medium,
  SplineSans_600SemiBold,
  SplineSans_700Bold,
} from '@expo-google-fonts/spline-sans';
import {
  SplineSansMono_500Medium,
  SplineSansMono_600SemiBold,
  SplineSansMono_700Bold,
} from '@expo-google-fonts/spline-sans-mono';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ColdOpen } from '@/components/cold-open';
import { DailyQuoteGate } from '@/components/daily-quote';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MonoLabel } from '@/components/ui-kit';
import { Colors, Spacing } from '@/constants/theme';
import { deviceTimezone } from '@/constants/timezones';
import { useLastRoute } from '@/hooks/use-last-route';
import { syncServerClock, todayKey } from '@/lib/api';
import {
  introStorageKey,
  lastRouteStorageKey,
  planLaunch,
  type LaunchPlan,
} from '@/lib/launch';
import { persistOptions, queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SplineSans_400Regular,
    SplineSans_500Medium,
    SplineSans_600SemiBold,
    SplineSans_700Bold,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
    SplineSansMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Learn the server's clock as early as possible so day boundaries are never
  // decided against an untrusted device clock.
  useEffect(() => {
    if (isSupabaseConfigured) void syncServerClock();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AuthProvider>
            <StatusBar style="light" />
            {isSupabaseConfigured ? <AuthGate /> : <SetupNotice />}
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Launch phases.
 *
 * `deciding` and `restoring` both paint an opaque black cover. That costs
 * nothing visually — the app is black anyway — and it is what stops the Today
 * screen being glimpsed before a restore navigates away from it.
 */
type LaunchPhase = 'deciding' | 'intro' | 'restoring' | 'done';

function AuthGate() {
  const { session, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const userId = session?.user.id ?? null;
  const inAuthGroup = segments[0] === '(auth)';

  const [phase, setPhase] = useState<LaunchPhase>('deciding');
  const [plan, setPlan] = useState<LaunchPlan | null>(null);
  const planned = useRef(false);

  useLastRoute(phase === 'done' ? userId : null);

  useEffect(() => {
    if (!ready) return;

    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [ready, session, inAuthGroup, router]);

  // Decide the sequence once, as soon as we know who (if anyone) is signed in.
  useEffect(() => {
    if (!ready || planned.current) return;

    // Signed out goes straight to the sign-in screen with no ceremony.
    if (!userId) {
      planned.current = true;
      setPhase('done');
      return;
    }

    planned.current = true;

    // The device's own clock decides which day this is, rather than the
    // profile's timezone. The intro is a flourish, not streak logic, and
    // waiting on a profile fetch to find out whether to play an animation
    // would delay the very thing it is meant to cover.
    const today = todayKey(deviceTimezone(), '00:00');

    void Promise.all([
      AsyncStorage.getItem(introStorageKey(userId)),
      AsyncStorage.getItem(lastRouteStorageKey(userId)),
    ])
      .then(([introLastShown, lastRoute]) => {
        const next = planLaunch({ today, introLastShown, lastRoute });
        setPlan(next);

        if (next.playIntro) {
          void AsyncStorage.setItem(introStorageKey(userId), today).catch(() => {});
          setPhase('intro');
        } else {
          setPhase('restoring');
        }
      })
      .catch(() => {
        // A failed read should not strand the user on a black screen.
        setPlan({ playIntro: false, destination: '/' });
        setPhase('restoring');
      });
  }, [ready, userId]);

  // Navigate to the remembered screen while the cover is still up.
  useEffect(() => {
    if (phase !== 'restoring' || !plan) return;

    if (plan.destination !== '/') {
      // Push rather than replace. Today is already the stack's initial route,
      // so pushing leaves it underneath — which matters because Settings' Done
      // button calls router.back(), and that does nothing on an empty stack.
      router.push(plan.destination);
    }

    setPhase('done');
  }, [phase, plan, router]);

  const handleIntroDone = useCallback(() => setPhase('restoring'), []);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, contentStyle: styles.root }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
      </Stack>

      {/*
        Order matters. The quote sits *between* the Stack and the cold open, so
        it is already painted opaque by the time the cold open unmounts — which
        is what stops the Today screen ever being seen loading. It renders
        nothing unless this is the user's first launch of the day.
      */}
      {!inAuthGroup ? <DailyQuoteGate userId={userId} /> : null}

      {phase === 'intro' ? <ColdOpen onDone={handleIntroDone} /> : null}

      {/* Plain black, indistinguishable from the app, covering the gap while
          the launch is decided and any restore navigation happens. */}
      {phase === 'deciding' || phase === 'restoring' || !ready ? (
        <View style={styles.cover} />
      ) : null}
    </View>
  );
}

/** Shown when `.env` has not been filled in yet — friendlier than a crash. */
function SetupNotice() {
  return (
    <Screen>
      <MonoLabel>Setup</MonoLabel>
      <ThemedText type="screenTitle" style={styles.setupTitle}>
        Supabase is not configured.
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.setupBody}>
        Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from your Supabase project, then restart
        the dev server with `npx expo start --clear`.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.dark.background,
  },
  setupTitle: {
    marginTop: Spacing.three,
  },
  setupBody: {
    marginTop: Spacing.two,
  },
});
