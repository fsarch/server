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
          // Everything else that resolves `@nestjs/core`'s own classes
          // (e.g. `ModuleRef`) must be inlined too, or it gets a second,
          // non-inlined copy of @nestjs/core whose tokens don't match -
          // only shows up once a test builds a full `FsArchAppBuilder` app.
          '@nestjs/event-emitter',
          '@nestjs/microservices',
          '@nestjs/platform-express',
          '@nestjs/schedule',
          '@rekog/mcp-nest',
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
