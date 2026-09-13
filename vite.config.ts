import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dual-stack (::) so both localhost (::1) and 127.0.0.1 work.
    // 0.0.0.0 alone breaks browsers that resolve localhost to IPv6 first.
    host: '::',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
