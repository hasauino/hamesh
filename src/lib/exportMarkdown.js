/**
 * Build the full markdown document: a title, the day's time-log table (as GFM),
 * then the notes markdown. The log and notes are separate structured data, so
 * they're merged here for export.
 */
export function buildMarkdown({ date, log, notes }) {
  const lines = []
  if (date) lines.push(`# ${date}`, '')

  const trimmedLog = (log || '').trim()
  if (trimmedLog) lines.push(trimmedLog, '')

  const trimmedNotes = (notes || '').trim()
  if (trimmedNotes) lines.push(trimmedNotes, '')

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
