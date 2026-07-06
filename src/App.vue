<script setup>
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import TimeTable from './components/TimeTable.vue'
import NotesEditor from './components/NotesEditor.vue'
import Calendar from './components/Calendar.vue'
import SettingsMenu from './components/SettingsMenu.vue'
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
  return [{ start: '', end: '', comment: '' }]
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

// ---- Settings drawer ----
const settingsOpen = ref(false)

// ---- Theme ----
const theme = ref(localStorage.getItem(THEME_KEY) || 'light')
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value)
}
watch(theme, (v) => {
  localStorage.setItem(THEME_KEY, v)
  applyTheme()
})
applyTheme()

// ---- Clock format (24h default, configurable) ----
const clockFormat = ref(localStorage.getItem(CLOCK_KEY) || '24h')
watch(clockFormat, (v) => localStorage.setItem(CLOCK_KEY, v))

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

// Repurpose the browser's Save shortcut (Ctrl/Cmd+S) to export the log instead.
function onSaveShortcut(e) {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault()
    downloadAll()
  }
}
onMounted(() => window.addEventListener('keydown', onSaveShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onSaveShortcut))
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <input class="date-input" v-model="current.label" spellcheck="false" />
      </div>
      <div class="actions">
        <span class="flash" v-if="flash">{{ flash }}</span>
        <button class="icon" @click="copyAll" title="Copy full markdown to clipboard" aria-label="Copy">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9"
            width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
        </button>
        <button class="icon" @click="downloadAll" title="Export as .md file" aria-label="Export">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" /><path
            d="m8 7 4-4 4 4" /><path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" /></svg>
        </button>
        <button class="icon" @click="newDay" title="Start today's log (keeps other days)" aria-label="New day">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path
            d="M5 12h14" /></svg>
        </button>
        <button
          class="icon"
          :class="{ active: view === 'calendar' }"
          @click="view = view === 'calendar' ? 'log' : 'calendar'"
          title="Browse all days"
          aria-label="Days"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4"
            width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="M8 2v4" /><path d="M16 2v4" /></svg>
        </button>
        <button class="icon" @click="settingsOpen = true" title="Settings" aria-label="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12"
            r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65
            1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65
            1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0
            0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1
            2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65
            0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33
            1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
        </button>
      </div>
    </header>

    <SettingsMenu v-model:open="settingsOpen" v-model:theme="theme" v-model:clockFormat="clockFormat" />

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
  min-width: 0;
}
.date-input {
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-weight: 700;
  font-size: 1.6rem;
  line-height: 1.2;
  letter-spacing: -0.01em;
  padding: 0.2rem 0.4rem;
  margin-left: -0.4rem;
  border-radius: 6px;
  width: 20rem;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  padding: 0.4rem 0.5rem;
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
