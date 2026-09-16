/**
 * Pure run logic — day-boundary maths and failure adjudication.
 *
 * Every function here is deterministic and side-effect free so it can be unit
 * tested exhaustively. This is where the app's real complexity lives.
 *
 * Two invariants hold throughout:
 *
 *  1. A run's progress is expressed as **calendar dates**, never as a stored
 *     day counter. `dayNumber` is always derived. A stored counter would drift
 *     permanently the first time a clock or timezone moved.
 *
 *  2. The **server** is the authority. `adjudicate()` is mirrored by the
 *     `adjudicate_runs()` Postgres function, which runs against server `now()`.
 *     The copy here exists only to render an optimistic result while offline;
 *     the server's verdict overwrites it on reconnect.
 */

import { TZDate } from '@date-fns/tz';

import { MaxRunDays, MinRunDays } from '@/constants/limits';

/** A calendar date in `YYYY-MM-DD` form. The app's unit of progress. */
export type DayKey = string;

export type RunStatus = 'active' | 'failed' | 'completed';

export type RunTask = {
  id: string;
  name: string;
  position: number;
};

export type Run = {
  id: string;
  listId: string;
  /** Snapshot of the list name at activation. */
  listName: string;
  /** Snapshot of the tasks at activation — never re-read from the list. */
  tasks: RunTask[];
  durationDays: number;
  /** IANA zone captured at activation, e.g. `America/Detroit`. */
  timezone: string;
  /** `HH:MM` local wall-clock time at which the day rolls over. */
  dayEndsAt: string;
  startDate: DayKey;
  status: RunStatus;
  endedOn: DayKey | null;
  failureReason: string | null;
};

export type Verdict = {
  status: RunStatus;
  endedOn: DayKey | null;
  failureReason: string | null;
};

const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Day keys
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Parses `HH:MM` into milliseconds past local midnight. */
export function parseDayEndsAt(dayEndsAt: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(dayEndsAt);
  if (!match) {
    throw new Error(`Invalid dayEndsAt "${dayEndsAt}" — expected HH:MM`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid dayEndsAt "${dayEndsAt}" — out of range`);
  }
  return (hours * 60 + minutes) * 60_000;
}

/**
 * The logical day an instant belongs to.
 *
 * With the default `dayEndsAt` of `00:00` this is simply the calendar date in
 * `timezone`. With a later rollover — say `03:00` — 1am Tuesday still counts
 * as Monday, which is what someone who works past midnight actually means.
 */
export function toDayKey(instant: Date, timezone: string, dayEndsAt: string = '00:00'): DayKey {
  const shifted = new Date(instant.getTime() - parseDayEndsAt(dayEndsAt));
  const zoned = new TZDate(shifted, timezone);
  return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`;
}

/**
 * Parses a day key to a UTC instant at midday.
 *
 * Midday, not midnight, so that adding whole days can never land on a DST
 * transition and silently roll backwards.
 */
function dayKeyToUtcNoon(key: DayKey): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) {
    throw new Error(`Invalid day key "${key}" — expected YYYY-MM-DD`);
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function utcNoonToDayKey(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((dayKeyToUtcNoon(to) - dayKeyToUtcNoon(from)) / MS_PER_DAY);
}

export function addDays(key: DayKey, n: number): DayKey {
  return utcNoonToDayKey(dayKeyToUtcNoon(key) + n * MS_PER_DAY);
}

/** Every day key from `from` through `to`, inclusive. Empty if `to < from`. */
export function dayKeyRange(from: DayKey, to: DayKey): DayKey[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  const out: DayKey[] = [];
  for (let i = 0; i <= span; i++) out.push(addDays(from, i));
  return out;
}

/**
 * Milliseconds left in the logical day containing `instant`.
 *
 * Drives the "4h 12m left" readout on Today. Because it rebuilds the next
 * rollover from wall-clock components in the run's own zone, it stays correct
 * across a DST shift — the day genuinely is 23 or 25 hours long that week.
 */
export function msUntilDayEnd(
  instant: Date,
  timezone: string,
  dayEndsAt: string = '00:00',
): number {
  const nextKey = addDays(toDayKey(instant, timezone, dayEndsAt), 1);
  const [year, month, day] = nextKey.split('-').map(Number);
  const midnight = new TZDate(year, month - 1, day, 0, 0, 0, 0, timezone);
  return midnight.getTime() + parseDayEndsAt(dayEndsAt) - instant.getTime();
}

/** Formats a duration as the design's "4h 12m left". */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'day over';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m left`;
  return `${hours}h ${minutes}m left`;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * The 1-based day of the run that `dayKey` represents.
 *
 * Day 1 is `startDate` itself. Values above `durationDays` mean the run has
 * outlived its target; values below 1 mean the key precedes the run.
 */
export function dayNumber(run: Pick<Run, 'startDate'>, dayKey: DayKey): number {
  return daysBetween(run.startDate, dayKey) + 1;
}

/** Task ids completed on a given day, as a set, from a flat completion list. */
export function completedTaskIds(
  completions: { onDate: DayKey; taskId: string }[],
  dayKey: DayKey,
): Set<string> {
  const out = new Set<string>();
  for (const c of completions) {
    if (c.onDate === dayKey) out.add(c.taskId);
  }
  return out;
}

/** A day counts only when *every* task in the run's snapshot is done. */
export function isDayComplete(
  run: Pick<Run, 'tasks'>,
  completions: { onDate: DayKey; taskId: string }[],
  dayKey: DayKey,
): boolean {
  if (run.tasks.length === 0) return false;
  const done = completedTaskIds(completions, dayKey);
  return run.tasks.every((t) => done.has(t.id));
}

// ---------------------------------------------------------------------------
// Adjudication
// ---------------------------------------------------------------------------

/**
 * Decides what a run's status *should* be as of `today`.
 *
 * Walks every fully-elapsed day from the start. The first one missing a task
 * kills the run, dated to that day — not to today. This is what makes "skip
 * Tuesday, open the app on Friday" report a Tuesday failure.
 *
 * A run that survives its final day is completed the moment that day's last
 * task is checked off, rather than waiting for the following midnight.
 *
 * Runs that already finished are returned untouched; a verdict is never
 * revisited once reached.
 */
export function adjudicate(
  run: Run,
  completions: { onDate: DayKey; taskId: string }[],
  today: DayKey,
): Verdict {
  if (run.status !== 'active') {
    return { status: run.status, endedOn: run.endedOn, failureReason: run.failureReason };
  }

  // A run cannot be judged before it starts — a clock rolled backwards past
  // the start date leaves it untouched rather than failing it spuriously.
  if (daysBetween(run.startDate, today) < 0) {
    return { status: 'active', endedOn: null, failureReason: null };
  }

  const finalDay = addDays(run.startDate, run.durationDays - 1);
  const lastElapsed = addDays(today, -1);

  // Only days that have fully ended can fail a run; today is still in play.
  const scanUntil = daysBetween(lastElapsed, finalDay) < 0 ? finalDay : lastElapsed;

  for (const day of dayKeyRange(run.startDate, scanUntil)) {
    if (!isDayComplete(run, completions, day)) {
      return {
        status: 'failed',
        endedOn: day,
        failureReason: `Day ${dayNumber(run, day)} ended with tasks unchecked.`,
      };
    }
  }

  // Survived every elapsed day. Did it survive the whole run?
  if (daysBetween(today, finalDay) < 0) {
    return { status: 'completed', endedOn: finalDay, failureReason: null };
  }
  if (today === finalDay && isDayComplete(run, completions, today)) {
    return { status: 'completed', endedOn: finalDay, failureReason: null };
  }

  return { status: 'active', endedOn: null, failureReason: null };
}

/**
 * Days actually survived — what "best run" is measured in.
 *
 * A failed run banks the days *before* the one it died on. A completed run
 * banks its full duration.
 */
export function daysSurvived(run: Run, today: DayKey): number {
  if (run.status === 'completed') return run.durationDays;
  if (run.status === 'failed') {
    return run.endedOn ? Math.max(0, dayNumber(run, run.endedOn) - 1) : 0;
  }
  return Math.max(0, Math.min(dayNumber(run, today), run.durationDays) - 1);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidDuration(days: number): boolean {
  return Number.isInteger(days) && days >= MinRunDays && days <= MaxRunDays;
}

export function clampDuration(days: number): number {
  if (!Number.isFinite(days)) return MinRunDays;
  return Math.min(MaxRunDays, Math.max(MinRunDays, Math.round(days)));
}
