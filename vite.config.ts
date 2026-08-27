import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [tailwindcss(), react(), svgr()],
  server: {
    proxy: {
      '/api/files': { target: 'http://localhost:3001' },
      '/debug': { target: 'http://localhost:3001' },
      '/files': { target: 'http://localhost:3001' },
    },
  },
})
