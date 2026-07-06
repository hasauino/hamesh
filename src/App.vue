<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue'
import TimeTable from './components/TimeTable.vue'
import NotesEditor from './components/NotesEditor.vue'
import { buildMarkdown, downloadMarkdown } from './lib/exportMarkdown.js'

const STORAGE_KEY = 'notes-app-v1'
const THEME_KEY = 'notes-theme'
const CLOCK_KEY = 'notes-clock'

function todayLabel() {
  const d = new Date()
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
  return `${iso} · ${weekday}`
}

function blankRows() {
  return [
    { start: '', end: '', comment: '' },
    { start: '', end: '', comment: '' },
    { start: '', end: '', comment: '' },
  ]
}

// ---- Load persisted state (synchronously, before the editor mounts) ----
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
})()

const state = reactive({
  date: saved?.date ?? todayLabel(),
  rows: saved?.rows?.length ? saved.rows : blankRows(),
})
const notes = ref(saved?.notes ?? '')

// editorKey forces a remount of the WYSIWYG editor when we replace its content.
const editorKey = ref(0)
const editorRef = ref(null)

// ---- Theme ----
const theme = ref(localStorage.getItem(THEME_KEY) || 'light')
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value)
}
function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem(THEME_KEY, theme.value)
  applyTheme()
}
applyTheme()

// ---- Clock format (24h default, configurable) ----
const clockFormat = ref(localStorage.getItem(CLOCK_KEY) || '24h')
function toggleClock() {
  clockFormat.value = clockFormat.value === '24h' ? '12h' : '24h'
  localStorage.setItem(CLOCK_KEY, clockFormat.value)
}

// ---- Persistence ----
let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: state.date, rows: state.rows, notes: notes.value }),
    )
  }, 250)
}
watch(state, persist, { deep: true })
watch(notes, persist)

function onNotesChange(markdown) {
  notes.value = markdown
}

// ---- Export ----
const flash = ref('')
function showFlash(msg) {
  flash.value = msg
  setTimeout(() => (flash.value = ''), 1600)
}

function currentMarkdown() {
  // Pull the freshest notes straight from the editor.
  const md = editorRef.value?.getMarkdown() ?? notes.value
  return buildMarkdown({
    date: state.date,
    rows: state.rows,
    notes: md,
    clockFormat: clockFormat.value,
  })
}

async function copyAll() {
  try {
    await navigator.clipboard.writeText(currentMarkdown())
    showFlash('Copied markdown')
  } catch {
    showFlash('Copy failed')
  }
}

function downloadAll() {
  const safeDate = (state.date.split('·')[0] || 'log').trim().replace(/[^\d-]/g, '') || 'log'
  downloadMarkdown(`log-${safeDate}.md`, currentMarkdown())
}

function newDay() {
  if (!confirm('Start a new day? This clears the table and notes.')) return
  state.date = todayLabel()
  state.rows = blankRows()
  notes.value = ''
  editorKey.value++ // remount editor empty
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="dot"></span>
        <input class="date-input" v-model="state.date" spellcheck="false" />
      </div>
      <div class="actions">
        <span class="flash" v-if="flash">{{ flash }}</span>
        <button @click="copyAll" title="Copy full markdown to clipboard">Copy</button>
        <button @click="downloadAll" title="Download as .md file">Export</button>
        <button @click="newDay" title="Clear and start a new day">New day</button>
        <button
          @click="toggleClock"
          :title="`Clock display: ${clockFormat}. Click for ${clockFormat === '24h' ? '12h' : '24h'}.`"
        >
          {{ clockFormat }}
        </button>
        <button class="icon" @click="toggleTheme" :title="`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`">
          {{ theme === 'light' ? '☾' : '☀' }}
        </button>
      </div>
    </header>

    <main>
      <section class="panel">
        <TimeTable v-model="state.rows" :clock-format="clockFormat" />
      </section>

      <section class="panel notes-panel">
        <NotesEditor
          ref="editorRef"
          :key="editorKey"
          :initial-value="notes"
          @change="onNotesChange"
        />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 6rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text);
  flex: none;
}
.date-input {
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-weight: 600;
  font-size: 1rem;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  width: 15rem;
  max-width: 100%;
}
.date-input:focus {
  outline: none;
  background: var(--input-focus);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.actions button {
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.85rem;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.actions button:hover {
  background: var(--hover);
  color: var(--text);
}
.actions button.icon {
  font-size: 1rem;
  padding: 0.4rem 0.55rem;
}
.flash {
  font-size: 0.8rem;
  color: var(--muted);
  margin-right: 0.4rem;
}

.panel {
  margin-bottom: 2.25rem;
}
.notes-panel {
  border-top: 1px solid var(--border);
  padding-top: 1.25rem;
}
</style>
