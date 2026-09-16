/**
 * Domain limits, kept free of any React Native or CSS imports so that pure
 * logic modules (and their unit tests) can depend on them without pulling in
 * the whole styling layer.
 */

/** Hard ceiling on tasks per list, enforced in the client and by a DB trigger. */
export const MaxTasksPerList = 25;

/** Bounds for a run's duration in days. */
export const MinRunDays = 1;
export const MaxRunDays = 365;

/** Duration presets offered on the picker screen. */
export const DurationPresets = [7, 21, 30, 60, 90] as const;

/** Fallback zone when a device reports nothing usable. */
export const FallbackTimezone = 'America/Detroit';

/** Default wall-clock rollover: midnight. */
export const DefaultDayEndsAt = '00:00';
