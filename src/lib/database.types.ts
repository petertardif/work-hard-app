/**
 * Hand-written row types mirroring supabase/migrations/0001_init.sql.
 *
 * Regenerate from the live project with:
 *   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 * and keep the `Db*` aliases below pointing at the generated names.
 */

import type { GlyphKind } from '@/components/glyph';
import type { DayKey, RunStatus, RunTask } from '@/lib/run-logic';

export type DbProfile = {
  id: string;
  timezone: string;
  /** `HH:MM:SS` as Postgres renders a `time`. */
  day_ends_at: string;
  glyph: GlyphKind;
  reminder_at: string | null;
  created_at: string;
};

export type DbList = {
  id: string;
  user_id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbListTask = {
  id: string;
  list_id: string;
  position: number;
  name: string;
};

export type DbRun = {
  id: string;
  user_id: string;
  list_id: string;
  list_name: string;
  tasks: RunTask[];
  duration_days: number;
  timezone: string;
  day_ends_at: string;
  start_date: DayKey;
  status: RunStatus;
  ended_on: DayKey | null;
  failure_reason: string | null;
  created_at: string;
};

export type DbCompletion = {
  run_id: string;
  on_date: DayKey;
  task_id: string;
  completed_at: string;
};

/** A list with its tasks attached, as the UI consumes it. */
export type ListWithTasks = DbList & { tasks: DbListTask[] };
