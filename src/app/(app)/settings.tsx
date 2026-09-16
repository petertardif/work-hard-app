import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { GLYPH_KINDS, GLYPH_LABELS, Glyph, type GlyphKind } from '@/components/glyph';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, CardDivider, DetailRow, MonoLabel } from '@/components/ui-kit';
import { Colors, Gutter, Spacing } from '@/constants/theme';
import { useHistory, useProfile, useRuns, useUpdateProfile } from '@/hooks/use-work-hard';
import { useAuth } from '@/providers/auth';

/** Design 2e — sign out lives at the bottom. */
export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { attempts, bestRun } = useHistory();

  return (
    <Screen scroll gutter={Gutter.narrow}>
      <View style={styles.titleRow}>
        <ThemedText type="screenTitle">Settings</ThemedText>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <MonoLabel>Done</MonoLabel>
        </Pressable>
      </View>

      <MonoLabel small style={styles.section}>
        Account
      </MonoLabel>
      <Card style={styles.grouped}>
        <DetailRow label="Email" value={session?.user.email ?? '—'} />
      </Card>

      <MonoLabel small style={styles.section}>
        Mark
      </MonoLabel>
      <GlyphPicker current={profile?.glyph ?? 'ant'} />

      <MonoLabel small style={styles.section}>
        The run
      </MonoLabel>
      <Card style={styles.grouped}>
        <DetailRow label="Day ends at" value={formatTime(profile?.day_ends_at)} />
        <CardDivider />
        <DetailRow label="Time zone" value={profile?.timezone ?? '—'} />
        <CardDivider />
        <DetailRow label="Reminder" value={profile?.reminder_at ? formatTime(profile.reminder_at) : 'Off'} />
      </Card>
      <MonoLabel small style={styles.note}>
        Editing these is not wired up yet
      </MonoLabel>

      <MonoLabel small style={styles.section}>
        History
      </MonoLabel>
      <Card style={styles.grouped}>
        <DetailRow label="Attempts" value={String(attempts)} />
        <CardDivider />
        <DetailRow label="Best run" value={`${bestRun} day${bestRun === 1 ? '' : 's'}`} />
        <CardDivider />
        <ExportRow />
      </Card>

      <Card style={[styles.grouped, styles.danger]}>
        <DetailRow
          label="Sign out"
          onPress={() =>
            Alert.alert('Sign out?', 'Your streak stays on the server.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
        <CardDivider />
        <DetailRow
          label="Delete account"
          onPress={() =>
            Alert.alert(
              'Delete account',
              'Account deletion needs a server-side endpoint with the service-role key, which is not built yet. Contact support for now.',
            )
          }
        />
      </Card>

      <MonoLabel small style={styles.version}>
        {`Work Hard ${Constants.expoConfig?.version ?? '1.0.0'}`}
      </MonoLabel>
    </Screen>
  );
}

function GlyphPicker({ current }: { current: GlyphKind }) {
  const updateProfile = useUpdateProfile();

  return (
    <View style={styles.glyphRow}>
      {GLYPH_KINDS.map((kind) => {
        const selected = kind === current;
        return (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={GLYPH_LABELS[kind]}
            onPress={() => updateProfile.mutate({ glyph: kind })}
            style={[styles.glyphTile, selected && styles.glyphTileSelected]}>
            <Glyph kind={kind} size={28} />
            <MonoLabel small style={styles.glyphLabel}>
              {GLYPH_LABELS[kind]}
            </MonoLabel>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Copies the full run history to the clipboard as JSON. */
function ExportRow() {
  const { data: runs } = useRuns();

  async function exportData() {
    const payload = JSON.stringify(runs ?? [], null, 2);
    await Clipboard.setStringAsync(payload);
    Alert.alert('Copied', `${runs?.length ?? 0} run(s) copied to the clipboard as JSON.`);
  }

  return <DetailRow label="Export data" onPress={() => void exportData()} />;
}

/** Postgres hands back `HH:MM:SS`; render it the way the mockup does. */
function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  section: {
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  grouped: {
    padding: 0,
  },
  note: {
    marginTop: Spacing.two,
  },
  danger: {
    marginTop: Spacing.five,
  },
  glyphRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  glyphTile: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.borderStrong,
    alignItems: 'center',
    gap: Spacing.two,
  },
  glyphTileSelected: {
    borderColor: Colors.dark.text,
  },
  glyphLabel: {
    fontSize: 9,
    letterSpacing: 0.9,
  },
  version: {
    marginTop: Spacing.five,
    textAlign: 'center',
  },
});
