import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, MonoLabel } from '@/components/ui-kit';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth';

/** Design 1e — sign in / sign up. */
export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const creating = mode === 'signUp';

  async function submit() {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Enter an email and a password.');
      return;
    }
    if (creating && password.length < 6) {
      setError('Passwords must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      if (creating) {
        await signUp(email, password);
        // With email confirmation on, no session arrives until the link is
        // clicked, so say so rather than appearing to hang.
        setNotice('Check your email to confirm the account, then sign in.');
        setMode('signIn');
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll contentStyle={styles.content}>
        <MonoLabel bright>Work Hard</MonoLabel>

        <ThemedText type="screenTitle" style={styles.heading}>
          {creating ? 'Create an account.' : 'Welcome back.'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
          Your streak lives on the server. A new phone will not reset it.
        </ThemedText>

        <View style={styles.fields}>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
          />
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
            textContentType={creating ? 'newPassword' : 'password'}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </View>

        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
        {notice ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
            {notice}
          </ThemedText>
        ) : null}

        <Button
          label={busy ? 'Working…' : 'Continue'}
          onPress={submit}
          disabled={busy}
          style={styles.submit}
        />

        <Pressable onPress={() => setMode(creating ? 'signIn' : 'signUp')}>
          <MonoLabel style={styles.switcher}>
            {creating ? 'I already have an account' : 'Create an account instead'}
          </MonoLabel>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.rule} />
          <MonoLabel small>or</MonoLabel>
          <View style={styles.rule} />
        </View>

        {/*
          Apple and Google sign-in need native modules and a development build,
          so they are visible but inert until that phase. See the plan's Phase 5.
        */}
        <View style={styles.oauth}>
          <Button label="Continue with Apple" variant="outline" disabled />
          <Button label="Continue with Google" variant="outline" disabled />
        </View>
        <MonoLabel small style={styles.oauthNote}>
          Apple and Google sign-in need a development build
        </MonoLabel>

        <ThemedText type="small" themeColor="textSecondary" style={styles.terms}>
          By continuing you accept the Terms and Privacy Policy.
        </ThemedText>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  heading: { marginTop: 56, lineHeight: 38 },
  sub: { marginTop: Spacing.two },
  fields: { marginTop: Spacing.five, gap: Spacing.two },
  error: { marginTop: Spacing.three, color: Colors.dark.danger },
  notice: { marginTop: Spacing.three },
  submit: { marginTop: Spacing.three },
  switcher: { marginTop: Spacing.three, textAlign: 'center' },
  divider: {
    marginVertical: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rule: { flex: 1, height: 1, backgroundColor: Colors.dark.border },
  oauth: { gap: Spacing.two },
  oauthNote: { marginTop: Spacing.two, textAlign: 'center' },
  terms: { marginTop: Spacing.five, textAlign: 'center' },
});
