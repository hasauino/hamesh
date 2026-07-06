<script setup>
import { computed } from 'vue'
import {
  rowMinutes,
  formatDuration,
  formatDecimalHours,
  totalMinutes,
} from '../lib/time.js'

// rows is v-model bound: array of { start, end, comment }
const rows = defineModel({ type: Array, required: true })

const total = computed(() => totalMinutes(rows.value))

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
            <input type="time" v-model="row.start" step="60" />
          </td>
          <td>
            <input type="time" v-model="row.end" step="60" />
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
  width: 6.5rem;
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
