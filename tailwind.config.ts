import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';
import containerQueries from '@tailwindcss/container-queries';

export default {
  content: ['./src/**/*.{svelte,ts,html}'],
  theme: {
    extend: {
      zIndex: {
        'typing-surface': '-50',
        'grid-decor': '10',
        overlay: '40',
        toast: '50',
      },
      colors: {
        primary: { DEFAULT: colors.blue[600], hover: colors.blue[700] },
        hilite: { selected: colors.yellow[400], word: colors.yellow[100] },
        accent: {
          join: colors.blue[400],
          reattach: colors.amber[400],
          'join-surface': colors.blue[50],
          'reattach-surface': colors.amber[50],
        },
        surface: colors.gray[50],
      },
    },
  },
  plugins: [containerQueries]
} satisfies Config;
