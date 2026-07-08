// Time helpers. Times are "HH:MM" 24h strings (as produced by <input type="time">).

/** Current wall-clock time as a canonical "HH:MM" 24h string. */
export function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

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

/**
 * Parse loosely-typed user input into a canonical 24h "HH:MM" string, or null.
 * Accepts: "13:33", "9:05", "0905", "905", "9", "1305", "9:05pm", "9pm",
 * "12am" (-> 00:00), "12pm" (-> 12:00), and "now" (-> current wall-clock time).
 */
export function parseFlexibleTime(input) {
  if (input === null || input === undefined) return null
  let s = String(input).trim().toLowerCase()
  if (s === '') return null
  if (s === 'now') return nowHHMM()

  let pm = null
  if (s.includes('am')) {
    pm = false
    s = s.replace(/am/g, '')
  } else if (s.includes('pm')) {
    pm = true
    s = s.replace(/pm/g, '')
  }
  s = s.trim()

  let h, m
  if (s.includes(':')) {
    const [hp, mp] = s.split(':')
    h = parseInt(hp, 10)
    m = parseInt(mp, 10)
  } else {
    const digits = s.replace(/\D/g, '')
    if (digits === '') return null
    if (digits.length <= 2) {
      h = parseInt(digits, 10)
      m = 0
    } else if (digits.length === 3) {
      h = parseInt(digits.slice(0, 1), 10)
      m = parseInt(digits.slice(1), 10)
    } else {
      h = parseInt(digits.slice(0, 2), 10)
      m = parseInt(digits.slice(2, 4), 10)
    }
  }

  if (Number.isNaN(h) || Number.isNaN(m)) return null
  if (pm === true && h < 12) h += 12 // 1pm -> 13, 12pm stays 12
  if (pm === false && h === 12) h = 0 // 12am -> 00
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Format a canonical "HH:MM" value for display in the configured clock format.
 * '24h' -> "13:33", '12h' -> "1:33 PM". Empty/invalid -> "".
 */
export function formatTime(hhmm, clockFormat = '24h') {
  const mins = parseTime(hhmm)
  if (mins === null) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (clockFormat === '12h') {
    const period = h < 12 ? 'AM' : 'PM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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
