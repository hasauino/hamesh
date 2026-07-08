<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import {
  rowMinutes,
  formatDuration,
  formatDecimalHours,
  totalMinutes,
  formatTime,
  parseFlexibleTime,
  nowHHMM,
} from '../lib/time.js'

// rows is v-model bound: array of { start, end, comment }
const rows = defineModel({ type: Array, required: true })

const props = defineProps({
  // '24h' or '12h' — controls only how native time inputs are displayed.
  // The stored value is always 24h "HH:MM" regardless.
  clockFormat: { type: String, default: '24h' },
})

const lastIndex = computed(() => rows.value.length - 1)

// The last row is the "live" one: while its end is still blank it counts up from
// its start to the current time. Only that row shows the "now" placeholder, so
// two rows can never both be "now". Every other blank end is just blank.
function isLive(row, i) {
  return !row.end && i === lastIndex.value
}
function effectiveEnd(row, i) {
  return row.end || (isLive(row, i) ? nowHHMM() : '')
}

// Ticks every minute so the live row's duration (and the total) keeps advancing.
// Reading `tick` inside the reactive getters below is what registers the dep.
const tick = ref(0)
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    tick.value++
  }, 60_000)
})
onUnmounted(() => clearInterval(timer))

const total = computed(() => {
  tick.value // re-evaluate on each minute while a row is live
  return totalMinutes(
    rows.value.map((r, i) => ({ start: r.start, end: effectiveEnd(r, i) })),
  )
})

const timePlaceholder = computed(() =>
  props.clockFormat === '12h' ? 'h:mm am' : 'hh:mm',
)

// The live row prompts with "now"; other empty cells show the format hint.
function endPlaceholder(row, i) {
  return isLive(row, i) ? 'now' : timePlaceholder.value
}

function display(value) {
  return formatTime(value, props.clockFormat)
}

// Commit a typed value: parse loosely, store canonical 24h, then normalize the
// text back to the configured display format (reverting unparseable input).
function commit(row, field, event) {
  const raw = event.target.value
  if (raw.trim() === '') {
    row[field] = ''
  } else {
    const parsed = parseFlexibleTime(raw)
    if (parsed !== null) row[field] = parsed
  }
  event.target.value = display(row[field])
}

// Stamp the current time into a field (e.g. freezing the live end to a fixed time).
function stampNow(row, field) {
  row[field] = nowHHMM()
}

function durationFor(row, i) {
  tick.value // re-evaluate on each minute while this row is live
  return formatDuration(rowMinutes(row.start, effectiveEnd(row, i)))
}

function blankRow() {
  return { start: '', end: '', comment: '' }
}

function addRow() {
  rows.value.push(blankRow())
}

function removeRow(index) {
  rows.value.splice(index, 1)
  if (rows.value.length === 0) addRow()
}

async function copyTotal() {
  try {
    await navigator.clipboard.writeText(formatDuration(total.value))
  } catch {
    /* clipboard may be unavailable; ignore */
  }
}
</script>

<template>
  <div class="time-table">
    <table>
      <thead>
        <tr>
          <th class="col-time">Start</th>
          <th class="col-time">End</th>
          <th class="col-dur">Duration</th>
          <th class="col-comment">Comment</th>
          <th class="col-actions" aria-label="actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td>
            <div class="time-cell">
              <input
                type="text"
                class="time-input"
                inputmode="numeric"
                :placeholder="timePlaceholder"
                :value="display(row.start)"
                @change="commit(row, 'start', $event)"
                @keyup.enter="$event.target.blur()"
              />
              <button
                class="clock-btn"
                title="Fill current time"
                @click="stampNow(row, 'start')"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </button>
            </div>
          </td>
          <td>
            <div class="time-cell">
              <input
                type="text"
                class="time-input"
                :class="{ 'is-now': isLive(row, i) }"
                inputmode="numeric"
                :placeholder="endPlaceholder(row, i)"
                :value="display(row.end)"
                @change="commit(row, 'end', $event)"
                @keyup.enter="$event.target.blur()"
              />
              <button
                class="clock-btn"
                title="Fill current time"
                @click="stampNow(row, 'end')"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </button>
            </div>
          </td>
          <td class="dur">{{ durationFor(row, i) }}</td>
          <td>
            <input
              type="text"
              v-model="row.comment"
              placeholder="…"
              class="comment-input"
            />
          </td>
          <td class="col-actions">
            <button
              class="row-remove"
              title="Remove row"
              @click="removeRow(i)"
            >
              ×
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="table-footer">
      <button class="add-row" @click="addRow">+ Add row</button>
      <div class="total" @click="copyTotal" title="Click to copy total">
        <span class="total-label">Total</span>
        <span class="total-value">{{ formatDuration(total) }}</span>
        <span class="total-decimal">{{ formatDecimalHours(total) }} h</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.time-table {
  width: 100%;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th {
  text-align: left;
  font-weight: 500;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 0 0.5rem 0.5rem;
  border-bottom: 1px solid var(--border);
}

td {
  padding: 0.15rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.col-time {
  width: 8.75rem;
}

.time-cell {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}
.time-input {
  flex: 1;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
/* The live row's "now" prompt reads italic/visible (not faint like a normal
   placeholder) to signal it's actively counting up. */
.time-input.is-now::placeholder {
  color: var(--muted);
  font-style: italic;
  opacity: 1;
}

.clock-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--faint);
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 5px;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
}
tr:hover .clock-btn,
.time-cell:focus-within .clock-btn {
  opacity: 1;
}
.clock-btn:hover {
  color: var(--text);
  background: var(--hover);
}
.col-dur {
  width: 6rem;
}
.col-actions {
  width: 2rem;
  text-align: center;
}

input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  padding: 0.35rem 0.25rem;
  border-radius: 4px;
}
input:focus {
  outline: none;
  background: var(--input-focus);
}
input[type='time'] {
  font-variant-numeric: tabular-nums;
}

.comment-input::placeholder {
  color: var(--faint);
}

.dur {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.row-remove {
  border: none;
  background: transparent;
  color: var(--faint);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
}
tr:hover .row-remove {
  opacity: 1;
}
.row-remove:hover {
  color: var(--text);
  background: var(--hover);
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
}

.add-row {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
}
.add-row:hover {
  color: var(--text);
  background: var(--hover);
}

.total {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  cursor: pointer;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  user-select: none;
}
.total:hover {
  background: var(--hover);
}
.total-label {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--muted);
}
.total-value {
  font-size: 1.15rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.total-decimal {
  font-size: 0.85rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
