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

**Line height.** Never set `lineHeight` below `fontSize`, and never set it at all on a
`TextInput`. React Native clips text to its line box where CSS would let it overflow;
both rules exist because the literal transcription of the mockups' CSS cut the tops off
the day numeral and the descenders off every input. Use `Typography.input` for inputs.

**Contrast.** A switch thumb is white and cannot be reliably re-tinted on iOS, so any
colour sitting behind one needs >= 3:1 against `#FFFFFF`. This is why the accent is
violet and not a livelier green or amber — those measure under 2:1 against white and
make the thumb vanish, which is a bug that already shipped once.
`src/lib/contrast.test.ts` enforces the palette's floors; run `npm test` after touching
any colour token.

**Icons.** Add them to `src/components/icons.ts`, which deep-imports from
`lucide-react-native/icons/*`. Importing from the `lucide-react-native` barrel instead
adds ~2MB to the bundle. Draw at `strokeWidth={IconStroke}`.

**Pure logic stays pure.** `src/lib/run-logic.ts` imports from `constants/limits.ts`,
not `constants/theme.ts`, so it carries no React Native or CSS imports and stays
testable under plain Node. Keep it that way.

**Reminders.** Never schedule a repeating `DAILY` trigger — a single occurrence of one
cannot be cancelled, and reminders must stay quiet on completed days. `syncReminders`
in `src/lib/notifications.ts` lays a rolling window of dated one-offs instead, and is
idempotent: it cancels before scheduling, so calling it on every foreground converges.

**Profile vs run settings.** `profiles.timezone` and `profiles.day_ends_at` apply to
FUTURE runs only. `runs` snapshots both at activation and nothing may rewrite them on
an active run — moving a day boundary mid-run can retroactively fail a completed day.

**The daily quote overlay.** Its position in `src/app/_layout.tsx` — between `<Stack>`
and `<ColdOpen>` — is load-bearing, not incidental: it is what keeps the Today screen
from being seen mid-load. Do not move it above the cold open or below the Stack. Its
`hidden` status is terminal per mount, because three async inputs settle independently
and a late one must not resurrect a dismissed overlay.

**Migrations are applied by hand** in the Supabase SQL editor. There is no migration runner.

**Do not commit.** The user runs git themselves.
