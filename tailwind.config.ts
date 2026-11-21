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
        success: {
          DEFAULT: colors.green[600],
          hover: colors.green[700],
          soft: colors.green[100],
          'soft-text': colors.green[900],
          border: colors.green[300],
        },
        danger: {
          DEFAULT: colors.red[600],
          hover: colors.red[700],
          soft: colors.red[100],
          'soft-text': colors.red[900],
          border: colors.red[300],
        },
        warning: {
          DEFAULT: colors.amber[600],
          hover: colors.amber[700],
          soft: colors.amber[100],
          'soft-text': colors.amber[900],
          border: colors.amber[300],
        },
        info: {
          DEFAULT: colors.blue[600],
          soft: colors.blue[100],
          'soft-text': colors.blue[900],
          border: colors.blue[300],
        },
        tool: { DEFAULT: colors.purple[600], hover: colors.purple[700] },
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
