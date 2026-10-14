# Work Hard

A 75-Hard-style accountability tracker. One active list of up to **25** daily tasks,
run for N consecutive days. Every task must be done before the day ends. Miss one
task on one day and the run is over — back to day 1.

Built on Expo SDK 57 (React Native 0.86, expo-router) with Supabase for auth and data.

## Setup

**1. Node.** Expo SDK 57 requires Node `>= 20.19.4`. Check with `node -v` and upgrade
if needed — the dev server warns and can misbehave on older versions.

**2. Install.**

```bash
npm install
```

**3. Supabase.** Create a project, then apply `supabase/migrations/0001_init.sql`
by hand in the SQL editor (Dashboard → SQL Editor → New query → paste → Run).

**4. Credentials.**

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, both
from Dashboard → **Connect**. Only ever the **publishable** key (or the legacy `anon`
key — both are accepted); never the secret / service_role key. `EXPO_PUBLIC_`
variables are inlined into the shipped bundle and are readable by anyone. Row level
security is what actually guards the data.

Without these the app renders a setup notice instead of crashing.

**5. Run.**

```bash
npm start        # then press i for iOS, a for Android
npm test         # run-logic unit tests
npm run typecheck
```

Everything built so far works in Expo Go.

## How it works

### The day boundary

The hard part of this app. Three rules the code holds to:

- **Progress is stored as calendar dates, never as a day counter.** `dayNumber` is
  always derived from `startDate`. A stored counter drifts permanently the first
  time a clock or timezone moves.
- **The server decides.** `adjudicate_runs()` (Postgres) runs on every launch and
  foreground, judging against server `now()` in the run's own captured timezone.
  `src/lib/run-logic.ts` mirrors it exactly, but only to render an optimistic
  result while offline — the server's verdict always wins.
- **A run fails on the day it was missed**, not the day you noticed. Skip Tuesday,
  open the app on Friday, and the run reports a Tuesday failure.

The client also tracks its offset from server time (`server_now()` RPC), so winding
the device clock does not move the app's idea of today.

All of this lives in pure functions with 38 unit tests covering DST transitions,
leap years, timezone travel, and clock tampering. Start there if you change anything
about dates.

### Offline

Checking off a task works with no signal. TanStack Query holds all server state,
persisted to AsyncStorage; mutations are declared with a `mutationKey` whose function
is registered in `src/lib/query-client.ts`, which is what lets a write survive the app
being killed and replay on reconnect. `completions` is keyed on
`(run_id, on_date, task_id)`, so a replayed write is a harmless upsert.

### Snapshots

`runs.tasks` is a frozen copy of the list at activation. Editing a list later never
rewrites the history of a run that used it.

## Layout

```
src/
  app/                    expo-router routes
    (auth)/sign-in        design 1e
    (app)/index           Today — design 2a
    (app)/lists/          library 2c, editor 2d, duration 1g
    (app)/settings        design 2e
  components/             Screen, ui-kit, TaskRow, Glyph, ListEditor, ColdOpen
  constants/theme.ts      colors, type scale, spacing
  constants/limits.ts     domain limits, free of RN imports so logic can use them
  hooks/use-work-hard.ts  TanStack Query bindings
  lib/run-logic.ts        pure date + adjudication logic  ← the tested core
  lib/api.ts              every Supabase call
supabase/migrations/      apply by hand in the SQL editor
```

## Not done yet

- **Apple / Google sign-in** — needs a development build (`npx expo run:ios`) and,
  on device, a paid Apple Developer account. Buttons render but are inert.
- **Failure and victory screens** — not in the design bundle yet; Today shows a
  plain interim banner so the state is never silently wrong.
- **Onboarding** — not designed.
- **Account deletion** — the row points at support; no self-service deletion yet.

## Deviations from the mockups

- **Today gained a nav row.** No mockup shows a way off the Today screen. A list icon
  and a gear icon in the top corners make Lists and Settings reachable.
- **The cold open is ~2.3s, not 8.4s.** The design file's keyframes read as a canvas
  demo loop; nobody should wait that long to see their tasks. Same beats, compressed.
  Tune `GLYPH_MS` / `WORD_MS` in `src/components/cold-open.tsx`.
- **The task cap is 25, not the mockup's 10.**
- **Line heights are not transcribed literally.** The mockups use CSS values below
  their font size (`line-height: .8` on the day numeral). CSS lets a glyph overflow
  its line box; React Native clips to it. Tightness comes from margins instead — see
  the note on `Typography.display` in `src/constants/theme.ts`.

## The daily quote

On the first launch of each day the app shows a full-screen quotation before the Today
screen, dismissed with one tap. Off-switch lives in Settings.

The no-flash guarantee comes from render order in `src/app/_layout.tsx`:

```
<Stack/>            Today mounts and fetches here, unseen
<DailyQuoteGate/>   opaque black, mounted before the cold open ends
<ColdOpen/>         plays on top, then unmounts
```

The overlay is opaque on its first frame and mounts during the cold open's ~2.3s, so
there is never a frame where Today is visible. A side effect worth keeping: because the
overlay waits for a tap, Today's queries have resolved by the time it clears.

Quotes live in the `quotes` table — shared content, readable by any signed-in user and
writable only from the dashboard. Add or retire quotes there (`active = false` retires
one without deleting it); no app release needed. The query is cached by the persister,
so after the first fetch the overlay works offline.

Which day it is comes from the user's own boundary via `api.todayKey`, not device
midnight, so with a 3am rollover the quote turns over at 3am. The last-shown day key is
in AsyncStorage under a **per-user** key, so two accounts on one device don't consume
each other's quote.

The decision rules are pure and tested in `src/lib/daily-quote.test.ts`. Note that
`hidden` is terminal for a mount: the profile, the stored key and the quote list all
resolve independently, and without that a late arrival could resurrect a dismissed
overlay.

## Reminders

Local notifications only, which is what keeps them working in Expo Go — remote push
would need a development build.

`SchedulableTriggerInputTypes.DAILY` is deliberately **not** used: a repeating trigger
cannot have one occurrence cancelled, and the reminder has to stay quiet on days you
have already finished. Instead `src/lib/notifications.ts` lays a rolling 14-day window
of individually-dated one-off notifications, and `useReminderSync` cancels and re-lays
it on every foreground, skipping today when today is done. Fourteen is well inside
iOS's 64-pending ceiling, and if the app goes unopened that long the run has already
failed.

The reminder fires on **device** local time, not the run's stored timezone — it is a
buzz on the phone in your pocket, so it should land at the hour on that phone's clock.
The run's timezone still governs the day boundary.

## Icons

Lucide, via `src/components/icons.ts`. **Import new icons there, not from the
`lucide-react-native` barrel** — the barrel pulls all 1600 icons into the bundle
(measured: +2MB of Hermes bytecode), while the per-icon subpath costs only what you
use. Draw them at `strokeWidth={IconStroke}` so they match the hand-built glyphs in
`glyph.tsx`.
