import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, InfoPopover, MonoLabel, SectionHeader } from '@/components/ui-kit';
import { Gutter, Spacing } from '@/constants/theme';
import {
  useActiveRun,
  useEndRun,
  useHistory,
  useLists,
  useSetListArchived,
  useToday,
} from '@/hooks/use-work-hard';
import type { ListWithTasks } from '@/lib/database.types';

/** Design 2c — the list library. Activation lives here, not in the editor. */
export default function ListsScreen() {
  const router = useRouter();
  const { data: lists, isLoading } = useLists();
  const { data: activeRun } = useActiveRun();

  const all = lists ?? [];
  const archived = all.filter((l) => l.archived_at);
  const inactive = all.filter((l) => !l.archived_at && l.id !== activeRun?.list_id);

  return (
    <Screen scroll gutter={Gutter.narrow}>
      <View style={styles.titleRow}>
        <ThemedText type="screenTitle">Lists</ThemedText>
        <Pressable hitSlop={8} onPress={() => router.push('/lists/new')}>
          <MonoLabel bright>+ New</MonoLabel>
        </Pressable>
      </View>

      {isLoading ? <MonoLabel style={styles.section}>Loading…</MonoLabel> : null}

      {/* The header is always rendered, not just when a run exists — the rule it
          explains matters most to someone who has not started one yet. */}
      <View style={[styles.section, styles.sectionWithInfo]}>
        <MonoLabel small>Active</MonoLabel>
        <InfoPopover
          accessibilityLabel="About active lists"
          text="Only one list can be active at a time. Activating a list starts it at day 1."
        />
      </View>
      {activeRun ? (
        <ActiveSection />
      ) : (
        <ThemedText type="monoValue" themeColor="textSecondary" style={styles.empty}>
          No active run.
        </ThemedText>
      )}

      <MonoLabel small style={styles.section}>
        Inactive
      </MonoLabel>
      {inactive.length === 0 ? (
        <ThemedText type="monoValue" themeColor="textSecondary" style={styles.empty}>
          {all.length === 0 ? 'No lists yet. Tap + New to build one.' : 'No inactive lists.'}
        </ThemedText>
      ) : (
        <View style={styles.stack}>
          {inactive.map((list) => (
            <InactiveCard key={list.id} list={list} hasActiveRun={!!activeRun} />
          ))}
        </View>
      )}

      {archived.length > 0 ? (
        <>
          <SectionHeader title="Archived" value={String(archived.length)} style={styles.section} />
          <View style={styles.stack}>
            {archived.map((list) => (
              <ArchivedCard key={list.id} list={list} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function ActiveSection() {
  const router = useRouter();
  const { data: run } = useActiveRun();
  const today = useToday();
  const endRun = useEndRun();

  if (!run) return null;

  function confirmEnd() {
    Alert.alert(
      'End this run?',
      'The run ends now and your next attempt starts again at day 1.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End run', style: 'destructive', onPress: () => run && endRun.mutate(run) },
      ],
    );
  }

  return (
    <>
      <Card emphasised>
        <View style={styles.cardHead}>
          <ThemedText type="cardTitle">{run.list_name}</ThemedText>
          <MonoLabel small bright>
            {`Day ${today?.dayNumber ?? 1} / ${run.duration_days}`}
          </MonoLabel>
        </View>
        <ThemedText type="monoValue" themeColor="textSecondary" style={styles.cardMeta}>
          {`${run.tasks.length} task${run.tasks.length === 1 ? '' : 's'} · locked until the run ends`}
        </ThemedText>
        <View style={styles.cardActions}>
          <Button label="View" variant="outline" fill onPress={() => router.push('/')} />
          <Button label="End run" variant="outline" fill onPress={confirmEnd} />
        </View>
      </Card>
    </>
  );
}

function InactiveCard({ list, hasActiveRun }: { list: ListWithTasks; hasActiveRun: boolean }) {
  const router = useRouter();
  const archive = useSetListArchived();
  const { attemptsByList } = useHistory();

  const attempts = attemptsByList.get(list.id) ?? 0;

  return (
    <Card>
      <ThemedText type="cardTitle" style={styles.inactiveTitle}>
        {list.name}
      </ThemedText>
      <ThemedText type="monoValue" themeColor="textSecondary" style={styles.cardMetaTight}>
        {`${list.tasks.length} task${list.tasks.length === 1 ? '' : 's'} · ${
          attempts === 0 ? 'never run' : `${attempts} attempt${attempts === 1 ? '' : 's'}`
        }`}
      </ThemedText>
      <View style={styles.cardActions}>
        <Button
          label="Activate"
          fill
          disabled={hasActiveRun || list.tasks.length === 0}
          onPress={() => router.push(`/lists/${list.id}/duration`)}
        />
        <Button
          label="Edit"
          variant="outline"
          onPress={() => router.push(`/lists/${list.id}/edit`)}
        />
        <Button
          label="Archive"
          variant="quiet"
          onPress={() => archive.mutate({ id: list.id, archived: true })}
        />
      </View>
      {hasActiveRun ? (
        <MonoLabel small style={styles.blocked}>
          End the active run to activate another list
        </MonoLabel>
      ) : null}
    </Card>
  );
}

function ArchivedCard({ list }: { list: ListWithTasks }) {
  const archive = useSetListArchived();
  const { bestByList } = useHistory();

  const best = bestByList.get(list.id) ?? 0;

  return (
    <Card outlined style={styles.archivedCard}>
      <View style={styles.archivedInner}>
        <View style={styles.archivedText}>
          <ThemedText type="body" themeColor="textSecondary" style={styles.archivedTitle}>
            {list.name}
          </ThemedText>
          <ThemedText type="monoValue" themeColor="textSecondary" style={styles.archivedMeta}>
            {`${list.tasks.length} task${list.tasks.length === 1 ? '' : 's'} · best ${best} day${
              best === 1 ? '' : 's'
            }`}
          </ThemedText>
        </View>
        <Pressable hitSlop={8} onPress={() => archive.mutate({ id: list.id, archived: false })}>
          <MonoLabel small bright>
            Unarchive
          </MonoLabel>
        </Pressable>
      </View>
    </Card>
  );
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
  sectionWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stack: {
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cardMeta: {
    marginTop: 6,
  },
  cardMetaTight: {
    marginTop: Spacing.one,
  },
  cardActions: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inactiveTitle: {
    fontSize: 18,
  },
  blocked: {
    marginTop: Spacing.two,
  },
  empty: {
    marginBottom: Spacing.two,
  },
  archivedCard: {
    paddingVertical: Spacing.three,
  },
  archivedInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archivedText: {
    flex: 1,
  },
  archivedTitle: {
    fontWeight: '600',
  },
  archivedMeta: {
    marginTop: 3,
    opacity: 0.7,
    fontSize: 12,
  },
});
