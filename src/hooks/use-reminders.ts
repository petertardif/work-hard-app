/**
 * Keeps the scheduled reminder window in step with the database.
 *
 * Called once from the app layout, which already owns the foreground
 * `AppState` listener that drives run adjudication — the reminder window wants
 * re-laying on exactly that same beat, so it rides along rather than installing
 * a second listener.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useProfile, useToday } from '@/hooks/use-work-hard';
import { normaliseDayEndsAt } from '@/lib/api';
import { syncReminders } from '@/lib/notifications';

export function useReminderSync(): void {
  const { data: profile } = useProfile();
  const today = useToday();

  const reminderAt = profile?.reminder_at ? normaliseDayEndsAt(profile.reminder_at) : null;
  const todayKey = today?.today ?? null;
  const todayComplete = today ? today.remaining === 0 : false;
  const listName = today?.run.list_name ?? 'Work Hard';
  const remaining = today?.remaining ?? 0;

  // Held in a ref so `sync` stays stable and the effect below is driven by the
  // signature string rather than by object identity.
  const plan = useRef({ reminderAt, todayKey, todayComplete, listName, remaining });
  plan.current = { reminderAt, todayKey, todayComplete, listName, remaining };

  const sync = useCallback(() => {
    const p = plan.current;

    // No active run means nothing to be reminded about; `syncReminders(null)`
    // still clears anything left over from a run that has since ended.
    if (!p.reminderAt || !p.todayKey) {
      void syncReminders(null);
      return;
    }

    void syncReminders({
      reminderAt: p.reminderAt,
      today: p.todayKey,
      todayComplete: p.todayComplete,
      listName: p.listName,
      remaining: p.remaining,
    });
  }, []);

  // Re-lay whenever anything the schedule depends on actually changes. A string
  // signature keeps this from firing on every render.
  const signature = `${reminderAt}|${todayKey}|${todayComplete}|${remaining}`;

  useEffect(() => {
    sync();
  }, [signature, sync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [sync]);
}
