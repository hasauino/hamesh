<script setup>
// Settings as a full view (like the calendar), not a slide-in drawer. Values are
// v-model bound so the parent owns persistence; this component just presents them.
const theme = defineModel('theme', { type: String, default: 'light' })
const clockFormat = defineModel('clockFormat', { type: String, default: '24h' })

const emit = defineEmits(['close'])
</script>

<template>
  <div class="settings">
    <div class="settings-top">
      <h2 class="settings-title">Settings</h2>
      <button class="done" @click="emit('close')" title="Back to log">Done</button>
    </div>

    <div class="settings-body">
      <div class="setting">
        <span class="setting-label">Appearance</span>
        <div class="segmented" role="group" aria-label="Theme">
          <button :class="{ on: theme === 'light' }" @click="theme = 'light'">Light</button>
          <button :class="{ on: theme === 'dark' }" @click="theme = 'dark'">Dark</button>
        </div>
      </div>

      <div class="setting">
        <span class="setting-label">Time format</span>
        <div class="segmented" role="group" aria-label="Time format">
          <button :class="{ on: clockFormat === '24h' }" @click="clockFormat = '24h'">24h</button>
          <button :class="{ on: clockFormat === '12h' }" @click="clockFormat = '12h'">12h</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  --accent: #ff3b30;
  max-width: 420px;
  margin: 0 auto;
}

.settings-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.settings-title {
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

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.setting {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.setting-label {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--muted);
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  width: fit-content;
}
.segmented button {
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.9rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.segmented button + button {
  border-left: 1px solid var(--border);
}
.segmented button:hover {
  background: var(--hover);
  color: var(--text);
}
.segmented button.on {
  background: var(--text);
  color: var(--bg);
}
</style>
