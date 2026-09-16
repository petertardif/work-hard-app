# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Work Hard

Read `README.md` first — it covers setup, architecture, and what is deliberately unfinished.

## Rules specific to this codebase

**Dates.** Never store or pass a day number. Progress is calendar dates (`YYYY-MM-DD`);
`dayNumber` is always derived. If you touch anything in `src/lib/run-logic.ts`, run
`npm test` — those 38 tests cover DST, leap years, timezone travel and clock tampering,
and they exist because every one of those cases is a real bug waiting to happen.

**The server is the authority on time.** `adjudicate_runs()` in
`supabase/migrations/0001_init.sql` decides run status. The TypeScript `adjudicate()`
is a mirror for offline display only. Change one and you must change the other.

**Snapshots are load-bearing.** `runs.tasks` and `runs.list_name` are frozen copies.
Never resolve a run's tasks by joining back to `list_tasks`.

**Styling.** Plain `StyleSheet` plus tokens from `src/constants/theme.ts`. No NativeWind.
Custom fonts mean weights are separate families — set `fontFamily` from `FontFamily`,
never `fontWeight`.

**Pure logic stays pure.** `src/lib/run-logic.ts` imports from `constants/limits.ts`,
not `constants/theme.ts`, so it carries no React Native or CSS imports and stays
testable under plain Node. Keep it that way.

**Migrations are applied by hand** in the Supabase SQL editor. There is no migration runner.

**Do not commit.** The user runs git themselves.
