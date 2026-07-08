// Pure markdown round-trip for the time-log table.
//
// The time log is structured per-day data ([{start,end,comment}]). These helpers
// convert it to/from the canonical GFM table
//   | Start | End | Duration | Comment |
// so it can be exported into a markdown document (build) and lifted back out of
// legacy notes during migration (extract). No Vue/Milkdown dependencies — just
// the time helpers — so this stays easy to unit-test.

import {
  rowMinutes,
  formatDuration,
  formatTime,
  totalMinutes,
  parseFlexibleTime,
} from './time.js'

function rowIsEmpty(r) {
  return !r.start && !r.end && !r.comment
}

/**
 * Build the canonical time-log GFM table as a markdown string. Empty rows are
 * skipped; a bold **Total** row is appended.
 */
export function buildTimeLogTableMarkdown(rows, clockFormat = '24h') {
  const lines = [
    '| Start | End | Duration | Comment |',
    '| ----- | --- | -------- | ------- |',
  ]
  for (const r of rows || []) {
    if (rowIsEmpty(r)) continue
    const dur = formatDuration(rowMinutes(r.start, r.end))
    const start = formatTime(r.start, clockFormat)
    const end = formatTime(r.end, clockFormat)
    lines.push(
      `| ${start} | ${end} | ${dur} | ${(r.comment || '').replace(/\|/g, '\\|')} |`,
    )
  }
  const total = formatDuration(totalMinutes(rows || []))
  lines.push(`|  | **Total** | **${total}** |  |`)
  return lines.join('\n')
}

/**
 * Split a day's markdown into structured log rows + the remaining notes. Inverse
 * of buildTimeLogTableMarkdown: line-scans for the canonical table block (header
 * `| Start | End | Duration | Comment |`) and lifts it out, normalizing displayed
 * times back to canonical 24h "HH:MM". Returns { rows, notes }; if no table is
 * present, rows is empty and notes is the (trimmed) input unchanged.
 */
export function extractTimeLogFromMarkdown(md) {
  const lines = (md || '').split('\n')
  const headerRe = /^\s*\|\s*start\s*\|\s*end\s*\|\s*duration\s*\|\s*comment\s*\|/i
  const start = lines.findIndex((l) => headerRe.test(l))
  if (start === -1) return { rows: [], notes: (md || '').trim() }

  let end = start
  while (end < lines.length && lines[end].trim().startsWith('|')) end++

  const cellsOf = (line) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/) // split on unescaped pipes only
      .map((c) => c.trim().replace(/\\\|/g, '|'))
  const isSeparator = (cells) => cells.every((c) => /^:?-+:?$/.test(c))
  const strip = (c) => c.replace(/\*\*/g, '').trim()

  const rows = []
  for (let i = start + 1; i < end; i++) {
    const cells = cellsOf(lines[i])
    if (isSeparator(cells)) continue
    if (strip(cells[1] || '').toLowerCase() === 'total') continue
    const startT = parseFlexibleTime(cells[0] || '') ?? ''
    const endT = parseFlexibleTime(cells[1] || '') ?? ''
    const comment = cells[3] || ''
    if (!startT && !endT && !comment) continue
    rows.push({ start: startT, end: endT, comment })
  }

  const notes = [...lines.slice(0, start), ...lines.slice(end)].join('\n').trim()
  return { rows, notes }
}
