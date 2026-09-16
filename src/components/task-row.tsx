import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph, type GlyphKind } from '@/components/glyph';
import { ThemedText } from '@/components/themed-text';
import { Colors, CompletedRowOpacity, Spacing } from '@/constants/theme';

export type TaskRowProps = {
  name: string;
  done: boolean;
  glyph: GlyphKind;
  onToggle: () => void;
  /** Suppresses the toggle once a run has ended. */
  disabled?: boolean;
};

/**
 * A single task on Today. Tapping anywhere on the row strikes it through and
 * fades it — the design's whole completion interaction.
 */
export function TaskRow({ name, done, glyph, onToggle, disabled }: TaskRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !!disabled }}
      accessibilityLabel={name}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        { opacity: done ? CompletedRowOpacity : 1 },
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={styles.glyph}>
        <Glyph kind={glyph} size={26} />
      </View>
      <ThemedText type="taskRow" style={[styles.label, done && styles.labelDone]}>
        {name}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  glyph: {
    width: 26,
    height: 26,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  labelDone: {
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.6,
  },
});
