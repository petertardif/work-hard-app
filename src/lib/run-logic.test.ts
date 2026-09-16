/// <reference types="jest" />

import {
  addDays,
  adjudicate,
  clampDuration,
  dayKeyRange,
  dayNumber,
  daysBetween,
  daysSurvived,
  formatTimeLeft,
  isDayComplete,
  isValidDuration,
  msUntilDayEnd,
  parseDayEndsAt,
  toDayKey,
  type Run,
} from '@/lib/run-logic';

const TASKS = [
  { id: 't1', name: 'Wake at 5:00 AM', position: 0 },
  { id: 't2', name: '45 min zone 2', position: 1 },
  { id: 't3', name: 'Read 10 pages', position: 2 },
];

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    listId: 'list-1',
    listName: 'Winter Block',
    tasks: TASKS,
    durationDays: 7,
    timezone: 'America/Detroit',
    dayEndsAt: '00:00',
    startDate: '2026-09-01',
    status: 'active',
    endedOn: null,
    failureReason: null,
    ...overrides,
  };
}

/** Every task completed on each of the given days. */
function completeDays(...days: string[]) {
  return days.flatMap((onDate) => TASKS.map((t) => ({ onDate, taskId: t.id })));
}

describe('day key arithmetic', () => {
  it('counts whole days between keys, signed', () => {
    expect(daysBetween('2026-09-01', '2026-09-08')).toBe(7);
    expect(daysBetween('2026-09-08', '2026-09-01')).toBe(-7);
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-12-25', '2027-01-05')).toBe(11);
  });

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    // 2100 is not a leap year.
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
  });

  it('does not drift across a DST transition', () => {
    // US DST springs forward 2026-03-08 and falls back 2026-11-01.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('builds an inclusive range, empty when reversed', () => {
    expect(dayKeyRange('2026-09-01', '2026-09-03')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
    expect(dayKeyRange('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
    expect(dayKeyRange('2026-09-03', '2026-09-01')).toEqual([]);
  });

  it('rejects malformed keys', () => {
    expect(() => addDays('09-01-2026', 1)).toThrow(/Invalid day key/);
  });
});

describe('toDayKey', () => {
  it('resolves an instant to its local calendar date', () => {
    // 2026-09-15T02:00Z is 2026-09-14 22:00 in Detroit (UTC-4).
    const instant = new Date('2026-09-15T02:00:00Z');
    expect(toDayKey(instant, 'America/Detroit')).toBe('2026-09-14');
    expect(toDayKey(instant, 'UTC')).toBe('2026-09-15');
  });

  it('puts the same instant on different dates either side of the line', () => {
    const instant = new Date('2026-09-15T12:00:00Z');
    expect(toDayKey(instant, 'Pacific/Auckland')).toBe('2026-09-16');
    expect(toDayKey(instant, 'America/Los_Angeles')).toBe('2026-09-15');
  });

  it('honours a late rollover: 1am belongs to the previous day', () => {
    // 2026-09-15 01:00 Detroit, with the day ending at 03:00.
    const instant = new Date('2026-09-15T05:00:00Z');
    expect(toDayKey(instant, 'America/Detroit', '00:00')).toBe('2026-09-15');
    expect(toDayKey(instant, 'America/Detroit', '03:00')).toBe('2026-09-14');
  });

  it('rolls over exactly at the configured time, not before', () => {
    // 04:00 Detroit is past a 03:00 rollover.
    const after = new Date('2026-09-15T08:00:00Z');
    expect(toDayKey(after, 'America/Detroit', '03:00')).toBe('2026-09-15');
  });

  it('rejects a malformed rollover time', () => {
    expect(() => parseDayEndsAt('3:00')).toThrow(/expected HH:MM/);
    expect(() => parseDayEndsAt('25:00')).toThrow(/out of range/);
    expect(parseDayEndsAt('00:00')).toBe(0);
    expect(parseDayEndsAt('03:30')).toBe(12_600_000);
  });
});

describe('msUntilDayEnd', () => {
  const HOUR = 3_600_000;

  it('counts down to local midnight by default', () => {
    // 2026-09-15 20:00 Detroit (UTC-4) — four hours to midnight.
    const instant = new Date('2026-09-16T00:00:00Z');
    expect(msUntilDayEnd(instant, 'America/Detroit')).toBe(4 * HOUR);
  });

  it('counts down to a late rollover instead', () => {
    // Same instant, but the day now ends at 03:00 — seven hours out.
    const instant = new Date('2026-09-16T00:00:00Z');
    expect(msUntilDayEnd(instant, 'America/Detroit', '03:00')).toBe(7 * HOUR);
  });

  it('is always positive and within one day', () => {
    for (const hour of [0, 5, 12, 23]) {
      const instant = new Date(`2026-09-15T${String(hour).padStart(2, '0')}:30:00Z`);
      const left = msUntilDayEnd(instant, 'America/Detroit');
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThanOrEqual(25 * HOUR);
    }
  });

  it('gives a 25-hour day when the clocks go back', () => {
    // US DST ends 2026-11-01; that local day is 25 hours long.
    const startOfDay = new Date('2026-11-01T04:00:00Z'); // 00:00 EDT
    expect(msUntilDayEnd(startOfDay, 'America/Detroit')).toBe(25 * HOUR);
  });

  it('formats the way the design reads', () => {
    expect(formatTimeLeft(4 * HOUR + 12 * 60_000)).toBe('4h 12m left');
    expect(formatTimeLeft(45 * 60_000)).toBe('45m left');
    expect(formatTimeLeft(0)).toBe('day over');
    expect(formatTimeLeft(-1)).toBe('day over');
  });
});

describe('progress', () => {
  it('derives a 1-based day number from the start date', () => {
    const run = makeRun();
    expect(dayNumber(run, '2026-09-01')).toBe(1);
    expect(dayNumber(run, '2026-09-12')).toBe(12);
  });

  it('requires every task before a day counts', () => {
    const run = makeRun();
    expect(isDayComplete(run, completeDays('2026-09-01'), '2026-09-01')).toBe(true);
    expect(
      isDayComplete(run, [{ onDate: '2026-09-01', taskId: 't1' }], '2026-09-01'),
    ).toBe(false);
  });

  it('does not let one day’s completions satisfy another', () => {
    const run = makeRun();
    expect(isDayComplete(run, completeDays('2026-09-01'), '2026-09-02')).toBe(false);
  });

  it('treats an empty task list as never complete', () => {
    expect(isDayComplete(makeRun({ tasks: [] }), [], '2026-09-01')).toBe(false);
  });
});

describe('adjudicate', () => {
  it('leaves a spotless in-progress run active', () => {
    const run = makeRun();
    const done = completeDays('2026-09-01', '2026-09-02');
    expect(adjudicate(run, done, '2026-09-03')).toEqual({
      status: 'active',
      endedOn: null,
      failureReason: null,
    });
  });

  it('does not fail a run for today still being unfinished', () => {
    const run = makeRun();
    const done = completeDays('2026-09-01');
    // Day 2 is in progress with nothing checked off yet — still fine.
    expect(adjudicate(run, done, '2026-09-02').status).toBe('active');
  });

  it('fails on the day that was missed, not the day we noticed', () => {
    const run = makeRun();
    // Day 1 done, day 2 missed, then the app is not opened until day 5.
    const done = completeDays('2026-09-01');
    const verdict = adjudicate(run, done, '2026-09-05');
    expect(verdict.status).toBe('failed');
    expect(verdict.endedOn).toBe('2026-09-02');
    expect(verdict.failureReason).toMatch(/Day 2/);
  });

  it('fails a partially completed day', () => {
    const run = makeRun();
    const done = [
      ...completeDays('2026-09-01'),
      { onDate: '2026-09-02', taskId: 't1' },
      { onDate: '2026-09-02', taskId: 't2' },
    ];
    expect(adjudicate(run, done, '2026-09-03').endedOn).toBe('2026-09-02');
  });

  it('completes the moment the final day is finished', () => {
    const run = makeRun({ durationDays: 3 });
    const done = completeDays('2026-09-01', '2026-09-02', '2026-09-03');
    expect(adjudicate(run, done, '2026-09-03')).toEqual({
      status: 'completed',
      endedOn: '2026-09-03',
      failureReason: null,
    });
  });

  it('stays active on the final day until the last task lands', () => {
    const run = makeRun({ durationDays: 3 });
    const done = [
      ...completeDays('2026-09-01', '2026-09-02'),
      { onDate: '2026-09-03', taskId: 't1' },
    ];
    expect(adjudicate(run, done, '2026-09-03').status).toBe('active');
  });

  it('completes a finished run discovered late', () => {
    const run = makeRun({ durationDays: 3 });
    const done = completeDays('2026-09-01', '2026-09-02', '2026-09-03');
    expect(adjudicate(run, done, '2026-09-20').status).toBe('completed');
  });

  it('does not scan past the final day when the app opens late', () => {
    const run = makeRun({ durationDays: 3 });
    // Days 1-3 complete; days 4-5 have nothing, but they are past the run.
    const done = completeDays('2026-09-01', '2026-09-02', '2026-09-03');
    expect(adjudicate(run, done, '2026-09-06').endedOn).toBe('2026-09-03');
  });

  it('is idempotent — a decided run is never re-judged', () => {
    const failed = makeRun({
      status: 'failed',
      endedOn: '2026-09-02',
      failureReason: 'Day 2 ended with tasks unchecked.',
    });
    expect(adjudicate(failed, completeDays('2026-09-01'), '2026-09-30')).toEqual({
      status: 'failed',
      endedOn: '2026-09-02',
      failureReason: 'Day 2 ended with tasks unchecked.',
    });
  });

  it('ignores a clock rolled back before the start date', () => {
    const run = makeRun();
    expect(adjudicate(run, [], '2026-08-25').status).toBe('active');
  });

  it('a clock rolled back cannot revive a failed run', () => {
    // Day 2 was missed and adjudicated; winding the clock back to day 2
    // must not restore it, because a decided run is never re-judged.
    const failed = makeRun({ status: 'failed', endedOn: '2026-09-02' });
    expect(adjudicate(failed, completeDays('2026-09-01'), '2026-09-02').status).toBe(
      'failed',
    );
  });

  it('survives a long run with a single miss deep inside it', () => {
    const run = makeRun({ durationDays: 75 });
    const days = dayKeyRange('2026-09-01', '2026-11-14');
    const done = completeDays(...days.filter((d) => d !== '2026-10-15'));
    const verdict = adjudicate(run, done, '2026-11-15');
    expect(verdict.status).toBe('failed');
    expect(verdict.endedOn).toBe('2026-10-15');
    expect(verdict.failureReason).toMatch(/Day 45/);
  });
});

describe('daysSurvived', () => {
  it('banks the days before a failure', () => {
    const run = makeRun({ status: 'failed', endedOn: '2026-09-12' });
    expect(daysSurvived(run, '2026-09-20')).toBe(11);
  });

  it('banks the full duration on completion', () => {
    const run = makeRun({ status: 'completed', durationDays: 60 });
    expect(daysSurvived(run, '2026-11-01')).toBe(60);
  });

  it('banks only finished days while active', () => {
    const run = makeRun();
    expect(daysSurvived(run, '2026-09-01')).toBe(0);
    expect(daysSurvived(run, '2026-09-05')).toBe(4);
  });

  it('reports zero for a run that died on day 1', () => {
    const run = makeRun({ status: 'failed', endedOn: '2026-09-01' });
    expect(daysSurvived(run, '2026-09-10')).toBe(0);
  });
});

describe('duration validation', () => {
  it('accepts the supported range only', () => {
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(365)).toBe(true);
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration(366)).toBe(false);
    expect(isValidDuration(7.5)).toBe(false);
  });

  it('clamps to the range', () => {
    expect(clampDuration(0)).toBe(1);
    expect(clampDuration(1000)).toBe(365);
    expect(clampDuration(7.4)).toBe(7);
    expect(clampDuration(Number.NaN)).toBe(1);
  });
});
