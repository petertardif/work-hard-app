import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, MonoLabel } from '@/components/ui-kit';
import { Colors, Gutter, Spacing } from '@/constants/theme';
import { useCreateQuote, useDeleteQuote, useQuotes, useUpdateQuote } from '@/hooks/use-work-hard';
import type { DbQuote } from '@/lib/database.types';
import { MaxQuoteLength } from '@/lib/daily-quote';

/** How long the undo banner lingers before the delete is actually sent. */
const UNDO_WINDOW_MS = 5000;

type Editing = { id: string; text: string; author: string } | 'new' | null;

/**
 * Quote management — the user's own library.
 *
 * Pushed from Settings, so it inherits the `(app)` stack's `slide_from_right`.
 */
export default function QuotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: quotes, isLoading } = useQuotes();
  const deleteQuote = useDeleteQuote();

  const [editing, setEditing] = useState<Editing>(null);
  const { pendingIds, remove, undo } = usePendingDeletes(deleteQuote.mutate);

  // Rows mid-undo are hidden from the list but not yet deleted.
  const visible = (quotes ?? []).filter((q) => !pendingIds.includes(q.id));

  return (
    <View style={styles.root}>
      <Screen scroll gutter={Gutter.narrow}>
        <View style={styles.titleRow}>
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <ThemedText type="monoValue" themeColor="textSecondary">
              Back
            </ThemedText>
          </Pressable>
          <MonoLabel small>{`${visible.length} quote${visible.length === 1 ? '' : 's'}`}</MonoLabel>
        </View>

        <ThemedText type="screenTitle" style={styles.heading}>
          Quotes
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
          One is shown each day. Tap to edit, swipe left to delete.
        </ThemedText>

        <Button label="+ Add a quote" variant="outline" style={styles.add} onPress={() => setEditing('new')} />

        {isLoading ? <MonoLabel style={styles.state}>Loading…</MonoLabel> : null}

        {!isLoading && visible.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.state}>
            Your library is empty, so no quote will appear. Add one above.
          </ThemedText>
        ) : null}

        <View style={styles.list}>
          {visible.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              onEdit={() =>
                setEditing({ id: quote.id, text: quote.text, author: quote.author ?? '' })
              }
              onDelete={() => remove(quote.id)}
            />
          ))}
        </View>
      </Screen>

      {pendingIds.length > 0 ? (
        <View style={[styles.undoBar, { bottom: insets.bottom + Spacing.four }]}>
          <ThemedText type="small" style={styles.undoText}>
            {pendingIds.length === 1 ? 'Quote deleted' : `${pendingIds.length} quotes deleted`}
          </ThemedText>
          <Pressable hitSlop={8} onPress={undo}>
            <MonoLabel small bright>
              Undo
            </MonoLabel>
          </Pressable>
        </View>
      ) : null}

      <QuoteEditor editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

/**
 * Deletes that have not happened yet.
 *
 * The row disappears at once and the write is held for `UNDO_WINDOW_MS`, so
 * Undo is a real reprieve rather than a second round-trip. Anything still
 * pending is flushed on unmount — leaving the screen confirms the delete.
 */
function usePendingDeletes(commit: (id: string) => void) {
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Kept in a ref so the unmount cleanup never closes over a stale list.
  const pendingRef = useRef<string[]>([]);
  pendingRef.current = pendingIds;

  const commitRef = useRef(commit);
  commitRef.current = commit;

  const remove = useCallback((id: string) => {
    setPendingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

    const timer = setTimeout(() => {
      timers.current.delete(id);
      setPendingIds((prev) => prev.filter((p) => p !== id));
      commitRef.current(id);
    }, UNDO_WINDOW_MS);

    timers.current.set(id, timer);
  }, []);

  const undo = useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    setPendingIds([]);
  }, []);

  useEffect(() => {
    return () => {
      // Navigating away commits rather than silently cancelling, so the list
      // the user left behind is the list they come back to.
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      for (const id of pendingRef.current) commitRef.current(id);
    };
  }, []);

  return { pendingIds, remove, undo };
}

function QuoteRow({
  quote,
  onEdit,
  onDelete,
}: {
  quote: DbQuote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const renderRightActions = useCallback(
    () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete quote"
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}>
        <ThemedText type="body" style={styles.deleteLabel}>
          Delete
        </ThemedText>
      </Pressable>
    ),
    [onDelete],
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      containerStyle={styles.swipeContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit quote: ${quote.text}`}
        onPress={onEdit}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <ThemedText type="body" style={styles.rowText}>
          {quote.text}
        </ThemedText>
        {quote.author ? (
          <MonoLabel small style={styles.rowAuthor}>
            {quote.author}
          </MonoLabel>
        ) : null}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** The add/edit modal. Two fields: the quote, and an optional attribution. */
function QuoteEditor({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();

  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');

  const isNew = editing === 'new';
  const visible = editing !== null;

  // Re-seed on each open so the fields always reflect what was tapped.
  useEffect(() => {
    if (!visible) return;
    if (isNew) {
      setText('');
      setAuthor('');
    } else if (editing) {
      setText(editing.text);
      setAuthor(editing.author);
    }
  }, [visible, isNew, editing]);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= MaxQuoteLength;

  function save() {
    if (!canSave) {
      Alert.alert('Nothing to save', 'A quote needs some text.');
      return;
    }

    if (isNew) {
      // Id minted here so an offline insert has something stable to replay.
      createQuote.mutate({ id: Crypto.randomUUID(), text: trimmed, author });
    } else if (editing) {
      updateQuote.mutate({ id: editing.id, text: trimmed, author });
    }
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <MonoLabel small bright>
              {isNew ? 'Add a quote' : 'Edit quote'}
            </MonoLabel>
            <Pressable hitSlop={10} onPress={onClose}>
              <MonoLabel small>Cancel</MonoLabel>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <MonoLabel small style={styles.fieldLabel}>
              Quote
            </MonoLabel>
            <Field
              value={text}
              onChangeText={setText}
              placeholder="It does not matter how slowly you go…"
              multiline
              maxLength={MaxQuoteLength}
              style={styles.multiline}
            />
            <MonoLabel small style={styles.counter}>
              {`${trimmed.length} / ${MaxQuoteLength}`}
            </MonoLabel>

            <MonoLabel small style={styles.fieldLabel}>
              Attribution — optional
            </MonoLabel>
            <Field
              value={author}
              onChangeText={setAuthor}
              placeholder="Confucius"
              maxLength={120}
            />
          </ScrollView>

          <Button label="Save" disabled={!canSave} style={styles.save} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    marginTop: Spacing.four,
  },
  sub: {
    marginTop: Spacing.two,
  },
  add: {
    marginTop: Spacing.four,
  },
  state: {
    marginTop: Spacing.four,
  },
  list: {
    marginTop: Spacing.four,
  },
  swipeContainer: {
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  row: {
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    padding: Spacing.three,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    fontSize: 15,
    lineHeight: 22,
  },
  rowAuthor: {
    marginTop: Spacing.two,
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.dark.danger,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  deleteActionPressed: {
    opacity: 0.8,
  },
  deleteLabel: {
    color: '#ffffff',
  },
  undoBar: {
    position: 'absolute',
    left: Gutter.narrow,
    right: Gutter.narrow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    backgroundColor: Colors.dark.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.dark.borderStrong,
  },
  undoText: {
    flex: 1,
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
    maxHeight: '88%',
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
    marginBottom: Spacing.three,
  },
  fieldLabel: {
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  counter: {
    marginTop: Spacing.two,
    textAlign: 'right',
  },
  save: {
    marginTop: Spacing.four,
  },
});
