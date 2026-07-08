<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { codeBlockConfig } from '@milkdown/kit/component/code-block'
import { commandsCtx } from '@milkdown/kit/core'
import {
  addBlockTypeCommand,
  clearTextInCurrentBlockCommand,
} from '@milkdown/kit/preset/commonmark'
import { emojiPlugins } from '../lib/emojiPlugin.js'
import { kbdPlugins } from '../lib/kbdPlugin.js'
import { timeLogPlugins, timeLogNode } from '../lib/timeLogNode.js'

// Clock face — used both for the slash-menu item and matching the in-table button.
const clockIcon =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'

const props = defineProps({
  // Initial markdown. Only read once on mount — the editor owns state after that.
  initialValue: { type: String, default: '' },
})
const emit = defineEmits(['change'])

const host = ref(null)
let crepe = null

onMounted(async () => {
  crepe = new Crepe({
    root: host.value,
    defaultValue: props.initialValue,
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: '',
      },
      // Add "Time log" to the slash menu's advanced group. Mirrors how the
      // built-in Table item inserts its block.
      [Crepe.Feature.BlockEdit]: {
        buildMenu: (builder) => {
          builder.getGroup('advanced').addItem('time-log', {
            label: 'Time log',
            icon: clockIcon,
            onRun: (ctx) => {
              const commands = ctx.get(commandsCtx)
              commands.call(clearTextInCurrentBlockCommand.key)
              commands.call(addBlockTypeCommand.key, {
                nodeType: timeLogNode.type(ctx),
              })
            },
          })
        },
      },
    },
  })

  // Register the time-log widget (node + markdown round-trip + node view).
  crepe.editor.use(timeLogPlugins)

  // Math (LaTeX) blocks start collapsed to just their rendered preview; the
  // source is revealed on focus (see the click handler below + main.css).
  crepe.editor.config((ctx) => {
    ctx.update(codeBlockConfig.key, (prev) => ({
      ...prev,
      previewOnlyByDefault: true,
    }))
  })

  // Add markdown emoji support (`:dart:` autocomplete + live rendering).
  crepe.editor.use(emojiPlugins)

  // Add `<kbd>ctrl</kbd>` keyboard-key support (Typora-compatible).
  crepe.editor.use(kbdPlugins)

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      emit('change', markdown)
    })
  })

  await crepe.create()

  // Clicking a math block's rendered preview drops the cursor into its source
  // editor, which reveals it (`:focus-within` in main.css). Non-math code
  // blocks have no KaTeX preview and are left untouched.
  host.value?.addEventListener('mousedown', onMathPreviewMousedown)
})

// Route a click on the rendered math into the (collapsed) source editor.
function onMathPreviewMousedown(e) {
  const block = e.target.closest?.('.milkdown-code-block')
  if (!block || !block.querySelector('.preview .katex')) return
  // Leave toolbar buttons and clicks already inside the source editor alone.
  if (e.target.closest('.tools') || e.target.closest('.codemirror-host')) return
  const content = block.querySelector('.cm-content')
  if (!content) return
  // Take focus ourselves so the browser doesn't select the KaTeX markup.
  e.preventDefault()
  content.focus()
}

onBeforeUnmount(() => {
  host.value?.removeEventListener('mousedown', onMathPreviewMousedown)
  crepe?.destroy()
  crepe = null
})

// Exposed so the parent can pull the latest markdown on demand (e.g. export).
function getMarkdown() {
  return crepe ? crepe.getMarkdown() : props.initialValue
}

defineExpose({ getMarkdown })
</script>

<template>
  <div ref="host" class="notes-editor"></div>
</template>

<style scoped>
.notes-editor {
  width: 100%;
}
</style>
