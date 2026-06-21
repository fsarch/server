import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: ['src/lib/**/*.spec.ts'], // NestJS Service Tests vorübergehend ausschließen
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'node_modules'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
