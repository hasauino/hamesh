// The set of known labels, shared with the Milkdown label-autocomplete plugin.
//
// The plugin is mounted imperatively inside the editor and can't receive props
// through the Vue parent chain, so — like settings.js's clockFormat — App.vue
// mirrors the derived label list (from buildLabelIndex) into this shared ref and
// the plugin reads from it. See labelPlugin.js and App.vue.

import { ref } from 'vue'

// Array of label display strings currently in use across all notes.
export const allLabels = ref([])
