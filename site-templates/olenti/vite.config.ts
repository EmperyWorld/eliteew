import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'

const allowedHosts = process.env.VITE_ALLOWED_HOSTS
  ? process.env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
  : true

const chunkGroups = [
  {
    name: 'vendor-react',
    packages: ['react', 'react-dom', 'react-router-dom'],
  },
  {
    name: 'vendor-ui',
    packages: ['@headlessui/react', 'framer-motion', 'lucide-react'],
  },
  {
    name: 'vendor-forms',
    packages: ['react-hook-form', 'zod'],
  },
  {
    name: 'vendor-query',
    packages: ['@tanstack/react-query', 'axios'],
  },
]

function getManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined
  }

  for (const group of chunkGroups) {
    if (group.packages.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`))) {
      return group.name
    }
  }

  return undefined
}

export default defineConfig({
  plugins: [react()],
  cacheDir: '/tmp/vite-cache',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@store': resolve(__dirname, './src/store'),
      '@services': resolve(__dirname, './src/services'),
      '@typings': resolve(__dirname, './src/types'),
      '@constants': resolve(__dirname, './src/constants'),
      '@utils': resolve(__dirname, './src/utils'),
      '@assets': resolve(__dirname, './src/assets'),
      '@image': resolve(__dirname, './src/image'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false,
    cors: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    open: false,
    cors: true,
    allowedHosts,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
})
