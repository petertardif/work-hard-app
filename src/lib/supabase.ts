import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;

/**
 * The client-side key, under any of the names it travels by.
 *
 * `EXPO_PUBLIC_SUPABASE_KEY` is what Supabase's own Connect dialog emits;
 * `..._PUBLISHABLE_KEY` and `..._ANON_KEY` are accepted too, since Supabase is
 * mid-way through retiring the `anon` name in favour of the publishable one
 * (`sb_publishable_…`) and older projects still issue the legacy JWT.
 */
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once the project's credentials are present. The app renders a setup
 * notice instead of a sign-in form when they are missing, which is friendlier
 * than a bundler-time crash on a fresh clone.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'missing-key', {
  auth: {
    // Sessions live in AsyncStorage; React Native has no localStorage.
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // There is no URL to parse a session out of outside the browser.
    detectSessionInUrl: false,
  },
});

/**
 * Supabase refreshes tokens on a timer, which iOS and Android suspend in the
 * background. Tying the timer to foreground state stops it firing uselessly
 * and makes sure a returning app refreshes immediately.
 */
AppState.addEventListener('change', (state) => {
  if (!isSupabaseConfigured) return;
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
