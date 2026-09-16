import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** False until the stored session has been read back from AsyncStorage. */
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    // Tracked so a genuine account switch can be told apart from a session
    // being restored at launch or a routine token refresh.
    let lastUserId: string | null = null;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      lastUserId = data.session?.user.id ?? null;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextUserId = next?.user.id ?? null;

      // Never let one account's cached rows show up under another's — but only
      // clear on an actual change of user. Clearing indiscriminately would also
      // throw away completions queued offline, since the mutation cache is
      // persisted alongside the queries.
      if (lastUserId !== null && nextUserId !== lastUserId) {
        queryClient.clear();
      }

      lastUserId = nextUserId;
      setSession(next);
      setReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      ready,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);
      },
      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(error.message);
      },
      async signOut() {
        await supabase.auth.signOut();
        // Explicit sign-out is the one place a full wipe is unambiguously right.
        queryClient.clear();
      },
    }),
    [session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
