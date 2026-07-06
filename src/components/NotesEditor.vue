<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { codeBlockConfig } from '@milkdown/kit/component/code-block'
import { emojiPlugins } from '../lib/emojiPlugin.js'

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
    },
  })

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
