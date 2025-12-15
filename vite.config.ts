/// <reference types="vitest" />
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'
import tsconfigPaths from 'vite-tsconfig-paths'

const monacoEditorPlugin = (monacoEditorPluginModule as any).default

const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    monacoEditorPlugin({
      // Include markdown for script formatter, plus common languages
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html', 'css']
    })
  ],
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1422,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1422
        }
      : undefined,
    watch: {
      // Ignore watching `src-tauri`
      ignored: ['**/src-tauri/**']
    }
  },
  // to access the Tauri environment variables set by the CLI with information about the current target
  envPrefix: [
    'VITE_',
    'TAURI_PLATFORM',
    'TAURI_ARCH',
    'TAURI_FAMILY',
    'TAURI_PLATFORM_VERSION',
    'TAURI_PLATFORM_TYPE',
    'TAURI_DEBUG'
  ],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    cssMinify: !process.env.TAURI_DEBUG ? 'lightningcss' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest-setup.ts', './tests/setup/msw-server.ts'],
    mockReset: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**']
  }
})
