import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/discovery.ts', 'src/profile.ts', 'src/runtime.ts', 'src/vision-routing.ts', 'src/deepseek-bridge.ts'],
    },
  },
})
