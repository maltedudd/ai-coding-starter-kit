/**
 * Timezone conversion utilities for user settings
 * User sees local time, but DB stores UTC
 */

/**
 * Convert local hour (0-23) to UTC hour
 * @param localHour - Hour in user's local timezone (0-23)
 * @returns Hour in UTC (0-23)
 */
export function localHourToUTC(localHour: number): number {
  // Create a date object for today at the specified local hour
  const date = new Date()
  date.setHours(localHour, 0, 0, 0)

  // Get the UTC hour
  const utcHour = date.getUTCHours()

  return utcHour
}

/**
 * Convert UTC hour (0-23) to local hour
 * @param utcHour - Hour in UTC (0-23)
 * @returns Hour in user's local timezone (0-23)
 */
export function utcHourToLocal(utcHour: number): number {
  // Create a date object for today at the specified UTC hour
  const date = new Date()
  date.setUTCHours(utcHour, 0, 0, 0)

  // Get the local hour
  const localHour = date.getHours()

  return localHour
}

/**
 * Get user's timezone offset in hours
 * @returns Offset in hours (e.g., -5 for EST, 1 for CET)
 */
export function getTimezoneOffset(): number {
  const offsetMinutes = new Date().getTimezoneOffset()
  // Note: getTimezoneOffset() returns positive values for west of UTC
  // We want negative values for west, so we negate it
  return -offsetMinutes / 60
}

/**
 * Get user's timezone name (e.g., "Europe/Berlin", "America/New_York")
 * @returns Timezone name or "UTC" as fallback
 */
export function getTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Format hour for display (e.g., "08:00", "14:00")
 * @param hour - Hour (0-23)
 * @returns Formatted time string
 */
export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

/**
 * Generate array of hours (0-23) for time picker
 * @returns Array of hour objects with value and label
 */
export function getHourOptions(): Array<{ value: number; label: string }> {
  return Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: formatHour(i),
  }))
}
