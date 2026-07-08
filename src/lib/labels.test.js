import { describe, it, expect } from 'vitest'
import { extractLabels, buildLabelIndex } from './labels.js'

describe('extractLabels', () => {
  it('extracts single-token labels', () => {
    expect(extractLabels('working on #PROJ-123 and #feature/auth today')).toEqual([
      'PROJ-123',
      'feature/auth',
    ])
  })

  it('extracts multi-word labels from the brace form', () => {
    expect(extractLabels('reviewing #{Sign in flow} now')).toEqual(['Sign in flow'])
  })

  it('allows a literal hash inside a brace label', () => {
    expect(extractLabels('some #{C# notes} here')).toEqual(['C# notes'])
  })

  it('dedupes case-insensitively, keeping first-seen casing', () => {
    expect(extractLabels('#Bug fixed the #bug')).toEqual(['Bug'])
  })

  it('does not match a markdown heading (space after #)', () => {
    expect(extractLabels('# Heading\n\nbody text')).toEqual([])
  })

  it('does not match a mid-word hash', () => {
    expect(extractLabels('using C# and foo#bar')).toEqual([])
  })

  it('matches a label at the very start of the text', () => {
    expect(extractLabels('#standup first thing')).toEqual(['standup'])
  })

  it('returns [] for empty / nullish input', () => {
    expect(extractLabels('')).toEqual([])
    expect(extractLabels(null)).toEqual([])
  })
})

describe('buildLabelIndex', () => {
  it('collapses a multi-day shared-note thread to its earliest day', () => {
    const store = {
      days: {
        '2026-07-06': { noteId: 'n1' },
        '2026-07-07': { noteId: 'n1' }, // same thread, later day
        '2026-07-08': { noteId: 'n2' },
      },
      notes: {
        n1: { content: 'work on #PROJ-123' },
        n2: { content: 'more #PROJ-123 and #other' },
      },
    }
    const index = buildLabelIndex(store)
    const proj = index.find((e) => e.label === 'PROJ-123')
    // n1's thread -> earliest day 2026-07-06; n2 -> 2026-07-08. Newest-first.
    expect(proj.days).toEqual(['2026-07-08', '2026-07-06'])
    const other = index.find((e) => e.label === 'other')
    expect(other.days).toEqual(['2026-07-08'])
  })

  it('indexes labels from time-log comments against their own day', () => {
    const store = {
      days: {
        '2026-07-08': {
          noteId: 'n1',
          logRows: [
            { start: '09:00', end: '10:00', comment: 'standup for #PROJ-123' },
            { start: '10:00', end: '11:00', comment: 'no tag here' },
          ],
        },
      },
      notes: { n1: { content: 'plain notes' } },
    }
    const index = buildLabelIndex(store)
    const proj = index.find((e) => e.label === 'PROJ-123')
    expect(proj.days).toEqual(['2026-07-08'])
  })

  it('sorts labels case-insensitively and ignores orphan notes', () => {
    const store = {
      days: { '2026-07-08': { noteId: 'n1' } },
      notes: {
        n1: { content: '#zebra #Apple' },
        orphan: { content: '#ghost' }, // no day references it
      },
    }
    const index = buildLabelIndex(store)
    expect(index.map((e) => e.label)).toEqual(['Apple', 'zebra'])
  })
})
