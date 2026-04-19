import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte(), viteSingleFile()],
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, 'src/lib'),
    },
  },
});