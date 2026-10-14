import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { TZDate } from '@date-fns/tz';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { GLYPH_KINDS, GLYPH_LABELS, Glyph, type GlyphKind } from '@/components/glyph';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  CardDivider,
  DetailRow,
  MonoLabel,
  PickerSheet,
  SwitchRow,
  type PickerOption,
} from '@/components/ui-kit';
import { Colors, Gutter, Spacing } from '@/constants/theme';
import { deviceTimezone, listTimezones } from '@/constants/timezones';
import {
  useActiveRun,
  useHistory,
  useProfile,
  useQuotes,
  useRuns,
  useUpdateProfile,
} from '@/hooks/use-work-hard';
import { normaliseDayEndsAt } from '@/lib/api';
import { hasReminderPermission, requestReminderPermission } from '@/lib/notifications';
import { useAuth } from '@/providers/auth';

/** Which modal is open, if any. */
type OpenSheet = 'dayEndsAt' | 'timezone' | 'reminder' | null;

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
      <RunGroup />

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

      {/*
        Side by side, but deliberately not adjacent: a wide gap and two different
        treatments, because the right-hand one is irreversible and the left-hand
        one is routine. A thumb should not be able to slip from one to the other.
      */}
      <View style={styles.accountActions}>
        <Button
          label="Sign out"
          variant="outline"
          fill
          onPress={() =>
            Alert.alert('Sign out?', 'Your streak stays on the server.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
        <DeleteAccountButton />
      </View>

      <MonoLabel small style={styles.version}>
        {`Work Hard ${Constants.expoConfig?.version ?? '1.0.0'}`}
      </MonoLabel>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * Day boundary, timezone and reminder.
 *
 * All three write straight to `profiles`. Note that the first two cannot reach
 * a run already in progress: `runs` snapshots `timezone` and `day_ends_at` at
 * activation, deliberately, because moving a day boundary mid-run can
 * retroactively turn a completed day into a failed one. The note at the bottom
 * says so, otherwise the setting looks broken.
 */
function RunGroup() {
  const { data: profile } = useProfile();
  const { data: activeRun } = useActiveRun();
  const updateProfile = useUpdateProfile();

  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    void hasReminderPermission().then(setNotificationsAllowed);
  }, []);

  const dayEndsAt = profile?.day_ends_at ? normaliseDayEndsAt(profile.day_ends_at) : '00:00';
  const reminderAt = profile?.reminder_at ? normaliseDayEndsAt(profile.reminder_at) : null;

  const reminderValue = !reminderAt
    ? 'Off'
    : notificationsAllowed === false
      ? 'Notifications blocked'
      : formatTime(reminderAt);

  async function setReminder(time: string) {
    // Permission is only ever asked for here — at the moment the user actually
    // wants a notification, not cold at launch.
    const result = await requestReminderPermission();
    setNotificationsAllowed(result === 'granted');
    updateProfile.mutate({ reminder_at: time });

    if (result === 'denied') {
      Alert.alert(
        'Notifications are off',
        'The time is saved, but nothing can be delivered until you allow notifications for Work Hard in your phone settings.',
      );
    }
  }

  return (
    <>
      <Card style={styles.grouped}>
        <DetailRow
          label="Day ends at"
          value={formatTime(dayEndsAt)}
          onPress={() => setSheet('dayEndsAt')}
        />
        <CardDivider />
        <DetailRow
          label="Time zone"
          value={profile?.timezone ?? '—'}
          onPress={() => setSheet('timezone')}
        />
        <CardDivider />
        <DetailRow label="Reminder" value={reminderValue} onPress={() => setSheet('reminder')} />
        <CardDivider />
        <SwitchRow
          label="Daily quote"
          value={profile?.show_daily_quote !== false}
          onValueChange={(next) => updateProfile.mutate({ show_daily_quote: next })}
        />
        <CardDivider />
        <QuoteManagementRow />
      </Card>

      {activeRun ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.lockedNote}>
          {`${activeRun.list_name} is using ${formatTime(
            normaliseDayEndsAt(activeRun.day_ends_at),
          )} · ${activeRun.timezone} until the run ends. Changes here apply to your next run.`}
        </ThemedText>
      ) : null}

      <TimeSheet
        visible={sheet === 'dayEndsAt'}
        title="Day ends at"
        value={dayEndsAt}
        helpText="Tasks must be done before this time. Most people leave it at midnight."
        onClose={() => setSheet(null)}
        onSave={(time) => {
          updateProfile.mutate({ day_ends_at: time });
          setSheet(null);
        }}
      />

      <TimeSheet
        visible={sheet === 'reminder'}
        title="Reminder"
        value={reminderAt ?? '20:00'}
        helpText="A daily nudge while a run is active. Skipped on days you have already finished."
        clearLabel={reminderAt ? 'Turn reminder off' : undefined}
        onClear={() => {
          updateProfile.mutate({ reminder_at: null });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        onSave={(time) => {
          void setReminder(time);
          setSheet(null);
        }}
      />

      <TimezoneSheet
        visible={sheet === 'timezone'}
        selected={profile?.timezone ?? null}
        onClose={() => setSheet(null)}
        onSelect={(zone) => {
          updateProfile.mutate({ timezone: zone });
          setSheet(null);
        }}
      />
    </>
  );
}

/**
 * A modal wrapping the native time picker.
 *
 * `@expo/ui`'s DateTimePicker is an inline native view rather than a dialog, so
 * the modal and the Save button are ours. Held in local state until Save so a
 * spin through the wheel does not fire a write per intermediate value.
 */
function TimeSheet({
  visible,
  title,
  value,
  helpText,
  clearLabel,
  onClear,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  value: string;
  helpText: string;
  clearLabel?: string;
  onClear?: () => void;
  onClose: () => void;
  onSave: (time: string) => void;
}) {
  const [draft, setDraft] = useState(() => timeToDate(value));

  // Re-seed each time it opens, so it always starts from the stored value.
  useEffect(() => {
    if (visible) setDraft(timeToDate(value));
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <MonoLabel small bright>
              {title}
            </MonoLabel>
            <Pressable hitSlop={10} onPress={onClose}>
              <MonoLabel small>Cancel</MonoLabel>
            </Pressable>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.sheetHelp}>
            {helpText}
          </ThemedText>

          <View style={styles.pickerHost}>
            <DateTimePicker
              mode="time"
              display="spinner"
              value={draft}
              themeVariant="dark"
              accentColor={Colors.dark.text}
              onValueChange={(_event, date) => setDraft(date)}
            />
          </View>

          <Button label="Save" onPress={() => onSave(dateToTime(draft))} />
          {clearLabel && onClear ? (
            <Button
              label={clearLabel}
              variant="quiet"
              style={styles.sheetSecondary}
              onPress={onClear}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function TimezoneSheet({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: string | null;
  onClose: () => void;
  onSelect: (zone: string) => void;
}) {
  // Built once: the full list can run to several hundred entries.
  const options = useMemo<PickerOption[]>(() => {
    const device = deviceTimezone();
    return listTimezones().map((zone, index) => ({
      value: zone,
      label: zone.replace(/_/g, ' '),
      detail: offsetLabel(zone),
      section: index === 0 && zone === device ? 'Device' : 'All time zones',
    }));
  }, []);

  return (
    <PickerSheet
      visible={visible}
      title="Time zone"
      options={options}
      selected={selected}
      searchable
      searchPlaceholder="Search time zones"
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}

// ---------------------------------------------------------------------------
// Other rows
// ---------------------------------------------------------------------------

/** Entry point to the quote library. Slides in from the right. */
function QuoteManagementRow() {
  const router = useRouter();
  const { data: quotes } = useQuotes();

  return (
    <DetailRow
      label="Quote management"
      value={quotes ? String(quotes.length) : undefined}
      onPress={() => router.push('/quotes')}
    />
  );
}

/**
 * Permanent account deletion.
 *
 * Required inside the app by App Store Review Guideline 5.1.1(v) — a support
 * email does not satisfy it. Two steps rather than one, because it cannot be
 * undone, but no further than two: Apple also expects deletion to be reachable
 * rather than buried.
 */
function DeleteAccountButton() {
  const { deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  function confirm() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your account, every list, your whole run history and all of your quotes. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Last chance', 'There is no way to recover any of this.', [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => void run() },
            ]),
        },
      ],
    );
  }

  async function run() {
    setBusy(true);
    try {
      await deleteAccount();
      // No navigation needed: the auth gate sends us to sign-in once the
      // session clears.
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Could not delete your account',
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <Button
      label={busy ? 'Deleting\u2026' : 'Delete account'}
      variant="danger"
      fill
      disabled={busy}
      onPress={confirm}
    />
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

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Postgres hands back `HH:MM:SS`; render it the way the mockup does. */
function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}

/** `HH:MM` to a Date today, which is what the native picker wants. */
function timeToDate(time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date;
}

function dateToTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "UTC-4" / "UTC+5:30", to orient someone scanning a long zone list. */
function offsetLabel(zone: string): string {
  try {
    // TZDate's getTimezoneOffset reports the offset of *its* zone, using the
    // same negative-east convention as Date.
    const minutes = -new TZDate(new Date(), zone).getTimezoneOffset();
    const sign = minutes < 0 ? '-' : '+';
    const absolute = Math.abs(minutes);
    const hours = Math.floor(absolute / 60);
    const rest = absolute % 60;
    return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
  } catch {
    return '';
  }
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
  lockedNote: {
    marginTop: Spacing.two,
  },
  accountActions: {
    marginTop: Spacing.five,
    flexDirection: 'row',
    // Wider than the usual Spacing.two between sibling buttons. The extra
    // separation is the point: one of these cannot be undone.
    gap: Spacing.four,
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
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetCard: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.dark.borderStrong,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetHelp: {
    marginTop: Spacing.two,
  },
  pickerHost: {
    marginVertical: Spacing.three,
    alignItems: 'center',
  },
  sheetSecondary: {
    marginTop: Spacing.two,
  },
});
