/**
 * React bindings over `src/lib/api.ts`.
 *
 * TanStack Query owns all server state; local UI state stays in `useState`.
 * There is no separate store.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '@/lib/api';
import type { DbCompletion, DbProfile, DbRun, ListWithTasks } from '@/lib/database.types';
import { queryKeys } from '@/lib/query-client';
import {
  adjudicate,
  dayNumber,
  daysSurvived,
  isDayComplete,
  type DayKey,
  type Run,
} from '@/lib/run-logic';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: api.fetchProfile,
  });
}

export function useLists() {
  return useQuery({
    queryKey: queryKeys.lists,
    queryFn: api.fetchLists,
  });
}

export function useRuns() {
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: api.fetchRuns,
  });
}

export function useActiveRun() {
  return useQuery({
    queryKey: queryKeys.activeRun,
    queryFn: api.fetchActiveRun,
  });
}

export function useCompletions(runId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.completions(runId ?? 'none'),
    queryFn: () => api.fetchCompletions(runId!),
    enabled: !!runId,
  });
}

// ---------------------------------------------------------------------------
// Derived view of "today"
// ---------------------------------------------------------------------------

export type TodayView = {
  run: DbRun;
  today: DayKey;
  dayNumber: number;
  tasks: { id: string; name: string; done: boolean }[];
  remaining: number;
  /** What the run's status *should* be, computed locally for instant feedback. */
  projectedStatus: Run['status'];
};

/** Maps a database row onto the shape the pure logic expects. */
function toRun(row: DbRun): Run {
  return {
    id: row.id,
    listId: row.list_id,
    listName: row.list_name,
    tasks: row.tasks,
    durationDays: row.duration_days,
    timezone: row.timezone,
    dayEndsAt: api.normaliseDayEndsAt(row.day_ends_at),
    startDate: row.start_date,
    status: row.status,
    endedOn: row.ended_on,
    failureReason: row.failure_reason,
  };
}

function toCompletionList(rows: DbCompletion[]) {
  return rows.map((c) => ({ onDate: c.on_date, taskId: c.task_id }));
}

export function useToday(): TodayView | null {
  const { data: runRow } = useActiveRun();
  const { data: completionRows } = useCompletions(runRow?.id);

  return useMemo(() => {
    if (!runRow) return null;

    const run = toRun(runRow);
    const completions = toCompletionList(completionRows ?? []);
    const today = api.todayKey(run.timezone, run.dayEndsAt);
    const doneToday = new Set(
      completions.filter((c) => c.onDate === today).map((c) => c.taskId),
    );

    const tasks = [...run.tasks]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({ id: t.id, name: t.name, done: doneToday.has(t.id) }));

    return {
      run: runRow,
      today,
      dayNumber: dayNumber(run, today),
      tasks,
      remaining: tasks.filter((t) => !t.done).length,
      projectedStatus: adjudicate(run, completions, today).status,
    };
  }, [runRow, completionRows]);
}

/**
 * History across every run — what Settings and the Lists screen report.
 *
 * `bestByList` and `attemptsByList` are keyed by list id so the list cards can
 * show their own record without each re-deriving it.
 */
export function useHistory() {
  const { data: runs } = useRuns();

  return useMemo(() => {
    const rows = runs ?? [];
    const bestByList = new Map<string, number>();
    const attemptsByList = new Map<string, number>();
    let bestRun = 0;

    for (const row of rows) {
      const run = toRun(row);
      const survived = daysSurvived(run, api.todayKey(run.timezone, run.dayEndsAt));

      if (survived > bestRun) bestRun = survived;
      bestByList.set(run.listId, Math.max(bestByList.get(run.listId) ?? 0, survived));
      attemptsByList.set(run.listId, (attemptsByList.get(run.listId) ?? 0) + 1);
    }

    return { attempts: rows.length, bestRun, bestByList, attemptsByList, runs: rows };
  }, [runs]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Toggling a task.
 *
 * Optimistic so the row strikes through instantly, and declared with a
 * `mutationKey` whose function is registered in `query-client.ts` — that pairing
 * is what lets a write made in airplane mode survive an app restart and replay
 * on reconnect.
 */
export function useToggleTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['setCompletion'],
    mutationFn: api.setCompletion,

    async onMutate(input) {
      const key = queryKeys.completions(input.runId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DbCompletion[]>(key) ?? [];

      const next = input.done
        ? [
            ...previous,
            {
              run_id: input.runId,
              on_date: input.onDate,
              task_id: input.taskId,
              completed_at: new Date().toISOString(),
            },
          ]
        : previous.filter(
            (c) => !(c.on_date === input.onDate && c.task_id === input.taskId),
          );

      qc.setQueryData(key, next);
      return { previous, key };
    },

    onError(_error, _input, context) {
      if (context) qc.setQueryData(context.key, context.previous);
    },

    onSettled(_data, _error, input) {
      void qc.invalidateQueries({ queryKey: queryKeys.completions(input.runId) });
      void qc.invalidateQueries({ queryKey: queryKeys.activeRun });
    },
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, tasks }: { name: string; tasks: string[] }) =>
      api.createList(name, tasks),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lists }),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, tasks }: { id: string; name: string; tasks: string[] }) =>
      api.updateList(id, name, tasks),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lists }),
  });
}

export function useSetListArchived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.setListArchived(id, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lists }),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteList(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.lists });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

export function useActivateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      list,
      durationDays,
      profile,
    }: {
      list: ListWithTasks;
      durationDays: number;
      profile: DbProfile;
    }) => api.activateList(list, durationDays, profile),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.activeRun });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

export function useEndRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (run: DbRun) => api.endRun(run),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.activeRun });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (profile) => qc.setQueryData(queryKeys.profile, profile),
  });
}

export { isDayComplete };
