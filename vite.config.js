import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      process: 'process/browser',
      buffer: 'buffer',
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {}, // <- das ist wichtig!
  },
  optimizeDeps: {
    include: ['process', 'buffer'],
  }
})
