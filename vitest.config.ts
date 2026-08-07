import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        runes: true
      }
    })
  ],
  test: {
    environment: 'node',
    globals: true,
    // Tests must live under `test/`, mirroring `src/` (design doc §10.1).
    // The co-located `src/**/*.test.ts` pattern is intentionally excluded so
    // accidental drift is caught at CI: a stray test under `src/` won't run.
    include: ['test/**/*.test.ts'],
    passWithNoTests: true
  }
});
