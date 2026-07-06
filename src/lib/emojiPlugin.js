// Markdown emoji support for the Milkdown editor:
//   • live rendering  — typing `:dart:` (closing colon) swaps in 🎯
//   • autocomplete     — typing `:dar` opens a menu of matching shortcodes
//                        that you can arrow through and confirm with Enter/Tab.
//
// Exposes `emojiPlugins`, an array you pass to `editor.use(...)`.

import { $inputRule, $prose } from '@milkdown/utils'
import { InputRule } from '@milkdown/prose/inputrules'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { get as getEmoji, search as searchEmoji } from 'node-emoji'

// Shortcodes are lowercase letters/digits with _ + - separators, e.g. `:+1:`.
const SHORTCODE = '[a-z0-9_+-]+'
const MAX_RESULTS = 8

// ---- Live rendering: `:shortcode:` -> emoji when the closing colon is typed ----
const emojiInputRule = $inputRule(
  () =>
    new InputRule(new RegExp(`:(${SHORTCODE}):$`), (state, match, start, end) => {
      const emoji = getEmoji(match[1])
      if (!emoji) return null // unknown shortcode — leave the text as-is
      return state.tr.insertText(emoji, start, end)
    }),
)

// ---- Autocomplete menu ----
// Finds an open `:query` immediately before the cursor (no closing colon yet).
// The trigger colon must sit at the start of the block or after whitespace so
// we don't fire inside URLs or emoticons like `foo:bar`.
const queryRegex = new RegExp(`(?:^|\\s):(${SHORTCODE})$`)

function getEmojiQuery(state) {
  const { $from, empty } = state.selection
  if (!empty) return null

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
  const match = queryRegex.exec(textBefore)
  if (!match) return null

  const query = match[1]
  if (query.length < 2) return null // wait for a couple chars before suggesting

  const to = $from.pos
  const from = to - query.length - 1 // include the leading `:`
  return { query, from, to }
}

class EmojiMenuView {
  constructor(editorView, holder) {
    this.editorView = editorView
    this.holder = holder
    holder.view = this

    this.items = []
    this.index = 0
    this.range = null

    this.dom = document.createElement('div')
    this.dom.className = 'emoji-menu'
    this.dom.style.display = 'none'
    // Clicking an item must not blur the editor before we can act on it.
    this.dom.addEventListener('mousedown', (e) => e.preventDefault())
    document.body.appendChild(this.dom)
  }

  get open() {
    return this.dom.style.display !== 'none'
  }

  update(view) {
    const match = getEmojiQuery(view.state)
    if (!match) return this.hide()

    // node-emoji matches substrings; surface shortcodes that *start with* the
    // query first (e.g. `:dar` -> `:dart:` before `:calendar:`).
    const q = match.query
    const results = searchEmoji(q)
      .sort((a, b) => a.name.startsWith(q) === b.name.startsWith(q) ? 0 : a.name.startsWith(q) ? -1 : 1)
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
      el.innerHTML = `<span class="emoji-menu-glyph">${item.emoji}</span><span class="emoji-menu-name">:${item.name}:</span>`
      el.addEventListener('mouseenter', () => {
        this.index = i
        this.highlight()
      })
      el.addEventListener('click', () => this.select(item))
      this.dom.appendChild(el)
    })

    // Position the menu just below the cursor.
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
    const tr = this.editorView.state.tr.insertText(item.emoji, from, to)
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

const emojiMenu = $prose(() => {
  const holder = { view: null }
  return new Plugin({
    key: new PluginKey('MILKDOWN_EMOJI_MENU'),
    props: {
      handleKeyDown: (_view, event) => holder.view?.onKeyDown(event) ?? false,
    },
    view: (editorView) => new EmojiMenuView(editorView, holder),
  })
})

export const emojiPlugins = [emojiInputRule, emojiMenu]
