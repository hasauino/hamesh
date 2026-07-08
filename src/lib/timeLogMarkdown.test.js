import { describe, it, expect } from 'vitest'
import {
  buildTimeLogTableMarkdown,
  extractTimeLogFromMarkdown,
} from './timeLogMarkdown.js'

describe('extractTimeLogFromMarkdown', () => {
  it('returns no rows and the trimmed input when there is no table', () => {
    const md = '# Notes\n\nSome thoughts.\n'
    expect(extractTimeLogFromMarkdown(md)).toEqual({
      rows: [],
      notes: '# Notes\n\nSome thoughts.',
    })
  })

  it('lifts the table out, keeping the surrounding notes', () => {
    const table = buildTimeLogTableMarkdown([
      { start: '09:00', end: '10:30', comment: 'standup' },
      { start: '10:30', end: '12:00', comment: 'coding' },
    ])
    const md = `${table}\n\n## Notes\n\nDid the thing.`
    const { rows, notes } = extractTimeLogFromMarkdown(md)
    expect(rows).toEqual([
      { start: '09:00', end: '10:30', comment: 'standup' },
      { start: '10:30', end: '12:00', comment: 'coding' },
    ])
    expect(notes).toBe('## Notes\n\nDid the thing.')
  })

  it('round-trips rows through build -> extract', () => {
    const rows = [
      { start: '08:15', end: '09:00', comment: 'email' },
      { start: '13:00', end: '17:45', comment: 'feature | work' },
    ]
    const { rows: out } = extractTimeLogFromMarkdown(buildTimeLogTableMarkdown(rows))
    expect(out).toEqual(rows)
  })

  it('skips the separator and Total rows', () => {
    const { rows } = extractTimeLogFromMarkdown(
      buildTimeLogTableMarkdown([{ start: '09:00', end: '10:00', comment: '' }]),
    )
    expect(rows).toEqual([{ start: '09:00', end: '10:00', comment: '' }])
  })

  it('normalizes 12h display times back to canonical 24h', () => {
    const table = buildTimeLogTableMarkdown(
      [{ start: '13:00', end: '14:30', comment: 'afternoon' }],
      '12h',
    )
    const { rows } = extractTimeLogFromMarkdown(table)
    expect(rows).toEqual([{ start: '13:00', end: '14:30', comment: 'afternoon' }])
  })
})
