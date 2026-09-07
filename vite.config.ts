import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

function gitInfo(): { hash: string; time: string } {
  const safe = (cmd: string): string => {
    try {
      return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  };
  return {
    hash: safe('git rev-parse --short HEAD'),
    time: safe('git log -1 --format=%cI'),
  };
}

const { hash, time } = gitInfo();

export default defineConfig({
  define: {
    __APP_COMMIT_HASH__: JSON.stringify(hash),
    __APP_BUILD_TIME__: JSON.stringify(time),
  },
  plugins: [
    svelte({
      compilerOptions: {
        runes: true
      }
    }),
    viteSingleFile()
  ],
  build: {
    target: 'es2022',
    cssMinify: true
  }
});
