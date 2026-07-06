<script setup>
import { computed } from 'vue'
import {
  rowMinutes,
  formatDuration,
  formatDecimalHours,
  totalMinutes,
  formatTime,
  parseFlexibleTime,
} from '../lib/time.js'

// rows is v-model bound: array of { start, end, comment }
const rows = defineModel({ type: Array, required: true })

const props = defineProps({
  // '24h' or '12h' — controls only how native time inputs are displayed.
  // The stored value is always 24h "HH:MM" regardless.
  clockFormat: { type: String, default: '24h' },
})

const total = computed(() => totalMinutes(rows.value))

const placeholder = computed(() =>
  props.clockFormat === '12h' ? 'h:mm am' : 'hh:mm',
)

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

function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

// Stamp the current time into a field.
function stampNow(row, field) {
  row[field] = nowHHMM()
}

function durationFor(row) {
  return formatDuration(rowMinutes(row.start, row.end))
}

function addRow() {
  rows.value.push({ start: '', end: '', comment: '' })
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
                :placeholder="placeholder"
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
                inputmode="numeric"
                :placeholder="placeholder"
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
          <td class="dur">{{ durationFor(row) }}</td>
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
