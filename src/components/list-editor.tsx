import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GripVertical, IconStroke } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, MonoLabel, SectionHeader } from '@/components/ui-kit';
import { Colors, Gutter, MaxTasksPerList, Spacing } from '@/constants/theme';

/**
 * A task while it is being edited.
 *
 * Tasks carry a client-minted id rather than being addressed by array index:
 * both the drag and the swipe need an identity that survives a reorder, and an
 * index does not. Ids come from the same `Crypto.randomUUID()` that `api.ts`
 * uses when it writes rows.
 */
type DraftTask = {
  id: string;
  name: string;
};

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

function toDrafts(names: string[]): DraftTask[] {
  return names.map((name) => ({ id: Crypto.randomUUID(), name }));
}

/**
 * Design 2d — the only place a list's contents change.
 *
 * `ReorderableList` is a FlatList, so it owns the scrolling for this screen:
 * the name field sits in the header, the save buttons in the footer.
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
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [tasks, setTasks] = useState<DraftTask[]>(() => toDrafts(initialTasks));

  const filled = useMemo(() => tasks.map((t) => t.name.trim()).filter(Boolean), [tasks]);
  const canSave = name.trim().length > 0 && filled.length > 0 && !saving && !locked;

  const setTaskName = useCallback((id: string, value: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, name: value } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  function addTask() {
    if (tasks.length >= MaxTasksPerList) return;
    setTasks((prev) => [...prev, { id: Crypto.randomUUID(), name: '' }]);
  }

  const handleReorder = useCallback(({ from, to }: ReorderableListReorderEvent) => {
    setTasks((prev) => reorderItems(prev, from, to));
  }, []);

  function confirmArchive() {
    if (!onArchive) return;
    Alert.alert('Archive this list?', 'It moves to the archive. You can bring it back later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: onArchive },
    ]);
  }

  const header = (
    <View style={styles.header}>
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
      {!locked && tasks.length > 1 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Hold the handle to reorder · swipe a task left to delete
        </ThemedText>
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      <Pressable
        disabled={tasks.length >= MaxTasksPerList || locked}
        onPress={addTask}
        style={styles.addTask}>
        <ThemedText
          type="body"
          style={tasks.length >= MaxTasksPerList ? styles.addTaskFull : styles.addTaskLabel}>
          {tasks.length >= MaxTasksPerList ? `${MaxTasksPerList} tasks is the limit` : '+ Add task'}
        </ThemedText>
      </Pressable>

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
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ReorderableList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.four },
        ]}
        data={tasks}
        keyExtractor={(item) => item.id}
        onReorder={handleReorder}
        dragEnabled={!locked}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TaskEditorRow
            task={item}
            locked={!!locked}
            onChangeName={setTaskName}
            onDelete={removeTask}
          />
        )}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * One editable task.
 *
 * Two gestures live on this row and are kept apart deliberately: the drag only
 * starts from the grip handle, the swipe only from the row body. Letting both
 * listen to the whole row makes them fight over every horizontal movement.
 */
function TaskEditorRow({
  task,
  locked,
  onChangeName,
  onDelete,
}: {
  task: DraftTask;
  locked: boolean;
  onChangeName: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const drag = useReorderableDrag();

  const renderRightActions = useCallback(
    () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.name || 'task'}`}
        onPress={() => onDelete(task.id)}
        style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}>
        <ThemedText type="body" style={styles.deleteLabel}>
          Delete
        </ThemedText>
      </Pressable>
    ),
    [task.id, task.name, onDelete],
  );

  return (
    <ReanimatedSwipeable
      enabled={!locked}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      containerStyle={styles.swipeContainer}>
      <View style={styles.taskRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${task.name || 'task'}`}
          disabled={locked}
          onLongPress={drag}
          delayLongPress={200}
          hitSlop={8}
          style={({ pressed }) => [styles.grip, pressed && styles.gripPressed]}>
          <GripVertical size={18} color={Colors.dark.textSecondary} strokeWidth={IconStroke} />
        </Pressable>

        <Field
          value={task.name}
          onChangeText={(value) => onChangeName(task.id, value)}
          placeholder="Read 10 pages"
          editable={!locked}
          maxLength={120}
          style={styles.taskField}
        />
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    paddingHorizontal: Gutter.narrow,
  },
  header: {
    marginBottom: Spacing.two,
  },
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
  hint: {
    marginBottom: Spacing.two,
    fontSize: 12,
  },
  swipeContainer: {
    borderRadius: 10,
    marginBottom: Spacing.two,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grip: {
    paddingVertical: Spacing.two,
    paddingRight: Spacing.half,
  },
  gripPressed: {
    opacity: 0.5,
  },
  taskField: {
    flex: 1,
  },
  // Sits inside the row's own bounds, flush to its right edge.
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.dark.danger,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  deleteActionPressed: {
    opacity: 0.8,
  },
  deleteLabel: {
    color: '#ffffff',
  },
  footer: {
    marginTop: Spacing.two,
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
