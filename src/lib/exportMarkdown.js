/**
 * Build the full markdown document: a title followed by the notes markdown.
 * Time-log tables now live inside the notes themselves (as widgets that
 * serialize to GFM tables), so there's nothing to merge in separately.
 */
export function buildMarkdown({ date, notes }) {
  const lines = []
  if (date) lines.push(`# ${date}`, '')

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
