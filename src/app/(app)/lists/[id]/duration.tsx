import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Screen, Spacer } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, MonoLabel } from '@/components/ui-kit';
import { Colors, DurationPresets, Spacing } from '@/constants/theme';
import { useActivateList, useLists, useProfile } from '@/hooks/use-work-hard';
import { clampDuration } from '@/lib/run-logic';

/** Design 1g — how many consecutive days. */
export default function DurationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: lists } = useLists();
  const { data: profile } = useProfile();
  const activate = useActivateList();

  const [days, setDays] = useState(60);
  const list = lists?.find((l) => l.id === id);

  if (!list) {
    return (
      <Screen>
        <MonoLabel>List not found</MonoLabel>
      </Screen>
    );
  }

  function begin() {
    if (!list || !profile) return;
    activate.mutate(
      { list, durationDays: days, profile },
      {
        onSuccess: () => router.dismissTo('/'),
        onError: (error) => Alert.alert('Could not start the run', error.message),
      },
    );
  }

  return (
    <Screen>
      <Pressable hitSlop={8} onPress={() => router.back()}>
        <ThemedText type="monoValue" themeColor="textSecondary">
          Back
        </ThemedText>
      </Pressable>

      <ThemedText type="screenTitle" style={styles.heading}>
        How many consecutive days?
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
        {`${list.name} · ${list.tasks.length} task${list.tasks.length === 1 ? '' : 's'}`}
      </ThemedText>

      <View style={styles.stepper}>
        <Stepper label="−" onPress={() => setDays((d) => clampDuration(d - 1))} />
        <ThemedText type="display" style={styles.count}>
          {days}
        </ThemedText>
        <Stepper label="+" onPress={() => setDays((d) => clampDuration(d + 1))} />
      </View>
      <MonoLabel small style={styles.unit}>
        consecutive days
      </MonoLabel>

      <View style={styles.presets}>
        {DurationPresets.map((preset) => {
          const selected = preset === days;
          return (
            <Pressable
              key={preset}
              onPress={() => setDays(preset)}
              style={[styles.preset, selected && styles.presetSelected]}>
              <ThemedText
                type="monoValue"
                themeColor={selected ? 'background' : 'text'}
                style={styles.presetLabel}>
                {preset}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <Spacer />

      <View style={styles.warning}>
        <ThemedText type="small">
          Miss one task on one day and the run is over. You start again at day 1.
        </ThemedText>
      </View>

      <Button
        label={activate.isPending ? 'Starting…' : 'Begin day 1'}
        disabled={activate.isPending || !profile}
        onPress={begin}
        style={styles.begin}
      />
    </Screen>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Add a day' : 'Remove a day'}
      onPress={onPress}
      style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
      <ThemedText style={styles.stepperLabel}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: 48, lineHeight: 38 },
  sub: { marginTop: 6 },
  stepper: {
    marginTop: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  stepperButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.dark.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: {
    fontSize: 26,
    lineHeight: 30,
  },
  count: {
    fontSize: 96,
    lineHeight: 96,
    minWidth: 150,
    textAlign: 'center',
  },
  unit: {
    marginTop: Spacing.two,
    textAlign: 'center',
    letterSpacing: 1.76,
  },
  presets: {
    marginTop: 40,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  preset: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.borderStrong,
    alignItems: 'center',
  },
  presetSelected: {
    backgroundColor: Colors.dark.text,
    borderColor: Colors.dark.text,
  },
  presetLabel: {
    fontSize: 14,
  },
  warning: {
    padding: Spacing.three,
    borderLeftWidth: 1,
    borderLeftColor: Colors.dark.text,
  },
  begin: {
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
