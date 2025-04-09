import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  const isGH = process.env.GITHUB_PAGES === 'true'
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || ''

  return {
    base: isGH && repoName ? `/${repoName}/` : '/',
    plugins: [react()],
    resolve: {
      alias: {
        process: 'process/browser',
        buffer: 'buffer',
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx'], // ← optional, aber klar
    },
    define: {
      global: 'globalThis',
      'process.env': {},
    },
    optimizeDeps: {
      include: ['process', 'buffer'],
    },
  }
})
