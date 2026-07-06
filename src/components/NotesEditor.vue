<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Crepe } from '@milkdown/crepe'
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
        text: 'Write your notes… type “/” for commands',
      },
    },
  })

  // Add markdown emoji support (`:dart:` autocomplete + live rendering).
  crepe.editor.use(emojiPlugins)

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      emit('change', markdown)
    })
  })

  await crepe.create()
})

onBeforeUnmount(() => {
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
