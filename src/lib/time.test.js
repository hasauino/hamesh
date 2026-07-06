import { describe, it, expect } from 'vitest'
import {
  parseTime,
  rowMinutes,
  parseFlexibleTime,
  formatTime,
  formatDuration,
  formatDecimalHours,
  totalMinutes,
} from './time.js'

describe('parseTime', () => {
  it('parses valid "HH:MM" strings to minutes', () => {
    expect(parseTime('00:00')).toBe(0)
    expect(parseTime('13:33')).toBe(813)
    expect(parseTime('9:05')).toBe(545)
  })

  it('returns null for invalid or empty input', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime(null)).toBeNull()
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('12:60')).toBeNull()
    expect(parseTime('abc')).toBeNull()
  })
})

describe('rowMinutes', () => {
  it('computes duration within a day', () => {
    expect(rowMinutes('09:00', '17:30')).toBe(510)
  })

  it('assumes midnight crossing when end is before start', () => {
    expect(rowMinutes('23:00', '01:00')).toBe(120)
  })

  it('returns null when either bound is invalid', () => {
    expect(rowMinutes('09:00', '')).toBeNull()
    expect(rowMinutes('bad', '17:00')).toBeNull()
  })
})

describe('parseFlexibleTime', () => {
  it('canonicalizes loose input', () => {
    expect(parseFlexibleTime('905')).toBe('09:05')
    expect(parseFlexibleTime('1305')).toBe('13:05')
    expect(parseFlexibleTime('9')).toBe('09:00')
    expect(parseFlexibleTime('9:05pm')).toBe('21:05')
    expect(parseFlexibleTime('12am')).toBe('00:00')
    expect(parseFlexibleTime('12pm')).toBe('12:00')
  })

  it('returns null for empty or invalid input', () => {
    expect(parseFlexibleTime('')).toBeNull()
    expect(parseFlexibleTime(null)).toBeNull()
    expect(parseFlexibleTime('2599')).toBeNull()
  })
})

describe('formatTime', () => {
  it('formats in 24h and 12h clocks', () => {
    expect(formatTime('13:33')).toBe('13:33')
    expect(formatTime('13:33', '12h')).toBe('1:33 PM')
    expect(formatTime('00:05', '12h')).toBe('12:05 AM')
  })

  it('returns empty string for invalid input', () => {
    expect(formatTime('nope')).toBe('')
  })
})

describe('formatDuration & formatDecimalHours', () => {
  it('formats minutes as "H:MM"', () => {
    expect(formatDuration(185)).toBe('3:05')
  })

  it('formats minutes as decimal hours', () => {
    expect(formatDecimalHours(105)).toBe('1.75')
  })
})

describe('totalMinutes', () => {
  it('sums valid rows and ignores invalid ones', () => {
    const rows = [
      { start: '09:00', end: '10:00' },
      { start: '10:00', end: '11:30' },
      { start: '', end: '' },
    ]
    expect(totalMinutes(rows)).toBe(150)
  })
})
