<script setup>
// Search as a full view (like the calendar/settings). For now it searches
// labels; the structure leaves room for a future free-text mode over note
// bodies + log comments (see the `mode` seam below).
import { ref, computed } from 'vue'

const props = defineProps({
  // [{ label, days: string[] }] from buildLabelIndex — labels with the
  // representative (earliest) day of each note thread carrying them.
  index: { type: Array, default: () => [] },
  // Today, "YYYY-MM-DD".
  today: { type: String, default: '' },
})
const emit = defineEmits(['select', 'close'])

// Reserved for a future 'text' mode; only 'labels' exists today.
const mode = ref('labels')
const filter = ref('')
const expanded = ref(null)

const labelResults = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return props.index
  return props.index.filter((e) => e.label.toLowerCase().includes(q))
})

// "2026-07-08 · Wed" — matches App.vue's day labels.
function dayLabel(iso) {
  const weekday = new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
  })
  return `${iso} · ${weekday}`
}

function toggle(label) {
  expanded.value = expanded.value === label ? null : label
}
</script>

<template>
  <div class="search">
    <div class="search-top">
      <h2 class="search-title">Search</h2>
      <button class="done" @click="emit('close')" title="Back to log">Done</button>
    </div>

    <input
      class="search-input"
      v-model="filter"
      type="text"
      placeholder="Filter labels…"
      spellcheck="false"
      autofocus
    />

    <div v-if="mode === 'labels'" class="results">
      <p v-if="!labelResults.length" class="empty">
        {{ index.length ? 'No labels match.' : 'No labels yet — type #tag in your notes.' }}
      </p>

      <div v-for="entry in labelResults" :key="entry.label" class="label-row">
        <button class="label-head" @click="toggle(entry.label)">
          <span class="label-chip">#{{ entry.label }}</span>
          <span class="count">{{ entry.days.length }}</span>
        </button>
        <div v-if="expanded === entry.label" class="days">
          <button
            v-for="iso in entry.days"
            :key="iso"
            class="day"
            :class="{ today: iso === today }"
            @click="emit('select', iso)"
          >
            {{ dayLabel(iso) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search {
  --accent: #ff3b30;
  max-width: 420px;
  margin: 0 auto;
}

.search-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.search-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}
.done {
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
}
.done:hover {
  background: var(--hover);
}

.search-input {
  width: 100%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
}
.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.results {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.empty {
  color: var(--muted);
  font-size: 0.9rem;
}

.label-row {
  display: flex;
  flex-direction: column;
}
.label-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: none;
  background: transparent;
  padding: 0.5rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.label-head:hover {
  background: var(--hover);
}
.label-chip {
  color: var(--accent);
  font-weight: 600;
  font-size: 0.92rem;
}
.count {
  color: var(--muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.days {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.15rem 0 0.4rem 0.9rem;
}
.day {
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.88rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.day:hover {
  background: var(--hover);
}
.day.today {
  color: var(--accent);
  font-weight: 600;
}
</style>
