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
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ColdOpen } from '@/components/cold-open';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MonoLabel } from '@/components/ui-kit';
import { Colors, Spacing } from '@/constants/theme';
import { syncServerClock } from '@/lib/api';
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
 * Redirects between the signed-out and signed-in route groups, and plays the
 * cold open over the top while the stored session is still being read.
 */
function AuthGate() {
  const { session, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [introDone, setIntroDone] = useState(false);

  const handleIntroDone = useCallback(() => setIntroDone(true), []);

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [ready, session, segments, router]);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, contentStyle: styles.root }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
      </Stack>
      {!introDone || !ready ? <ColdOpen onDone={handleIntroDone} /> : null}
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
        EXPO_PUBLIC_SUPABASE_ANON_KEY from your Supabase project, then restart the dev
        server with `npx expo start --clear`.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  setupTitle: {
    marginTop: Spacing.three,
  },
  setupBody: {
    marginTop: Spacing.two,
  },
});
