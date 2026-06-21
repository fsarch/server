import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'node_modules'],
    },
    // Unterstützung für NestJS Testing Module
    isolate: false,
    server: {
      deps: {
        inline: [
          '@nestjs/testing',
          '@nestjs/common',
          '@nestjs/config',
          '@nestjs/core',
          '@nestjs/jwt',
          '@nestjs/swagger',
          '@nestjs/typeorm',
        ],
      },
      // Für CommonJS Module Unterstützung
      esmExternals: true,
    },
    // Für CommonJS Kompatibilität
    transformMode: {
      web: [/\.[tj]sx?$/],
      ssr: [/\.[tj]s?$/],
    },
    // Allow CommonJS requires in ESM
    cache: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
