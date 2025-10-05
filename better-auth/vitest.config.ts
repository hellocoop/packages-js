import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['src/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
    },
})
