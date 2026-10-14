/**
 * Local reminder notifications.
 *
 * Everything here is local scheduling, which works in Expo Go — only *remote*
 * push needs a development build. That matters because this project cannot be
 * built locally.
 *
 * ## Why a rolling window instead of a daily repeat
 *
 * `SchedulableTriggerInputTypes.DAILY` fires every day forever, and a single
 * occurrence of a repeating trigger cannot be cancelled. Since the reminder is
 * meant to stay quiet on days you have already finished, the schedule is instead
 * a window of individually-dated one-off notifications: cancel and re-lay them
 * on every foreground, leaving out today when today is already done.
 *
 * `WINDOW_DAYS` of 14 sits far inside iOS's 64-pending-notification ceiling, and
 * if the app goes unopened that long the run has already failed, so the window
 * lapsing costs nothing.
 */

import * as Notifications from 'expo-notifications';

import { addDays, type DayKey } from '@/lib/run-logic';

const WINDOW_DAYS = 14;

/** Marks notifications this module owns, so cancelling never touches others. */
const REMINDER_TAG = 'work-hard-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PermissionResult = 'granted' | 'denied';

/**
 * Asks for notification permission.
 *
 * Called only when the user first switches a reminder on — never at launch,
 * where a cold permission prompt has no context.
 */
export async function requestReminderPermission(): Promise<PermissionResult> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return 'granted';

  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.granted ? 'granted' : 'denied';
}

export async function hasReminderPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Drops every reminder this app scheduled, leaving anything else alone. */
export async function cancelReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.tag === REMINDER_TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export type ReminderPlan = {
  /** `HH:MM` in the run's own timezone. Null turns reminders off entirely. */
  reminderAt: string | null;
  /** Today's key, as the run reckons it. */
  today: DayKey;
  /** Skips today's notification when the day is already complete. */
  todayComplete: boolean;
  /** Shown in the notification body. */
  listName: string;
  /** How many tasks are still open today, for the body text. */
  remaining: number;
};

/**
 * Re-lays the whole reminder window.
 *
 * Idempotent: it always cancels first, so calling it repeatedly (every
 * foreground) converges rather than piling up duplicates.
 */
export async function syncReminders(plan: ReminderPlan | null): Promise<number> {
  await cancelReminders();

  if (!plan?.reminderAt) return 0;
  if (!(await hasReminderPermission())) return 0;

  const [hour, minute] = plan.reminderAt.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;

  let scheduled = 0;

  for (let offset = 0; offset < WINDOW_DAYS; offset++) {
    // Today is skipped when it is already done; future days are unknowable, so
    // they are always laid down and re-evaluated when that day becomes today.
    if (offset === 0 && plan.todayComplete) continue;

    const fireAt = dateForDayAt(plan.today, offset, hour, minute);
    // A time earlier in the day has already passed; scheduling it would fire
    // immediately.
    if (fireAt.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: plan.listName,
        body:
          offset === 0 && plan.remaining > 0
            ? `${plan.remaining} task${plan.remaining === 1 ? '' : 's'} left today.`
            : 'Your tasks are waiting.',
        data: { tag: REMINDER_TAG },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    scheduled++;
  }

  return scheduled;
}

/**
 * The wall-clock instant for `hour:minute`, `offset` days after `today`.
 *
 * Built from local date components rather than from a UTC timestamp so the
 * notification lands at the right *local* time either side of a DST shift.
 *
 * Note this is the **device's** local time, not the run's stored timezone. A
 * reminder is a buzz on the phone in your pocket, so it should land at the hour
 * you see on that phone's clock — if you set 8pm and fly to Tokyo, you want it
 * at 8pm Tokyo. The run's timezone still governs the day boundary; only the
 * reminder's clock is the device's.
 */
function dateForDayAt(today: DayKey, offset: number, hour: number, minute: number): Date {
  const [year, month, day] = addDays(today, offset).split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/** Debug helper for the verification steps; not used by the UI. */
export async function countScheduledReminders(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((n) => n.content.data?.tag === REMINDER_TAG).length;
}
