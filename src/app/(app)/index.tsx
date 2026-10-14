import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { GlyphKind } from '@/components/glyph';
import { IconStroke, List, Settings } from '@/components/icons';
import { Screen, Spacer } from '@/components/screen';
import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Button, MonoLabel } from '@/components/ui-kit';
import { Colors, Spacing } from '@/constants/theme';
import {
  useEndRun,
  useProfile,
  useToday,
  useToggleTask,
  type TodayView,
} from '@/hooks/use-work-hard';
import { now } from '@/lib/api';
import { formatTimeLeft, msUntilDayEnd } from '@/lib/run-logic';

/** Design 2a — the merged core screen. */
export default function TodayScreen() {
  const today = useToday();
  const { data: profile } = useProfile();

  return (
    <Screen>
      <NavRow />
      {today ? (
        <ActiveRun view={today} glyph={profile?.glyph ?? 'ant'} />
      ) : (
        <NoActiveRun />
      )}
    </Screen>
  );
}

/**
 * Not in the mockups — no screen shows a way off Today. A slim mono row keeps
 * to the design's language while making Lists and Settings reachable.
 */
function NavRow() {
  return (
    <View style={styles.navRow}>
      <Link href="/lists" asChild>
        {/* The icon replaced the word, so the label has to be spelled out here
            or a screen reader is left with nothing to announce. */}
        <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel="Lists">
          <List size={20} color={Colors.dark.textSecondary} strokeWidth={IconStroke} />
        </Pressable>
      </Link>
      <Link href="/settings" asChild>
        <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel="Settings">
          <Settings size={20} color={Colors.dark.textSecondary} strokeWidth={IconStroke} />
        </Pressable>
      </Link>
    </View>
  );
}

function ActiveRun({ view, glyph }: { view: TodayView; glyph: GlyphKind }) {
  const { run } = view;
  const timeLeft = useTimeLeft(run.timezone, run.day_ends_at);
  const over = view.projectedStatus !== 'active';

  const summary =
    view.remaining === 0
      ? `Day ${view.dayNumber} complete`
      : `${view.remaining} task${view.remaining === 1 ? '' : 's'} remaining`;

  return (
    <>
      {/* Fixed band: the day numeral stays put while the tasks scroll under it. */}
      <View style={styles.header}>
        <View style={styles.headerDay}>
          <MonoLabel style={styles.dayLabel}>Day</MonoLabel>
          <ThemedText type="display" style={styles.dayNumber}>
            {view.dayNumber}
          </ThemedText>
        </View>
        <View style={styles.headerMeta}>
          <MonoLabel style={styles.headerMetaText}>
            {`of ${run.duration_days} days`}
          </MonoLabel>
          <MonoLabel style={styles.headerMetaText} numberOfLines={2}>
            {run.list_name}
          </MonoLabel>
        </View>
      </View>

      {over ? <RunOverBanner view={view} /> : null}

      {/* Scrolling band. A list can hold 25 tasks; without this the tail of a
          long list is simply unreachable on a smaller phone. */}
      <ScrollView
        style={styles.tasks}
        contentContainerStyle={styles.tasksContent}
        showsVerticalScrollIndicator={false}>
        <TaskList view={view} glyph={glyph} disabled={over} />
        <View style={styles.tasksEnd} />
      </ScrollView>

      {/* Pinned band: the two things you check most stay visible while scrolling. */}
      <View style={styles.footer}>
        <ThemedText type="body" style={styles.footerSummary}>
          {summary}
        </ThemedText>
        <MonoLabel>{timeLeft}</MonoLabel>
      </View>
    </>
  );
}

function TaskList({
  view,
  glyph,
  disabled,
}: {
  view: TodayView;
  glyph: GlyphKind;
  disabled: boolean;
}) {
  const { mutate } = useToggleTask();

  return (
    <>
      {view.tasks.map((task) => (
        <TaskRow
          key={task.id}
          name={task.name}
          done={task.done}
          glyph={glyph}
          disabled={disabled}
          onToggle={() =>
            mutate({
              runId: view.run.id,
              onDate: view.today,
              taskId: task.id,
              done: !task.done,
            })
          }
        />
      ))}
    </>
  );
}

/**
 * The failure and victory screens are not in the design bundle yet (the
 * designer parked them). This banner is a deliberately plain interim so the
 * state is never silently wrong.
 */
function RunOverBanner({ view }: { view: TodayView }) {
  const router = useRouter();
  const endRun = useEndRun();
  const won = view.projectedStatus === 'completed';

  return (
    <View style={[styles.banner, won ? styles.bannerWon : styles.bannerLost]}>
      <MonoLabel bright small>
        {won ? 'Run complete' : 'Run over'}
      </MonoLabel>
      <ThemedText type="body" style={styles.bannerBody}>
        {won
          ? `You finished all ${view.run.duration_days} days of ${view.run.list_name}.`
          : (view.run.failure_reason ?? 'A day ended with tasks unchecked.')}
      </ThemedText>
      <Button
        label="Back to lists"
        variant="outline"
        style={styles.bannerAction}
        onPress={() => {
          if (view.run.status === 'active') endRun.mutate(view.run);
          router.push('/lists');
        }}
      />
    </View>
  );
}

function NoActiveRun() {
  const router = useRouter();
  return (
    <>
      <Spacer />
      <ThemedText type="screenTitle">Ready to start?</ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.emptyBody}>
        Build a list of daily tasks, choose how many consecutive days you want to hold
        it, and begin.
      </ThemedText>
      <Spacer />
      <Button label="Go to lists" onPress={() => router.push('/lists')} />
    </>
  );
}

/** Ticks once a minute so the "4h 12m left" readout stays honest. */
function useTimeLeft(timezone: string, dayEndsAt: string): string {
  const compute = () => formatTimeLeft(msUntilDayEnd(now(), timezone, dayEndsAt.slice(0, 5)));
  const [label, setLabel] = useState(compute);

  useEffect(() => {
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone, dayEndsAt]);

  return label;
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerDay: {
    // The numeral is a fixed 104px; it must never be the thing that shrinks.
    flexShrink: 0,
  },
  dayLabel: {
    // Clearance between the label and the numeral below it. This is the knob to
    // turn if the two ever crowd each other again.
    marginBottom: 6,
  },
  dayNumber: {
    // No negative top margin. An earlier attempt to reproduce the design's
    // `line-height: .8` with `marginTop: -10` pulled the numeral up *through*
    // the label — the 104px line box already sits the digits well below its own
    // top edge, so there is nothing left to claw back.
    //
    // The negative bottom margin is fine: it only tightens the gap down to the
    // task list, which has 44px of its own margin to give.
    marginBottom: -10,
  },
  headerMeta: {
    alignItems: 'flex-end',
    paddingBottom: 6,
    // A long list name wraps or truncates rather than crowding the numeral.
    flexShrink: 1,
    marginLeft: Spacing.three,
  },
  headerMetaText: {
    textAlign: 'right',
  },
  tasks: {
    flex: 1,
    marginTop: 44,
  },
  tasksContent: {
    paddingBottom: Spacing.three,
  },
  tasksEnd: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  footerSummary: {
    fontSize: 17,
  },
  banner: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerWon: {
    borderColor: Colors.dark.text,
  },
  bannerLost: {
    borderColor: Colors.dark.borderStrong,
    backgroundColor: Colors.dark.backgroundElement,
  },
  bannerBody: {
    marginTop: Spacing.two,
  },
  bannerAction: {
    marginTop: Spacing.three,
  },
  emptyBody: {
    marginTop: Spacing.two,
  },
});
