import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  // Served from https://hasauino.github.io/hamesh/ on GitHub Pages.
  base: command === 'build' ? '/hamesh/' : '/',
  plugins: [vue()],
  server: {
    port: 5180,
    open: true,
  },
}))
