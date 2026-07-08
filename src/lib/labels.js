// Hashtag "labels" for day notes.
//
// Labels are plain `#tag` text living inside the note markdown — there is no
// separate storage schema. They come in two forms:
//   • single-token   — `#PROJ-123`, `#feature/auth`  (no spaces)
//   • multi-word      — `#{Sign in flow}`, `#{C# notes}`  (braces delimit)
//
// This mirrors how the time-log table lives as extractable text in the markdown
// (see extractTimeLogFromMarkdown): the label index used by search + autocomplete
// is *derived* by scanning note content, keeping a single source of truth. No
// Vue/Milkdown dependencies here so it stays trivial to unit-test.

// A `#` at a word boundary, then either a `{multi word}` group or a single
// token. The `(?<!\S)` guard keeps mid-word `#` from matching, so `C#` and
// `foo#bar` are left alone — and, unlike a `(?:^|\s)` prefix, it doesn't consume
// the preceding character, so matches can be sliced out of text cleanly. The
// multi-word alternative is listed first so `#{...}` wins over the single token.
const LABEL_SOURCE = '(?<!\\S)#(?:\\{([^}\\n]{1,60})\\}|([A-Za-z0-9][A-Za-z0-9_/-]*))'

// A fresh global regex per call — global regexes carry mutable lastIndex state,
// so sharing one instance across callers would be a bug.
export function labelRegex() {
  return new RegExp(LABEL_SOURCE, 'g')
}

// The label text for a regex match: the brace group, else the single token.
export function labelFromMatch(match) {
  const raw = match[1] !== undefined ? match[1] : match[2]
  return raw.trim()
}

// Serialize a label value back to its markdown token: the brace form when it
// contains a space or `#`, otherwise a bare `#token`. Inverse of a match.
export function serializeLabel(value) {
  return /[\s#]/.test(value) ? `#{${value}}` : `#${value}`
}

/**
 * Split a plain string into an ordered list of `{ text }` / `{ label }` parts,
 * e.g. "on #PROJ-1 now" -> [{text:'on '}, {label:'PROJ-1'}, {text:' now'}].
 * Used by the editor's remark transform to turn `#tag` runs into label nodes.
 */
export function splitLabelText(text) {
  const parts = []
  const re = labelRegex()
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    const label = labelFromMatch(m)
    if (!label) continue
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ label })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

/**
 * Extract the deduped labels present in one markdown string, in first-seen
 * order. Comparison for dedupe is case-insensitive; the first-seen casing wins.
 * The extraction analogue of extractTimeLogFromMarkdown.
 */
export function extractLabels(md) {
  const out = []
  const seen = new Set()
  const re = labelRegex()
  let m
  while ((m = re.exec(md || '')) !== null) {
    const label = labelFromMatch(m)
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out
}

/**
 * Build the label index over the whole store. Labels come from two places:
 *   • note markdown       — resolves to the *earliest* day referencing that note
 *                           (a note thread can span multiple days — we surface
 *                           the day it started).
 *   • time-log comments   — resolves to that specific day (a row belongs to one).
 *
 * Returns [{ label, days }] where `days` are representative days sorted
 * newest-first, and the list is sorted by label (case-insensitive).
 */
export function buildLabelIndex(store) {
  const days = (store && store.days) || {}
  const notes = (store && store.notes) || {}

  // label (lowercased key) -> { label: display, days: Set<iso> }
  const byLabel = new Map()
  const add = (label, iso) => {
    const key = label.toLowerCase()
    let entry = byLabel.get(key)
    if (!entry) {
      entry = { label, days: new Set() }
      byLabel.set(key, entry)
    }
    entry.days.add(iso)
  }

  // Notes: labels resolve to the earliest day of the note thread.
  const firstDayOfNote = {}
  for (const [iso, day] of Object.entries(days)) {
    const id = day && day.noteId
    if (!id) continue
    if (!firstDayOfNote[id] || iso < firstDayOfNote[id]) firstDayOfNote[id] = iso
  }
  for (const [id, note] of Object.entries(notes)) {
    const firstDay = firstDayOfNote[id]
    if (!firstDay) continue // orphan note doc, no day references it
    for (const label of extractLabels(note && note.content)) add(label, firstDay)
  }

  // Time-log comments: labels resolve to the day whose row carries them.
  for (const [iso, day] of Object.entries(days)) {
    for (const row of (day && day.logRows) || []) {
      for (const label of extractLabels(row && row.comment)) add(label, iso)
    }
  }

  return Array.from(byLabel.values())
    .map((e) => ({ label: e.label, days: Array.from(e.days).sort().reverse() }))
    .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
}
