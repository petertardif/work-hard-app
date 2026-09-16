import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Screen, Spacer } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, MonoLabel, SectionHeader } from '@/components/ui-kit';
import { Colors, Gutter, MaxTasksPerList, Spacing } from '@/constants/theme';

export type ListEditorProps = {
  heading: string;
  initialName?: string;
  initialTasks?: string[];
  saving?: boolean;
  /** Absent when creating — there is nothing to archive yet. */
  onArchive?: () => void;
  onSave: (name: string, tasks: string[]) => void;
  /** Shown when the list is locked because its run is active. */
  locked?: boolean;
};

/**
 * Design 2d — the only place a list's contents change.
 *
 * The mockup draws a drag handle on each row. Drag-to-reorder needs a gesture
 * layer that is not worth its complexity here, so the handle is replaced with
 * explicit up/down controls — same capability, visibly different from the
 * mockup. Worth revisiting if reordering turns out to matter.
 */
export function ListEditor({
  heading,
  initialName = '',
  initialTasks = [],
  saving,
  onArchive,
  onSave,
  locked,
}: ListEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [tasks, setTasks] = useState<string[]>(initialTasks);

  const filled = tasks.map((t) => t.trim()).filter(Boolean);
  const canSave = name.trim().length > 0 && filled.length > 0 && !saving && !locked;

  function setTask(index: number, value: string) {
    setTasks((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addTask() {
    if (tasks.length >= MaxTasksPerList) return;
    setTasks((prev) => [...prev, '']);
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= tasks.length) return;
    setTasks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function confirmArchive() {
    if (!onArchive) return;
    Alert.alert('Archive this list?', 'It moves to the archive. You can bring it back later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: onArchive },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll gutter={Gutter.narrow} contentStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <ThemedText type="monoValue" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
          <MonoLabel small bright>
            {heading}
          </MonoLabel>
          {/* Balances the row so the heading stays optically centred. */}
          <ThemedText type="monoValue" style={styles.topBarGhost}>
            Cancel
          </ThemedText>
        </View>

        {locked ? (
          <View style={styles.lockedNote}>
            <ThemedText type="small" themeColor="textSecondary">
              This list is running. End the run from Lists before editing it.
            </ThemedText>
          </View>
        ) : null}

        <MonoLabel small style={styles.label}>
          List name
        </MonoLabel>
        <Field
          large
          value={name}
          onChangeText={setName}
          placeholder="Winter Block"
          editable={!locked}
          maxLength={80}
        />

        <SectionHeader
          title="Daily tasks"
          value={`${filled.length} / ${MaxTasksPerList}`}
          style={styles.label}
        />

        <View>
          {tasks.map((task, index) => (
            <View key={index} style={styles.taskRow}>
              <View style={styles.reorder}>
                <Pressable
                  hitSlop={6}
                  disabled={index === 0 || locked}
                  onPress={() => move(index, -1)}
                  style={index === 0 && styles.reorderDisabled}>
                  <ThemedText type="monoValue" themeColor="textSecondary">
                    ↑
                  </ThemedText>
                </Pressable>
                <Pressable
                  hitSlop={6}
                  disabled={index === tasks.length - 1 || locked}
                  onPress={() => move(index, 1)}
                  style={index === tasks.length - 1 && styles.reorderDisabled}>
                  <ThemedText type="monoValue" themeColor="textSecondary">
                    ↓
                  </ThemedText>
                </Pressable>
              </View>

              <Field
                value={task}
                onChangeText={(value) => setTask(index, value)}
                placeholder="Read 10 pages"
                editable={!locked}
                maxLength={120}
                style={styles.taskField}
              />

              <Pressable hitSlop={8} disabled={locked} onPress={() => removeTask(index)}>
                <ThemedText type="cardTitle" themeColor="textSecondary">
                  ×
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable
          disabled={tasks.length >= MaxTasksPerList || locked}
          onPress={addTask}
          style={styles.addTask}>
          <ThemedText
            type="body"
            style={tasks.length >= MaxTasksPerList ? styles.addTaskFull : styles.addTaskLabel}>
            {tasks.length >= MaxTasksPerList
              ? `${MaxTasksPerList} tasks is the limit`
              : '+ Add task'}
          </ThemedText>
        </Pressable>

        <Spacer />

        <View style={styles.actions}>
          {onArchive ? (
            <Button label="Archive list" variant="quiet" onPress={confirmArchive} />
          ) : null}
          <Button
            label={saving ? 'Saving…' : 'Save list'}
            disabled={!canSave}
            onPress={() => onSave(name.trim(), filled)}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarGhost: {
    opacity: 0,
  },
  lockedNote: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.borderStrong,
  },
  label: {
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  reorder: {
    gap: 2,
  },
  reorderDisabled: {
    opacity: 0.25,
  },
  taskField: {
    flex: 1,
  },
  addTask: {
    paddingVertical: Spacing.three,
  },
  addTaskLabel: {
    opacity: 0.5,
  },
  addTaskFull: {
    opacity: 0.5,
    fontSize: 13,
  },
  actions: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
});
