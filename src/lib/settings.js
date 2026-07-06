// Cross-cutting settings that need to reach places outside the Vue component
// tree — notably the Milkdown time-log node views, which are mounted imperatively
// and can't receive props through the normal parent chain. App.vue keeps its own
// reactive copy for the settings UI and mirrors changes into these shared refs.

import { ref } from 'vue'

// '24h' or '12h' — how times are displayed inside time-log widgets.
export const clockFormat = ref('24h')
