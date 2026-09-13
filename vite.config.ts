import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Cloud / remote agents: bind all interfaces so port forwarding works.
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
