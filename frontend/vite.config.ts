import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Ladle v5 uses Vite 6 internally which is incompatible with @vitejs/plugin-react v6.
 *  Skip the project-level React plugin when running inside Ladle. */
const isLadle = process.env.LADLE === 'true'

export default defineConfig({
  plugins: isLadle ? [] : [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/agent': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
