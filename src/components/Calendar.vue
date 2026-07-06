<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  // Set (or array) of "YYYY-MM-DD" strings that have a saved log.
  logDays: { type: [Object, Array], default: () => new Set() },
  // Currently-open day, "YYYY-MM-DD".
  selected: { type: String, default: '' },
  // Today, "YYYY-MM-DD".
  today: { type: String, required: true },
})
const emit = defineEmits(['select', 'close'])

const logSet = computed(() =>
  props.logDays instanceof Set ? props.logDays : new Set(props.logDays),
)

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function partsOf(iso) {
  const [y, m] = (iso || props.today).split('-').map(Number)
  return { y, m: m - 1 }
}

// View starts on the selected day's month (or today's).
const start = partsOf(props.selected || props.today)
const viewYear = ref(start.y)
const viewMonth = ref(start.m) // 0-based

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const cells = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstWeekday = new Date(y, m, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const out = []
  for (let i = 0; i < firstWeekday; i++) out.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const id = iso(y, m, d)
    out.push({
      day: d,
      iso: id,
      hasLog: logSet.value.has(id),
      isToday: id === props.today,
      isSelected: id === props.selected,
    })
  }
  return out
})

function step(months) {
  let m = viewMonth.value + months
  let y = viewYear.value
  while (m < 0) { m += 12; y-- }
  while (m > 11) { m -= 12; y++ }
  viewMonth.value = m
  viewYear.value = y
}

function goToday() {
  const t = partsOf(props.today)
  viewYear.value = t.y
  viewMonth.value = t.m
}
</script>

<template>
  <div class="cal">
    <div class="cal-top">
      <h2 class="cal-title">
        <span class="cal-month">{{ MONTHS[viewMonth] }}</span>
        <span class="cal-year">{{ viewYear }}</span>
      </h2>
      <div class="cal-nav">
        <button class="chev" @click="step(-12)" title="Previous year">«</button>
        <button class="chev" @click="step(-1)" title="Previous month">‹</button>
        <button class="today-btn" @click="goToday" title="Jump to today">Today</button>
        <button class="chev" @click="step(1)" title="Next month">›</button>
        <button class="chev" @click="step(12)" title="Next year">»</button>
        <button class="done" @click="emit('close')" title="Back to log">Done</button>
      </div>
    </div>

    <div class="cal-grid cal-weekdays">
      <div v-for="(w, i) in WEEKDAYS" :key="i" class="weekday">{{ w }}</div>
    </div>

    <div class="cal-grid cal-days">
      <template v-for="(c, i) in cells" :key="i">
        <div v-if="!c" class="cell empty"></div>
        <button
          v-else
          class="cell day"
          :class="{ today: c.isToday, selected: c.isSelected && !c.isToday }"
          @click="emit('select', c.iso)"
        >
          <span class="num">{{ c.day }}</span>
          <span class="dot" :class="{ on: c.hasLog }"></span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cal {
  --accent: #ff3b30;
  max-width: 420px;
  margin: 0 auto;
}

.cal-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.cal-title {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.cal-month {
  color: var(--text);
}
.cal-year {
  color: var(--faint);
  font-weight: 600;
}

.cal-nav {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}
.chev {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.25rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
}
.chev:hover {
  background: var(--hover);
}
.today-btn,
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
.today-btn:hover,
.done:hover {
  background: var(--hover);
}
.done {
  margin-left: 0.25rem;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal-weekdays {
  margin-bottom: 0.35rem;
}
.weekday {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.25rem 0;
}

.cal-days {
  row-gap: 0.15rem;
}
.cell {
  aspect-ratio: 1 / 1;
}
.cell.empty {
  pointer-events: none;
}
.cell.day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 999px;
}
.cell.day:hover {
  background: var(--hover);
}
.cell.day .num {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}
.cell.day.today .num {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.cell.day.selected .num {
  box-shadow: inset 0 0 0 1.5px var(--accent);
  color: var(--accent);
  font-weight: 600;
}
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
}
.dot.on {
  background: var(--accent);
}
.cell.day.today .dot.on {
  background: var(--accent);
}
</style>
