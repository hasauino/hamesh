import { rowMinutes, formatDuration, totalMinutes } from './time.js'

/**
 * Build the full markdown document: a GitHub-style time table followed by the
 * notes markdown. Mirrors the layout of the original log.md.
 */
export function buildMarkdown({ date, rows, notes }) {
  const lines = []

  if (date) lines.push(`# ${date}`, '')

  lines.push('| Start | End | Duration | Comment |')
  lines.push('| ----- | --- | -------- | ------- |')

  for (const r of rows) {
    // Skip completely empty rows to keep the export clean.
    if (!r.start && !r.end && !r.comment) continue
    const dur = formatDuration(rowMinutes(r.start, r.end))
    lines.push(
      `| ${r.start || ''} | ${r.end || ''} | ${dur} | ${(r.comment || '').replace(/\|/g, '\\|')} |`,
    )
  }

  const total = formatDuration(totalMinutes(rows))
  lines.push(`|  | **Total** | **${total}** |  |`)
  lines.push('')

  const trimmedNotes = (notes || '').trim()
  if (trimmedNotes) {
    lines.push(trimmedNotes, '')
  }

  return lines.join('\n')
}

/** Trigger a browser download of the given text as a .md file. */
export function downloadMarkdown(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
