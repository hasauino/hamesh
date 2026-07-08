// Keyboard-key support for the Milkdown editor, matching the `<kbd>…</kbd>`
// syntax Typora uses to render keys:
//   • round-trip        — markdown `<kbd>ctrl</kbd>` loads as a styled key and
//                          saves back out as `<kbd>ctrl</kbd>`
//   • live rendering     — typing `<kbd>ctrl</kbd>` converts to a key inline
//
// Exposes `kbdPlugins`, an array you pass to `editor.use(...)`.
//
// remark parses inline HTML as *separate* `html` nodes for the open and close
// tags with the content as plain nodes in between (e.g. `<kbd>`, `ctrl`,
// `</kbd>`). The remark plugin below collapses each such run into a single
// `kbd` mdast node; the mark schema then turns that into a `kbd` mark (and back).

import { $markSchema, $inputRule, $remark } from '@milkdown/kit/utils'
import { markRule } from '@milkdown/kit/prose'

const OPEN_TAG = /^<kbd(?:\s[^>]*)?>$/i
const CLOSE_TAG = /^<\/kbd>$/i

// ---- remark: collapse `<kbd>` … `</kbd>` html runs into a `kbd` node ----
// Also registers the reverse stringify handler so `kbd` nodes serialize back
// to `<kbd>…</kbd>` instead of tripping remark's "unknown node" error.
function collapseKbd(node) {
  if (!Array.isArray(node.children)) return

  const next = []
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    if (child.type === 'html' && OPEN_TAG.test(child.value)) {
      // Look for the matching close tag among the following siblings.
      const close = node.children.findIndex(
        (n, j) => j > i && n.type === 'html' && CLOSE_TAG.test(n.value),
      )
      if (close !== -1) {
        const inner = node.children.slice(i + 1, close)
        next.push({ type: 'kbd', children: inner })
        i = close // skip past the close tag
        continue
      }
    }
    next.push(child)
  }
  node.children = next
  node.children.forEach(collapseKbd)
}

// mdast-util-to-markdown handler: children are inline/phrasing content.
const kbdToMarkdown = {
  handlers: {
    kbd: (node, _parent, state, info) => {
      const inner = state.containerPhrasing(node, {
        ...info,
        before: '>',
        after: '<',
      })
      return `<kbd>${inner}</kbd>`
    },
  },
}

// A unified/remark plugin. `this` is the processor, so we can register the
// reverse (stringify) handler alongside the parse-time tree transform.
const kbdRemark = $remark('kbd', () =>
  function kbdAttacher() {
    const data = this.data()
    ;(data.toMarkdownExtensions || (data.toMarkdownExtensions = [])).push(
      kbdToMarkdown,
    )
    return (tree) => collapseKbd(tree)
  },
)

// ---- kbd mark: <kbd> in the DOM, `kbd` node in markdown ----
const kbdSchema = $markSchema('kbd', () => ({
  inclusive: false,
  parseDOM: [{ tag: 'kbd' }],
  toDOM: () => ['kbd', 0],
  parseMarkdown: {
    match: (node) => node.type === 'kbd',
    runner: (state, node, markType) => {
      state.openMark(markType)
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'kbd',
    runner: (state, mark) => {
      state.withMark(mark, 'kbd')
    },
  },
}))

// ---- Live rendering: typing `<kbd>…</kbd>` becomes a key ----
const kbdInputRule = $inputRule((ctx) =>
  markRule(/<kbd(?:\s[^>]*)?>([^<]+)<\/kbd>$/i, kbdSchema.type(ctx)),
)

export const kbdPlugins = [kbdRemark, kbdSchema, kbdInputRule]
