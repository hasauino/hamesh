// Time helpers. Times are "HH:MM" 24h strings (as produced by <input type="time">).

/** Parse "HH:MM" -> minutes since midnight, or null if invalid/empty. */
export function parseTime(value) {
  if (!value || typeof value !== 'string') return null
  const m = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/**
 * Duration in minutes between start and end.
 * Returns null if either is missing/invalid.
 * If end is before start, assumes the interval crosses midnight.
 */
export function rowMinutes(start, end) {
  const s = parseTime(start)
  const e = parseTime(end)
  if (s === null || e === null) return null
  let diff = e - s
  if (diff < 0) diff += 24 * 60 // crossed midnight
  return diff
}

/** Format minutes as "H:MM" (e.g. 185 -> "3:05"). */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Format minutes as decimal hours string (e.g. 105 -> "1.75"). */
export function formatDecimalHours(minutes) {
  if (minutes === null || minutes === undefined) return ''
  return (minutes / 60).toFixed(2)
}

/** Sum the valid durations of an array of {start, end} rows -> total minutes. */
export function totalMinutes(rows) {
  return rows.reduce((sum, r) => {
    const mins = rowMinutes(r.start, r.end)
    return sum + (mins ?? 0)
  }, 0)
}
