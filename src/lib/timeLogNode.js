// A time-log table as a first-class Milkdown widget.
//
// Instead of a fixed panel, a time log is a block node inserted from the editor's
// `/` slash menu. It renders the interactive <TimeTable> component (start/end/now
// buttons, live duration + total) and persists as an ordinary GFM table in the
// notes markdown, so it round-trips and reads fine outside the app.
//
// Pieces (all exported via `timeLogPlugins`):
//   • $remark  — on parse, retypes any table whose header is
//                Start | End | Duration | Comment into a `timeLog` mdast node so
//                it hydrates as the widget rather than a plain table.
//   • $node    — the `time_log` prose node: parses that `timeLog` mdast node and
//                serializes back to a real GFM table (duration + total derived).
//   • $view    — a NodeView that mounts <TimeTable>, syncing its rows to/from the
//                node's `rows` attribute.

import { $node, $view, $remark } from '@milkdown/utils'
import { createApp, reactive, watch, h } from 'vue'
import TimeTable from '../components/TimeTable.vue'
import {
  rowMinutes,
  formatDuration,
  formatTime,
  totalMinutes,
  parseFlexibleTime,
} from './time.js'
import { clockFormat as sharedClockFormat } from './settings.js'

const HEADERS = ['start', 'end', 'duration', 'comment']

// ---- Row helpers -----------------------------------------------------------

function blankRow() {
  return { start: '', end: '', comment: '' }
}

// Clone loosely-shaped rows into clean {start,end,comment} objects, guaranteeing
// at least one (blank) row so a widget is never empty.
function normalizeRows(rows) {
  const arr = Array.isArray(rows)
    ? rows.map((r) => ({
        start: r.start || '',
        end: r.end || '',
        comment: r.comment || '',
      }))
    : []
  if (arr.length === 0) arr.push(blankRow())
  return arr
}

function rowIsEmpty(r) {
  return !r.start && !r.end && !r.comment
}

// ---- Markdown round-trip ---------------------------------------------------

// Flatten an mdast cell (text + inline formatting) to its plain string value.
function cellText(node) {
  let out = ''
  const walk = (n) => {
    if (typeof n.value === 'string') out += n.value
    ;(n.children || []).forEach(walk)
  }
  walk(node)
  return out.trim()
}

// Does this mdast table's header match our canonical time-log columns?
function isTimeLogTable(node) {
  if (node.type !== 'table' || !Array.isArray(node.children)) return false
  const header = node.children[0]
  if (!header || !Array.isArray(header.children)) return false
  const labels = header.children.map((c) => cellText(c).toLowerCase())
  return (
    labels.length >= HEADERS.length &&
    HEADERS.every((h, i) => labels[i] === h)
  )
}

// Read the data rows out of a matching mdast table (skipping header + total row),
// normalizing displayed times back to canonical 24h "HH:MM".
function rowsFromTable(node) {
  const rows = []
  for (const row of node.children.slice(1)) {
    const cells = (row.children || []).map(cellText)
    if ((cells[1] || '').toLowerCase() === 'total') continue // total row
    const start = parseFlexibleTime(cells[0] || '') ?? ''
    const end = parseFlexibleTime(cells[1] || '') ?? ''
    const comment = cells[3] || ''
    if (!start && !end && !comment) continue
    rows.push({ start, end, comment })
  }
  return normalizeRows(rows)
}

const textNode = (value) => ({ type: 'text', value: String(value ?? '') })
const strongNode = (value) => ({ type: 'strong', children: [textNode(value)] })

/**
 * Build the canonical time-log GFM table as a markdown string. Used by App.vue to
 * migrate legacy per-day `rows` into notes (where it re-hydrates as a widget).
 */
export function buildTimeLogTableMarkdown(rows, clockFormat = '24h') {
  const lines = [
    '| Start | End | Duration | Comment |',
    '| ----- | --- | -------- | ------- |',
  ]
  for (const r of rows) {
    if (rowIsEmpty(r)) continue
    const dur = formatDuration(rowMinutes(r.start, r.end))
    const start = formatTime(r.start, clockFormat)
    const end = formatTime(r.end, clockFormat)
    lines.push(
      `| ${start} | ${end} | ${dur} | ${(r.comment || '').replace(/\|/g, '\\|')} |`,
    )
  }
  const total = formatDuration(totalMinutes(rows))
  lines.push(`|  | **Total** | **${total}** |  |`)
  return lines.join('\n')
}

// ---- $remark: retype matching tables into `timeLog` nodes ------------------

function retypeTimeLogTables(tree) {
  const walk = (node) => {
    if (!node || !Array.isArray(node.children)) return
    for (const child of node.children) {
      if (isTimeLogTable(child)) {
        const rows = rowsFromTable(child)
        child.type = 'timeLog'
        child.rows = rows
        delete child.children
        delete child.align
      } else {
        walk(child)
      }
    }
  }
  walk(tree)
}

const timeLogRemark = $remark('timeLogWidget', () => () => (tree) => {
  retypeTimeLogTables(tree)
})

// ---- $node: the `time_log` prose node --------------------------------------

export const timeLogNode = $node('time_log', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  attrs: { rows: { default: null } },
  parseDOM: [{ tag: 'div[data-type="time-log"]' }],
  toDOM: () => ['div', { 'data-type': 'time-log' }],
  parseMarkdown: {
    match: (node) => node.type === 'timeLog',
    runner: (state, node, type) => {
      state.addNode(type, { rows: normalizeRows(node.rows) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'time_log',
    runner: (state, node) => {
      const rows = normalizeRows(node.attrs.rows)
      const cf = sharedClockFormat.value

      state.openNode('table', undefined, { align: [null, null, null, null] })

      state.openNode('tableRow')
      for (const label of ['Start', 'End', 'Duration', 'Comment']) {
        state.addNode('tableCell', [textNode(label)])
      }
      state.closeNode()

      for (const r of rows) {
        if (rowIsEmpty(r)) continue
        state.openNode('tableRow')
        state.addNode('tableCell', [textNode(formatTime(r.start, cf))])
        state.addNode('tableCell', [textNode(formatTime(r.end, cf))])
        state.addNode('tableCell', [
          textNode(formatDuration(rowMinutes(r.start, r.end))),
        ])
        state.addNode('tableCell', [textNode(r.comment || '')])
        state.closeNode()
      }

      const total = formatDuration(totalMinutes(rows))
      state.openNode('tableRow')
      state.addNode('tableCell', [textNode('')])
      state.addNode('tableCell', [strongNode('Total')])
      state.addNode('tableCell', [strongNode(total)])
      state.addNode('tableCell', [textNode('')])
      state.closeNode()

      state.closeNode() // table
    },
  },
}))

// ---- $view: mount <TimeTable> as the node's rendering ----------------------

const timeLogView = $view(timeLogNode, () => (node, view, getPos) => {
  const dom = document.createElement('div')
  dom.className = 'time-log-widget'
  dom.setAttribute('data-type', 'time-log')

  const rowsData = reactive(normalizeRows(node.attrs.rows))
  let currentNode = node
  // True while we are dispatching our own attr update, so update() doesn't try
  // to reconcile our change back into the component (which would loop).
  let syncing = false

  const app = createApp({
    setup() {
      return () =>
        h(TimeTable, {
          modelValue: rowsData,
          'onUpdate:modelValue': () => {},
          clockFormat: sharedClockFormat.value,
        })
    },
  })
  app.mount(dom)

  const snapshot = (rows) =>
    JSON.stringify(rows.map((r) => ({ start: r.start, end: r.end, comment: r.comment })))

  // Push component edits into the node's `rows` attr. This also makes the editor
  // fire a markdown update, which is how table edits reach persistence.
  const stop = watch(
    rowsData,
    () => {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (pos == null) return
      const next = normalizeRows(rowsData)
      if (snapshot(next) === snapshot(normalizeRows(currentNode.attrs.rows))) return
      syncing = true
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { rows: next }))
      syncing = false
    },
    { deep: true },
  )

  return {
    dom,
    update(newNode) {
      if (newNode.type !== currentNode.type) return false
      currentNode = newNode
      // Reconcile only genuinely external changes (e.g. undo/redo).
      if (!syncing) {
        const incoming = normalizeRows(newNode.attrs.rows)
        if (snapshot(incoming) !== snapshot(rowsData)) {
          rowsData.splice(0, rowsData.length, ...incoming)
        }
      }
      return true
    },
    // The widget owns its inputs; keep ProseMirror out of their events/mutations.
    stopEvent: () => true,
    ignoreMutation: () => true,
    destroy() {
      stop()
      app.unmount()
    },
  }
})

// Pass to `editor.use(...)`. Flattened so the $remark tuple registers correctly.
export const timeLogPlugins = [timeLogRemark, timeLogNode, timeLogView].flat()
