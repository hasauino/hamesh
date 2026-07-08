// Hashtag "labels" for the Milkdown editor, as a proper inline **atom node**:
//   • a label renders as a chip showing only its text — the `#`/`{}` markup is
//     never editable text, so the caret moves cleanly *around* the chip (an
//     earlier decoration-based version fought contenteditable and mangled the
//     caret when typing after a `#{…}` tag).
//   • markdown round-trips: `#PROJ-123` / `#{Sign in flow}` <-> a label node.
//   • autocomplete: typing `#que` opens a menu of existing labels to pick from.
//
// The node is text in the markdown (see labels.js), so labels stay searchable.
// Modeled on kbdPlugin (remark transform + schema round-trip) and emojiPlugin
// (the autocomplete menu). Exposes `labelPlugins` for `editor.use(...)`.

import { $nodeSchema, $inputRule, $remark, $prose } from '@milkdown/kit/utils'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import {
  labelRegex,
  labelFromMatch,
  serializeLabel,
  splitLabelText,
} from './labels.js'
import { allLabels } from './labelStore.js'

const MAX_RESULTS = 8

// ---- remark: split `#tag` runs in text into `label` mdast nodes ----
// On the reverse trip a `label` node stringifies straight to its markdown token
// (bypassing text escaping, so a leading `#` isn't turned into `\#`).
function splitLabelsInTree(node) {
  if (!Array.isArray(node.children)) return
  const next = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      const parts = splitLabelText(child.value)
      // No label found (or a single text part): keep the node untouched.
      if (parts.length <= 1 && !(parts[0] && parts[0].label)) {
        next.push(child)
        continue
      }
      for (const part of parts) {
        if (part.label) next.push({ type: 'label', value: part.label })
        else if (part.text) next.push({ type: 'text', value: part.text })
      }
    } else {
      splitLabelsInTree(child) // recurse into emphasis/strong/headings/etc.
      next.push(child)
    }
  }
  node.children = next
}

const labelToMarkdown = {
  handlers: {
    // `value` is the label text; emit the raw token, unescaped.
    label: (node) => serializeLabel(node.value),
  },
}

const labelRemark = $remark('label', () =>
  function labelAttacher() {
    const data = this.data()
    ;(data.toMarkdownExtensions || (data.toMarkdownExtensions = [])).push(
      labelToMarkdown,
    )
    return (tree) => splitLabelsInTree(tree)
  },
)

// ---- label node: an inline atom chip, `#tag` in markdown ----
const labelSchema = $nodeSchema('label', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'span[data-label]',
      getAttrs: (dom) => ({ value: dom.getAttribute('data-label') || '' }),
    },
  ],
  toDOM: (node) => [
    'span',
    { 'data-label': node.attrs.value, class: 'label-chip' },
    node.attrs.value,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'label',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'label',
    runner: (state, node) => {
      state.addNode('label', undefined, node.attrs.value)
    },
  },
}))

// ---- Live rendering: typing a complete label becomes a chip ----
// `#{multi word}` fires when the closing brace is typed; a single `#token` fires
// on the following whitespace (which is re-inserted after the chip). A label
// typed with no trailing char still converts on reload via the remark transform.
const braceInputRule = $inputRule((ctx) =>
  new InputRule(/(?<!\S)#\{([^}\n]{1,60})\}$/, (state, match, start, end) => {
    const value = match[1].trim()
    if (!value) return null
    return state.tr.replaceRangeWith(start, end, labelSchema.type(ctx).create({ value }))
  }),
)

const tokenInputRule = $inputRule((ctx) =>
  new InputRule(/(?<!\S)#([A-Za-z0-9][A-Za-z0-9_/-]*)(\s)$/, (state, match, start, end) => {
    const node = labelSchema.type(ctx).create({ value: match[1] })
    return state.tr.replaceRangeWith(start, end, node).insertText(match[2])
  }),
)

// ---- Autocomplete menu (mirrors emojiPlugin) ----
// Find an open `#query` immediately before the cursor. `(?<!\S)` keeps it from
// firing inside `C#`/`foo#bar`; the space in the class lets an in-progress
// multi-word label keep matching.
const queryRegex = /(?<!\S)#([A-Za-z0-9][A-Za-z0-9_/ -]*)?$/

function getLabelQuery(state) {
  const { $from, empty } = state.selection
  if (!empty) return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
  const match = queryRegex.exec(textBefore)
  if (!match) return null

  const query = match[1] || ''
  const to = $from.pos
  const from = to - query.length - 1 // include the leading `#`
  return { query, from, to }
}

class LabelMenuView {
  constructor(editorView, holder) {
    this.editorView = editorView
    this.holder = holder
    holder.view = this

    this.items = []
    this.index = 0
    this.range = null

    // Reuse emojiPlugin's menu CSS.
    this.dom = document.createElement('div')
    this.dom.className = 'emoji-menu'
    this.dom.style.display = 'none'
    this.dom.addEventListener('mousedown', (e) => e.preventDefault())
    document.body.appendChild(this.dom)
  }

  get open() {
    return this.dom.style.display !== 'none'
  }

  update(view) {
    const match = getLabelQuery(view.state)
    if (!match) return this.hide()

    const q = match.query.toLowerCase()
    // Surface labels that *start with* the query first, then substring matches.
    const results = allLabels.value
      .filter((label) => label.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.toLowerCase().startsWith(q)
        const bs = b.toLowerCase().startsWith(q)
        return as === bs ? a.localeCompare(b) : as ? -1 : 1
      })
      .slice(0, MAX_RESULTS)
    if (!results.length) return this.hide()

    this.range = { from: match.from, to: match.to }
    this.items = results
    if (this.index >= results.length) this.index = 0
    this.render(view)
  }

  render(view) {
    this.dom.innerHTML = ''
    this.items.forEach((item, i) => {
      const el = document.createElement('div')
      el.className = 'emoji-menu-item' + (i === this.index ? ' is-active' : '')
      el.innerHTML = `<span class="emoji-menu-glyph">#</span><span class="emoji-menu-name"></span>`
      el.querySelector('.emoji-menu-name').textContent = item
      el.addEventListener('mouseenter', () => {
        this.index = i
        this.highlight()
      })
      el.addEventListener('click', () => this.select(item))
      this.dom.appendChild(el)
    })

    const coords = view.coordsAtPos(this.range.to)
    this.dom.style.display = 'block'
    this.dom.style.left = `${coords.left}px`
    this.dom.style.top = `${coords.bottom + 4}px`
  }

  highlight() {
    Array.from(this.dom.children).forEach((el, i) =>
      el.classList.toggle('is-active', i === this.index),
    )
  }

  moveSelection(delta) {
    const len = this.items.length
    this.index = (this.index + delta + len) % len
    this.highlight()
    this.dom.children[this.index]?.scrollIntoView({ block: 'nearest' })
  }

  select(item) {
    if (!this.range) return
    const { from, to } = this.range
    const type = this.editorView.state.schema.nodes.label
    const node = type.create({ value: item })
    // Insert the chip then a trailing space so the caret continues after it.
    const tr = this.editorView.state.tr.replaceRangeWith(from, to, node).insertText(' ')
    this.editorView.dispatch(tr)
    this.editorView.focus()
    this.hide()
  }

  onKeyDown(event) {
    if (!this.open) return false
    switch (event.key) {
      case 'ArrowDown':
        this.moveSelection(1)
        return true
      case 'ArrowUp':
        this.moveSelection(-1)
        return true
      case 'Enter':
      case 'Tab':
        this.select(this.items[this.index])
        return true
      case 'Escape':
        this.hide()
        return true
      default:
        return false
    }
  }

  hide() {
    this.dom.style.display = 'none'
    this.range = null
  }

  destroy() {
    this.dom.remove()
    this.holder.view = null
  }
}

const labelMenu = $prose(() => {
  const holder = { view: null }
  return new Plugin({
    key: new PluginKey('MILKDOWN_LABEL_MENU'),
    props: {
      handleKeyDown: (_view, event) => holder.view?.onKeyDown(event) ?? false,
    },
    view: (editorView) => new LabelMenuView(editorView, holder),
  })
})

export const labelPlugins = [
  labelRemark,
  labelSchema,
  braceInputRule,
  tokenInputRule,
  labelMenu,
]
