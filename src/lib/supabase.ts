import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once the project's credentials are present. The app renders a setup
 * notice instead of a sign-in form when they are missing, which is friendlier
 * than a bundler-time crash on a fresh clone.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-anon-key', {
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
