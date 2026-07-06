<script setup>
// Slide-in settings drawer. Values are v-model bound so the parent owns
// persistence; this component is purely presentational + emits changes.
const open = defineModel('open', { type: Boolean, default: false })
const theme = defineModel('theme', { type: String, default: 'light' })
const clockFormat = defineModel('clockFormat', { type: String, default: '24h' })

function close() {
  open.value = false
}
</script>

<template>
  <transition name="settings-fade">
    <div v-if="open" class="settings-backdrop" @click="close"></div>
  </transition>

  <transition name="settings-slide">
    <aside v-if="open" class="settings-panel" role="dialog" aria-label="Settings">
      <header class="settings-head">
        <h2>Settings</h2>
        <button class="close-btn" @click="close" aria-label="Close settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path
            d="m6 6 12 12" /></svg>
        </button>
      </header>

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
    </aside>
  </transition>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  z-index: 40;
}

.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  max-width: 85vw;
  z-index: 50;
  background: var(--bg);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}
:root[data-theme='dark'] .settings-panel {
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.5);
}

.settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}
.settings-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}
.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 6px;
  transition: background 0.12s, color 0.12s;
}
.close-btn:hover {
  background: var(--hover);
  color: var(--text);
}

.settings-body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
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

/* transitions */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.2s ease;
}
.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}
.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: transform 0.22s ease;
}
.settings-slide-enter-from,
.settings-slide-leave-to {
  transform: translateX(100%);
}
</style>
