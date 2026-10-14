/**
 * Every Supabase call the app makes, in one place.
 *
 * Nothing here knows about React. Hooks in `src/hooks/use-work-hard.ts` wrap
 * these with TanStack Query for caching, optimistic updates and the offline
 * mutation queue.
 */

import * as Crypto from 'expo-crypto';

import type {
  DbCompletion,
  DbList,
  DbListTask,
  DbProfile,
  DbQuote,
  DbRun,
  ListWithTasks,
} from '@/lib/database.types';
import { type DayKey, type RunTask, toDayKey } from '@/lib/run-logic';
import { supabase } from '@/lib/supabase';

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Supabase returned no data');
  return result.data;
}

/** Postgres renders `time` as `HH:MM:SS`; the app works in `HH:MM`. */
export function normaliseDayEndsAt(value: string): string {
  return value.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

let clockOffsetMs = 0;

/**
 * Syncs against server time and remembers the offset.
 *
 * Every later `now()` applies it, so winding the device clock forward or back
 * does not move the app's idea of what day it is — even while offline, since
 * the last known offset keeps applying.
 */
export async function syncServerClock(): Promise<void> {
  const { data, error } = await supabase.rpc('server_now');
  if (error || !data) return; // offline: keep the previous offset
  clockOffsetMs = new Date(data as string).getTime() - Date.now();
}

/** The current instant, corrected towards server time. */
export function now(): Date {
  return new Date(Date.now() + clockOffsetMs);
}

/** Today's day key for a given run or profile. */
export function todayKey(timezone: string, dayEndsAt: string): DayKey {
  return toDayKey(now(), timezone, normaliseDayEndsAt(dayEndsAt));
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchProfile(): Promise<DbProfile> {
  return unwrap(await supabase.from('profiles').select('*').single());
}

export async function updateProfile(patch: Partial<DbProfile>): Promise<DbProfile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  return unwrap(
    await supabase.from('profiles').update(patch).eq('id', auth.user.id).select('*').single(),
  );
}

/**
 * Permanently deletes the signed-in user's account and everything in it.
 *
 * App Store Review Guideline 5.1.1(v) requires this to exist inside the app, not
 * behind a support email.
 *
 * The RPC removes the row from `auth.users`; every table cascades from there, so
 * one delete takes the profile, lists, tasks, runs, completions and quotes with
 * it. There is no undo and no soft-delete tombstone.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

/**
 * The signed-in user's quote library, newest first.
 *
 * Each account owns its own rows — the starter set is copied in at signup — so
 * RLS scopes this without a filter. Cached by the query persister, which is
 * what lets the daily overlay work offline.
 */
export async function fetchQuotes(): Promise<DbQuote[]> {
  return unwrap(
    await supabase.from('quotes').select('*').order('created_at', { ascending: false }),
  ) as DbQuote[];
}

export type QuoteInput = {
  /** Minted client-side so an offline insert has a stable id to replay with. */
  id: string;
  text: string;
  author: string | null;
};

/**
 * Adds a quote.
 *
 * An upsert rather than an insert so a queued offline write replayed twice is a
 * no-op instead of a duplicate — the same reasoning as `setCompletion`.
 */
export async function createQuote(input: QuoteInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const { error } = await supabase.from('quotes').upsert(
    {
      id: input.id,
      user_id: auth.user.id,
      text: input.text.trim(),
      author: input.author?.trim() ? input.author.trim() : null,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(error.message);
}

export async function updateQuote(input: QuoteInput): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({
      text: input.text.trim(),
      author: input.author?.trim() ? input.author.trim() : null,
    })
    .eq('id', input.id);
  if (error) throw new Error(error.message);
}

/** Idempotent by nature: deleting an already-deleted row affects zero rows. */
export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function fetchLists(): Promise<ListWithTasks[]> {
  const lists = unwrap(
    await supabase.from('lists').select('*').order('created_at', { ascending: true }),
  ) as DbList[];

  if (lists.length === 0) return [];

  const tasks = unwrap(
    await supabase
      .from('list_tasks')
      .select('*')
      .in('list_id', lists.map((l) => l.id))
      .order('position', { ascending: true }),
  ) as DbListTask[];

  return lists.map((list) => ({
    ...list,
    tasks: tasks.filter((t) => t.list_id === list.id),
  }));
}

export async function createList(name: string, taskNames: string[]): Promise<ListWithTasks> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const list = unwrap(
    await supabase
      .from('lists')
      .insert({ user_id: auth.user.id, name: name.trim() })
      .select('*')
      .single(),
  ) as DbList;

  const tasks = await replaceTasks(list.id, taskNames);
  return { ...list, tasks };
}

/**
 * Rewrites a list's tasks wholesale.
 *
 * Ids are minted client-side so a task keeps its identity across an edit —
 * which matters because `runs.tasks` snapshots those ids.
 */
async function replaceTasks(listId: string, taskNames: string[]): Promise<DbListTask[]> {
  const { error: deleteError } = await supabase.from('list_tasks').delete().eq('list_id', listId);
  if (deleteError) throw new Error(deleteError.message);

  const rows = taskNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, position) => ({ id: Crypto.randomUUID(), list_id: listId, position, name }));

  if (rows.length === 0) return [];

  return unwrap(await supabase.from('list_tasks').insert(rows).select('*')) as DbListTask[];
}

export async function updateList(
  listId: string,
  name: string,
  taskNames: string[],
): Promise<ListWithTasks> {
  const list = unwrap(
    await supabase
      .from('lists')
      .update({ name: name.trim() })
      .eq('id', listId)
      .select('*')
      .single(),
  ) as DbList;

  const tasks = await replaceTasks(listId, taskNames);
  return { ...list, tasks };
}

export async function setListArchived(listId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('lists')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', listId);
  if (error) throw new Error(error.message);
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function fetchRuns(): Promise<DbRun[]> {
  return unwrap(
    await supabase.from('runs').select('*').order('created_at', { ascending: false }),
  ) as DbRun[];
}

export async function fetchActiveRun(): Promise<DbRun | null> {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DbRun) ?? null;
}

/**
 * Starts a run from a list.
 *
 * The list's name and tasks are copied into the run so that later edits to the
 * list cannot rewrite this run's history.
 */
export async function activateList(
  list: ListWithTasks,
  durationDays: number,
  profile: DbProfile,
): Promise<DbRun> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  if (list.tasks.length === 0) throw new Error('A list needs at least one task');

  const snapshot: RunTask[] = list.tasks.map((t) => ({
    id: t.id,
    name: t.name,
    position: t.position,
  }));

  const dayEndsAt = normaliseDayEndsAt(profile.day_ends_at);

  return unwrap(
    await supabase
      .from('runs')
      .insert({
        user_id: auth.user.id,
        list_id: list.id,
        list_name: list.name,
        tasks: snapshot,
        duration_days: durationDays,
        timezone: profile.timezone,
        day_ends_at: dayEndsAt,
        start_date: todayKey(profile.timezone, dayEndsAt),
        status: 'active',
      })
      .select('*')
      .single(),
  ) as DbRun;
}

/** Ends a run early, at the user's own request. */
export async function endRun(run: DbRun): Promise<void> {
  const { error } = await supabase
    .from('runs')
    .update({
      status: 'failed',
      ended_on: todayKey(run.timezone, run.day_ends_at),
      failure_reason: 'Ended by you.',
    })
    .eq('id', run.id);
  if (error) throw new Error(error.message);
}

/** Asks the server to re-judge every active run against its own clock. */
export async function adjudicateRuns(): Promise<void> {
  const { error } = await supabase.rpc('adjudicate_runs');
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

export async function fetchCompletions(runId: string): Promise<DbCompletion[]> {
  return unwrap(
    await supabase.from('completions').select('*').eq('run_id', runId),
  ) as DbCompletion[];
}

/**
 * Marks one task done or not done on one day.
 *
 * The upsert is keyed on the table's own primary key, so replaying a queued
 * offline write is a no-op rather than a duplicate.
 */
export async function setCompletion(input: {
  runId: string;
  onDate: DayKey;
  taskId: string;
  done: boolean;
}): Promise<void> {
  if (input.done) {
    const { error } = await supabase
      .from('completions')
      .upsert(
        { run_id: input.runId, on_date: input.onDate, task_id: input.taskId },
        { onConflict: 'run_id,on_date,task_id' },
      );
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from('completions')
    .delete()
    .eq('run_id', input.runId)
    .eq('on_date', input.onDate)
    .eq('task_id', input.taskId);
  if (error) throw new Error(error.message);
}
