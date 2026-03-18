import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['electron/**/*.ts'],
      exclude: ['electron/main/index.ts']
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared')
    }
  }
})
