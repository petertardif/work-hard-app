/**
 * Fallback IANA time zone list.
 *
 * The picker prefers `Intl.supportedValuesOf('timeZone')`, which returns the
 * platform's full set (~600 zones). Hermes's `Intl` coverage is not guaranteed
 * across versions, so this list is what the picker falls back to when that call
 * is missing or throws — a shorter menu rather than a crash.
 *
 * Deliberately not exhaustive: these are the zones a user of this app is
 * plausibly in. Anyone outside them still gets their own zone, because the
 * picker always pins the device's reported zone to the top of the list.
 */
export const FALLBACK_TIMEZONES = [
  // North America
  'America/Anchorage',
  'America/Chicago',
  'America/Denver',
  'America/Detroit',
  'America/Edmonton',
  'America/Halifax',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Toronto',
  'America/Vancouver',
  'America/Winnipeg',
  'Pacific/Honolulu',
  // South America
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
  // Europe
  'Atlantic/Reykjavik',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zurich',
  // Africa and Middle East
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Dubai',
  'Asia/Jerusalem',
  'Asia/Riyadh',
  // Asia
  'Asia/Bangkok',
  'Asia/Dhaka',
  'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tokyo',
  // Oceania
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Pacific/Fiji',
  // Anchors
  'UTC',
] as const;

/**
 * Every zone the picker can offer, device zone first.
 *
 * `Intl.supportedValuesOf` is wrapped because it is a relatively recent addition
 * and this app runs on Hermes, where its presence is version-dependent.
 */
export function listTimezones(): string[] {
  let zones: string[] = [...FALLBACK_TIMEZONES];

  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (Array.isArray(supported) && supported.length > 0) zones = supported;
  } catch {
    // Keep the fallback.
  }

  const device = deviceTimezone();
  // The device's own zone leads, and is included even when it is absent from
  // the fallback list.
  return [device, ...zones.filter((z) => z !== device)];
}

/** The zone the OS reports, or a sane default if it cannot be read. */
export function deviceTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) return zone;
  } catch {
    // Fall through.
  }
  return 'UTC';
}
