import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Ladle v5 uses Vite 6 internally which is incompatible with @vitejs/plugin-react v6.
 *  Skip the project-level React plugin when running inside Ladle. */
const isLadle = process.env.LADLE === 'true'

const apiTarget = process.env.DEEPSHIELD_SERVER_URL || 'http://127.0.0.1:30417'

export default defineConfig({
  plugins: isLadle ? [] : [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/agent': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
