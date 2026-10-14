import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, MonoLabel } from '@/components/ui-kit';
import { LegalUrls, LegalUrlsConfigured } from '@/constants/legal';
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

  const openPrivacy = () => void Linking.openURL(LegalUrls.privacyPolicy);
  const openTerms = () => void Linking.openURL(LegalUrls.termsOfService);

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

        {/*
          Email and password only, deliberately. App Store Guideline 4.8 requires
          an equivalent privacy-focused option alongside any third-party login,
          so adding Google would oblige us to add Sign in with Apple too. Not
          offering either keeps 4.8 out of scope entirely.
        */}

        {LegalUrlsConfigured ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.terms}>
            By continuing you accept the{' '}
            <ThemedText type="small" style={styles.link} onPress={openTerms}>
              Terms
            </ThemedText>{' '}
            and{' '}
            <ThemedText type="small" style={styles.link} onPress={openPrivacy}>
              Privacy Policy
            </ThemedText>
            .
          </ThemedText>
        ) : null}
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
  link: { textDecorationLine: 'underline' },
  terms: { marginTop: Spacing.five, textAlign: 'center' },
});
