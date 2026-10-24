import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import boundaryPlugin from './tools/boundaryRule.js';
import { BOUNDARIES, validateBoundaries } from './tools/boundaries.js';

validateBoundaries(BOUNDARIES);

const localPlugin = boundaryPlugin;

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser
      }
    }
  },
  ...BOUNDARIES.layers.map((layer) => {
    /** @type {import('eslint').Linter.Config} */
    const block = {
      files: layer.files,
      ignores: layer.ignores,
      plugins: {
        local: localPlugin,
      },
      rules: {
        'local/no-layer-imports': [
          'error',
          {
            layer: layer.name,
            areas: BOUNDARIES.areas,
            allowed: layer.allowed,
            allowPaths: layer.allowPaths,
            bannedPackages: layer.bannedPackages,
            dynamicImportBanned: BOUNDARIES.dynamicImport.bannedLayers.includes(layer.name),
          },
        ],
      },
    };

    if (BOUNDARIES.globals.layers.includes(layer.name)) {
      block.rules = {
        ...block.rules,
        'no-restricted-globals': [
          'error',
          ...BOUNDARIES.globals.names.map((name) => ({
            name,
            message: `Global \`${name}\` is not allowed in ${layer.name}.`,
          })),
        ],
      };
    }

    return block;
  }),
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    plugins: {
      local: localPlugin,
    },
    rules: {
      'local/no-brand-import': [
        'error',
        {
          module: BOUNDARIES.brand.module,
          owners: BOUNDARIES.brand.owners,
        },
      ],
      'local/no-unlayered-file': [
        'error',
        {
          layers: BOUNDARIES.layers,
        },
      ],
    },
  },
  // Regression guard: ban non-null assertions in production code.
  // Sanctioned exception: src/domain/grid/GridAccess.ts (raw-indexing leaf) and
  // src/domain/grid/GridOps.ts (legacy equals non-nulls).
  // Intentional retain: src/main.ts uses a non-null assertion on the DOM API return (strict-null -- not noUncheckedIndexedAccess)
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    ignores: ['src/domain/grid/GridAccess.ts', 'src/domain/grid/GridOps.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error'
    }
  }
];

export default config;
