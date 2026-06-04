import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB to be safe for big chunks
      },
      manifest: {
        name: 'CalculDevis PRO',
        short_name: 'CalculDevis',
        description: 'Logiciel de devis menuiserie',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3616/3616215.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
