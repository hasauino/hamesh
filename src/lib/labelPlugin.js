// Hashtag "labels" for the Milkdown editor:
//   • chips        — `#PROJ-123` / `#{Sign in flow}` render as styled pills
//   • autocomplete — typing `#que` opens a menu of existing labels to pick from
//
// Chips are render-only *decorations*: the underlying markdown stays exactly
// `#tag`, so labels round-trip, export, and stay searchable (see labels.js).
// This differs deliberately from kbdPlugin's mark, which rewrites the text.
//
// The autocomplete is a near-clone of emojiPlugin's menu (query detection +
// floating menu + keyboard nav), sourcing its suggestions from labelStore's
// shared `allLabels` ref. Exposes `labelPlugins` for `editor.use(...)`.

import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { labelRegex, labelFromMatch } from './labels.js'
import { allLabels } from './labelStore.js'

const MAX_RESULTS = 8

// ---- Chip decorations: paint every `#tag` in the doc with a class ----
function buildDecorations(doc) {
  const decos = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    // Leave inline-code spans as literal text.
    if (node.marks.some((m) => m.type.name === 'code')) return
    const re = labelRegex()
    let m
    while ((m = re.exec(node.text)) !== null) {
      if (!labelFromMatch(m)) continue
      // The match may include a leading boundary char; anchor on the `#`.
      const startInText = m.index + m[0].indexOf('#')
      const endInText = m.index + m[0].length
      decos.push(
        Decoration.inline(pos + startInText, pos + endInText, { class: 'label-chip' }),
      )
    }
  })
  return DecorationSet.create(doc, decos)
}

const labelDecorations = $prose(
  () =>
    new Plugin({
      key: new PluginKey('MILKDOWN_LABEL_DECORATIONS'),
      props: {
        decorations(state) {
          return buildDecorations(state.doc)
        },
      },
    }),
)

// ---- Autocomplete menu ----
// Find an open `#query` immediately before the cursor. The `#` must sit at the
// start of the block or after whitespace so we don't fire inside `C#`/`foo#bar`.
// Query chars mirror the single-token label grammar (letters/digits/_-/ + a
// space so an in-progress multi-word label keeps matching).
const queryRegex = /(?:^|\s)#([A-Za-z0-9][A-Za-z0-9_/ -]*)?$/

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

// A label with a space or `#` needs the `#{...}` brace form; otherwise a plain
// `#tag`.
function insertionText(label) {
  return /[\s#]/.test(label) ? `#{${label}}` : `#${label}`
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
    const tr = this.editorView.state.tr.insertText(insertionText(item), from, to)
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

export const labelPlugins = [labelDecorations, labelMenu]
