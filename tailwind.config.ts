import type { Config } from 'tailwindcss';
import containerQueries from '@tailwindcss/container-queries';

export default {
  content: ['./src/**/*.{svelte,ts,html}'],
  theme: {
    extend: {}
  },
  plugins: [containerQueries]
} satisfies Config;
