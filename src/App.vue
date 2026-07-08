<script setup>
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import NotesEditor from './components/NotesEditor.vue'
import Calendar from './components/Calendar.vue'
import SettingsView from './components/SettingsView.vue'
import SearchView from './components/SearchView.vue'
import TimeTable from './components/TimeTable.vue'
import { buildLabelIndex } from './lib/labels.js'
import { allLabels } from './lib/labelStore.js'
import { buildMarkdown, downloadMarkdown } from './lib/exportMarkdown.js'
import {
  buildTimeLogTableMarkdown,
  extractTimeLogFromMarkdown,
} from './lib/timeLogMarkdown.js'
import { clockFormat as sharedClockFormat } from './lib/settings.js'

const STORAGE_KEY = 'notes-app-days-v3'
const V2_STORAGE_KEY = 'notes-app-days-v2' // one markdown blob per day (table embedded)
const V1_STORAGE_KEY = 'notes-app-days-v1' // time table stored separately from notes
const OLD_STORAGE_KEY = 'notes-app-v1' // original single-day format
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

function blankRow() {
  return { start: '', end: '', comment: '' }
}

function freshNoteId() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// A new, empty day: one blank log row + a link to a notes document.
function newDayObject(iso, noteId) {
  return { label: labelForIso(iso), logRows: [blankRow()], noteId }
}

// ---- Migration: unfold a v2 day's embedded time-log table ------------------

// Fold a legacy day's separate `rows` into its notes markdown (v1/old -> v2),
// which extractTimeLogFromMarkdown then lifts back out during the v2 -> v3 split.
function foldRowsIntoNotes(day) {
  const rows = day.rows || []
  const hasRows = rows.some((r) => r.start || r.end || r.comment)
  let notes = day.notes || ''
  if (hasRows) {
    const clock = localStorage.getItem(CLOCK_KEY) || '24h'
    const table = buildTimeLogTableMarkdown(rows, clock)
    notes = notes.trim() ? `${table}\n\n${notes}` : table
  }
  return { label: day.label, notes }
}

// Split a v2 day ({label, notes}) into a v3 day + its own notes document, which
// is recorded into `notesOut`. Each legacy day was independent, so each gets a
// fresh note doc.
function splitV2Day(iso, day, notesOut) {
  const { rows, notes } = extractTimeLogFromMarkdown(day.notes || '')
  const noteId = freshNoteId()
  notesOut[noteId] = { content: notes }
  return {
    label: day.label || labelForIso(iso),
    logRows: rows.length ? rows : [blankRow()],
    noteId,
  }
}

// Collapse whichever legacy format is present into a v2-shaped day map
// ({ days: { iso: { label, notes } }, current }), or null if none exists.
function loadLegacyV2Days() {
  try {
    const v2 = JSON.parse(localStorage.getItem(V2_STORAGE_KEY) || 'null')
    if (v2 && v2.days) return v2
  } catch {}
  try {
    const v1 = JSON.parse(localStorage.getItem(V1_STORAGE_KEY) || 'null')
    if (v1 && v1.days) {
      const days = {}
      for (const [iso, day] of Object.entries(v1.days)) days[iso] = foldRowsIntoNotes(day)
      return { days, current: v1.current }
    }
  } catch {}
  try {
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null')
    if (old) {
      const m = String(old.date || '').match(/\d{4}-\d{2}-\d{2}/)
      const iso = m ? m[0] : isoOf()
      const day = foldRowsIntoNotes({
        label: old.date || labelForIso(iso),
        rows: old.rows,
        notes: old.notes,
      })
      return { days: { [iso]: day }, current: iso }
    }
  } catch {}
  return null
}

// ---- Load persisted state (synchronously, before the editor mounts) ----
// Storage shape: { days: { iso: { label, logRows, noteId } }, notes: { id: { content } }, current }
function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (s && s.days && s.notes) return s
  } catch {}
  // Migrate whichever legacy format exists into the split (log + notes) shape.
  const legacy = loadLegacyV2Days()
  if (legacy) {
    const days = {}
    const notes = {}
    for (const [iso, day] of Object.entries(legacy.days)) {
      days[iso] = splitV2Day(iso, day, notes)
    }
    return { days, notes, current: legacy.current }
  }
  // Fresh install.
  const iso = isoOf()
  const id = freshNoteId()
  return { days: { [iso]: newDayObject(iso, id) }, notes: { [id]: { content: '' } }, current: iso }
}

const store = reactive(loadStore())
if (!store.notes) store.notes = {}

// ---- Note documents & days -------------------------------------------------

function ensureNote(id) {
  if (!store.notes[id]) store.notes[id] = { content: '' }
}

// The chronologically-previous existing day, used to continue its notes.
function latestDayBefore(iso) {
  let best = null
  for (const k of Object.keys(store.days)) {
    if (k < iso && (best === null || k > best)) best = k
  }
  return best
}

// Ensure a day exists. New days continue the previous day's notes by default.
function ensureDay(iso) {
  if (store.days[iso]) {
    ensureNote(store.days[iso].noteId)
    return
  }
  const prev = latestDayBefore(iso)
  const noteId = prev ? store.days[prev].noteId : freshNoteId()
  ensureNote(noteId)
  store.days[iso] = newDayObject(iso, noteId)
}

// On open, show today's log (creating it, continuing the latest notes if any).
const todayIso = isoOf()
ensureDay(todayIso)
store.current = todayIso

// The currently-open day. Editing its fields mutates storage directly.
const current = computed(() => store.days[store.current])

function dayHasLog(day) {
  return !!day && Array.isArray(day.logRows) && day.logRows.some((r) => r.start || r.end || r.comment)
}
function noteContentOf(day) {
  const n = day && store.notes[day.noteId]
  return n && n.content ? n.content.trim() : ''
}
function isEmptyDay(day) {
  if (!day) return true
  return !dayHasLog(day) && !noteContentOf(day)
}

// Days that should appear on the calendar: anything with a log or notes, plus
// the day that's currently open (so an in-progress blank day is still selectable).
const logDays = computed(() => {
  const set = new Set()
  for (const iso of Object.keys(store.days)) {
    if (iso === store.current || !isEmptyDay(store.days[iso])) set.add(iso)
  }
  return set
})

// View toggle: 'log' (the editor), 'calendar' (day picker), 'search', or 'settings'.
const view = ref('log')
const editorRef = ref(null)

// ---- Labels ----
// Derived from the note markdown (labels are literal `#tag` text). Feeds both
// the search view and, via the shared `allLabels` ref, the editor autocomplete.
const labelIndex = computed(() => buildLabelIndex(store))
watch(
  labelIndex,
  (idx) => (allLabels.value = idx.map((e) => e.label)),
  { immediate: true },
)

function openDay(iso) {
  ensureDay(iso)
  store.current = iso
  view.value = 'log'
}

// The notes document of the chronologically-previous day, if any.
const prevNoteId = computed(() => {
  const prev = latestDayBefore(store.current)
  return prev ? store.days[prev].noteId : null
})

// True when the current day is on its own notes doc while a previous day's thread
// exists to rejoin — i.e. "Start fresh" is in effect and can be toggled back.
const canContinuePrevious = computed(
  () => !!prevNoteId.value && current.value.noteId !== prevNoteId.value,
)

// Break the current day off into a new, empty notes document (days before it
// keep the previous thread). The editor is keyed by noteId, so it remounts empty.
function startFreshNotes() {
  const id = freshNoteId()
  store.notes[id] = { content: '' }
  current.value.noteId = id
}

// Rejoin the previous day's notes thread (the fresh doc, if now unused, is
// garbage-collected on the next save).
function continuePreviousNotes() {
  if (prevNoteId.value) current.value.noteId = prevNoteId.value
}

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
// Mirror into the shared ref so time-log widgets (mounted outside the component
// tree) pick up the setting.
const clockFormat = ref(localStorage.getItem(CLOCK_KEY) || '24h')
watch(
  clockFormat,
  (v) => {
    localStorage.setItem(CLOCK_KEY, v)
    sharedClockFormat.value = v
  },
  { immediate: true },
)

// ---- Persistence ----
let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    // Drop empty days (except the open one) so the calendar stays clean.
    for (const iso of Object.keys(store.days)) {
      if (iso !== store.current && isEmptyDay(store.days[iso])) delete store.days[iso]
    }
    // Garbage-collect notes documents no day references any more.
    const referenced = new Set(Object.values(store.days).map((d) => d.noteId))
    for (const id of Object.keys(store.notes)) {
      if (!referenced.has(id)) delete store.notes[id]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }, 250)
}
watch(store, persist, { deep: true })

function onNotesChange(markdown) {
  const id = current.value.noteId
  ensureNote(id)
  store.notes[id].content = markdown
}

// ---- Export ----
const flash = ref('')
function showFlash(msg) {
  flash.value = msg
  setTimeout(() => (flash.value = ''), 1600)
}

function currentMarkdown() {
  // Pull the freshest notes straight from the editor.
  const md = editorRef.value?.getMarkdown() ?? noteContentOf(current.value)
  const log = dayHasLog(current.value)
    ? buildTimeLogTableMarkdown(current.value.logRows, clockFormat.value)
    : ''
  return buildMarkdown({
    date: current.value.label,
    log,
    notes: md,
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
          :class="{ active: view === 'search' }"
          @click="view = view === 'search' ? 'log' : 'search'"
          title="Search labels"
          aria-label="Search"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11"
            r="7" /><path d="m21 21-4.3-4.3" /></svg>
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
        <button
          class="icon"
          :class="{ active: view === 'settings' }"
          @click="view = view === 'settings' ? 'log' : 'settings'"
          title="Settings"
          aria-label="Settings"
        >
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

    <main v-show="view === 'settings'">
      <SettingsView
        v-model:theme="theme"
        v-model:clockFormat="clockFormat"
        @close="view = 'log'"
      />
    </main>

    <main v-show="view === 'search'">
      <SearchView
        :index="labelIndex"
        :today="todayIso"
        @select="openDay"
        @close="view = 'log'"
      />
    </main>

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
      <section class="panel log-panel">
        <TimeTable v-model="current.logRows" :clock-format="clockFormat" />
      </section>
      <section class="panel notes-panel">
        <div class="notes-header">
          <span class="notes-title">Notes</span>
          <button
            v-if="canContinuePrevious"
            class="fresh-notes"
            @click="continuePreviousNotes"
            title="Continue the previous day's notes"
            aria-label="Continue previous notes"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          </button>
          <button
            v-else
            class="fresh-notes"
            @click="startFreshNotes"
            title="Start fresh notes for this day onward"
            aria-label="Start fresh notes"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path
              d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path
              d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15h6" /></svg>
          </button>
        </div>
        <NotesEditor
          ref="editorRef"
          :key="current.noteId"
          :initial-value="store.notes[current.noteId]?.content || ''"
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
.log-panel {
  margin-bottom: 2.75rem;
}

.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.notes-title {
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--muted);
}
.fresh-notes {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 0.35rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.fresh-notes:hover {
  background: var(--hover);
  color: var(--text);
}
</style>
