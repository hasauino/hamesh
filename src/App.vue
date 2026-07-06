<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue'
import TimeTable from './components/TimeTable.vue'
import NotesEditor from './components/NotesEditor.vue'
import Calendar from './components/Calendar.vue'
import { buildMarkdown, downloadMarkdown } from './lib/exportMarkdown.js'

const STORAGE_KEY = 'notes-app-days-v1'
const OLD_STORAGE_KEY = 'notes-app-v1'
const THEME_KEY = 'notes-theme'
const CLOCK_KEY = 'notes-clock'

function isoOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function labelForIso(iso) {
  const weekday = new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
  })
  return `${iso} · ${weekday}`
}

function blankRows() {
  return [
    { start: '', end: '', comment: '' },
    { start: '', end: '', comment: '' },
    { start: '', end: '', comment: '' },
  ]
}

function blankDay(iso) {
  return { label: labelForIso(iso), rows: blankRows(), notes: '' }
}

function isEmptyDay(day) {
  if (!day) return true
  if (day.notes && day.notes.trim()) return false
  return (day.rows || []).every((r) => !r.start && !r.end && !r.comment)
}

// ---- Load persisted state (synchronously, before the editor mounts) ----
// Storage shape: { days: { "YYYY-MM-DD": { label, rows, notes } }, current }
function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (s && s.days) return s
  } catch {}
  // Migrate the previous single-day format, if present.
  try {
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null')
    if (old) {
      const m = String(old.date || '').match(/\d{4}-\d{2}-\d{2}/)
      const iso = m ? m[0] : isoOf()
      return {
        days: {
          [iso]: {
            label: old.date || labelForIso(iso),
            rows: old.rows?.length ? old.rows : blankRows(),
            notes: old.notes ?? '',
          },
        },
        current: iso,
      }
    }
  } catch {}
  const iso = isoOf()
  return { days: { [iso]: blankDay(iso) }, current: iso }
}

const store = reactive(loadStore())

// On open, show today's log (create a blank one in memory if it doesn't exist).
const todayIso = isoOf()
if (!store.days[todayIso]) store.days[todayIso] = blankDay(todayIso)
store.current = todayIso

// The currently-open day. Editing its fields mutates storage directly.
const current = computed(() => store.days[store.current])

// Days that should appear on the calendar: anything with content, plus the
// day that's currently open (so an in-progress blank day is still selectable).
const logDays = computed(() => {
  const set = new Set()
  for (const iso of Object.keys(store.days)) {
    if (iso === store.current || !isEmptyDay(store.days[iso])) set.add(iso)
  }
  return set
})

// View toggle: 'log' (the editor) or 'calendar' (day picker).
const view = ref('log')

// editorKey forces a remount of the WYSIWYG editor when we switch days.
const editorKey = ref(0)
const editorRef = ref(null)

function openDay(iso) {
  if (!store.days[iso]) store.days[iso] = blankDay(iso)
  store.current = iso
  editorKey.value++ // remount editor with the new day's notes
  view.value = 'log'
}

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
    // Drop empty days (except the open one) so the calendar stays clean.
    for (const iso of Object.keys(store.days)) {
      if (iso !== store.current && isEmptyDay(store.days[iso])) delete store.days[iso]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }, 250)
}
watch(store, persist, { deep: true })

function onNotesChange(markdown) {
  current.value.notes = markdown
}

// ---- Export ----
const flash = ref('')
function showFlash(msg) {
  flash.value = msg
  setTimeout(() => (flash.value = ''), 1600)
}

function currentMarkdown() {
  // Pull the freshest notes straight from the editor.
  const md = editorRef.value?.getMarkdown() ?? current.value.notes
  return buildMarkdown({
    date: current.value.label,
    rows: current.value.rows,
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
  const safeDate =
    (current.value.label.split('·')[0] || 'log').trim().replace(/[^\d-]/g, '') || 'log'
  downloadMarkdown(`log-${safeDate}.md`, currentMarkdown())
}

// Switch to today's log without discarding the day currently open — the old
// day stays in storage and remains reachable from the calendar.
function newDay() {
  openDay(isoOf())
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="dot"></span>
        <input class="date-input" v-model="current.label" spellcheck="false" />
      </div>
      <div class="actions">
        <span class="flash" v-if="flash">{{ flash }}</span>
        <button @click="copyAll" title="Copy full markdown to clipboard">Copy</button>
        <button @click="downloadAll" title="Download as .md file">Export</button>
        <button @click="newDay" title="Start today's log (keeps other days)">New day</button>
        <button
          :class="{ active: view === 'calendar' }"
          @click="view = view === 'calendar' ? 'log' : 'calendar'"
          title="Browse all days"
        >
          Days
        </button>
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

    <main v-show="view === 'calendar'">
      <Calendar
        :log-days="logDays"
        :selected="store.current"
        :today="todayIso"
        @select="openDay"
        @close="view = 'log'"
      />
    </main>

    <main v-show="view === 'log'">
      <section class="panel">
        <TimeTable v-model="current.rows" :clock-format="clockFormat" />
      </section>

      <section class="panel notes-panel">
        <NotesEditor
          ref="editorRef"
          :key="editorKey"
          :initial-value="current.notes"
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
.actions button.active {
  color: #ff3b30;
  background: var(--hover);
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
