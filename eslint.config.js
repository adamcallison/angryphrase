import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

/** @type {import('eslint').Linter.Config[]} */
export default [
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
  // src/domain/** (non-owners): only sibling files under src/domain/**; brand import banned (H1)
  {
    files: ['src/domain/**/*.ts'],
    ignores: [
      'src/domain/grid/Row.ts',
      'src/domain/grid/Col.ts',
      'src/domain/grid/GridSize.ts',
      'src/domain/grid/CellIndex.ts',
      'src/domain/letter/Letter.ts',
      'src/domain/puzzle/PuzzleKey.ts',
      'src/domain/puzzle/Title.ts',
      'src/domain/puzzle/Author.ts',
      'src/domain/builder/DisplacedClueId.ts',
      'src/domain/word/WordNumber.ts',
      'src/domain/notifications/ToastId.ts'
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/|(?:\.\./)+)ui/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)ports/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)builder/state/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)player/state/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)app/state/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/domain/** may not import svelte or svelte/*.'
            },
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  },
  // src/domain/** brand owners: same domain boundary rules, brand import allowed (H1)
  {
    files: [
      'src/domain/grid/Row.ts',
      'src/domain/grid/Col.ts',
      'src/domain/grid/GridSize.ts',
      'src/domain/grid/CellIndex.ts',
      'src/domain/letter/Letter.ts',
      'src/domain/puzzle/PuzzleKey.ts',
      'src/domain/puzzle/Title.ts',
      'src/domain/puzzle/Author.ts',
      'src/domain/builder/DisplacedClueId.ts',
      'src/domain/word/WordNumber.ts',
      'src/domain/notifications/ToastId.ts'
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/|(?:\.\./)+)ui/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)ports/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)builder/state/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)player/state/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)app/state/',
              message: 'src/domain/** may only import sibling files under src/domain/**.'
            },
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/domain/** may not import svelte or svelte/*.'
            }
          ]
        }
      ]
    }
  },
  // src/builder/state/** and src/player/state/**: domain + siblings only
  {
    files: ['src/builder/state/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/|(?:\.\./)+)ui/',
              message: 'src/builder/state/** may only import src/domain/** and sibling builder state files.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)ports/',
              message: 'src/builder/state/** may only import src/domain/** and sibling builder state files.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)app/state/',
              message: 'src/builder/state/** may only import src/domain/** and sibling builder state files.'
            },
            {
              regex: '(?:^src/|(?:\\.\\./)+)player/state/',
              message: 'src/builder/state/** may not import src/player/state/** (no cross-state-module imports; shared concepts belong in src/domain/**).'
            },
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/builder/state/** may not import svelte or svelte/*.'
            },
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  },
  // src/player/state/**: domain + own siblings; other module's public root only; no internal cross-imports
  {
    files: ['src/player/state/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/|(?:\.\./)+)ui/',
              message: 'src/player/state/** may only import src/domain/** and sibling player state files.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)ports/',
              message: 'src/player/state/** may only import src/domain/** and sibling player state files.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)app/state/',
              message: 'src/player/state/** may only import src/domain/** and sibling player state files.'
            },
            {
              regex: '(?:^src/|(?:\\.\\./)+)builder/state/',
              message: 'src/player/state/** may not import src/builder/state/** (no cross-state-module imports; shared concepts belong in src/domain/**).'
            },
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/player/state/** may not import svelte or svelte/*.'
            },
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  },
  // src/app/state/**: domain + siblings; value imports of public root files from
  // builder/player state; FORBIDDEN to import any internal/ subfile of builder/player state.
  {
    files: ['src/app/state/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/|(?:\.\./)+)ui/',
              message: 'src/app/state/** may only import src/domain/**, sibling app state files, and the public root files (state.ts, intents.ts, reducer.ts) of src/builder/state/** and src/player/state/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)ports/',
              message: 'src/app/state/** may only import src/domain/**, sibling app state files, and the public root files (state.ts, intents.ts, reducer.ts) of src/builder/state/** and src/player/state/**.'
            },
            {
              regex: 'builder/state/internal/|player/state/internal/',
              message: 'src/app/state/** may not import internal/ implementation files of src/builder/state/** or src/player/state/**; only their public root files.'
            },
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/app/state/** may not import svelte or svelte/*.'
            },
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  },
  // src/ui/** except bindings: bindings + siblings; type-only domain; no state/ports
  {
    files: ['src/ui/**/*.ts', 'src/ui/**/*.svelte'],
    ignores: ['src/ui/bindings/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/|(?:\.\./)+)ports/',
              message: 'src/ui/** may only import src/ui/bindings/**, sibling UI files, and type-only imports from src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)builder/state/',
              message: 'src/ui/** may only import src/ui/bindings/**, sibling UI files, and type-only imports from src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)player/state/',
              message: 'src/ui/** may only import src/ui/bindings/**, sibling UI files, and type-only imports from src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)app/state/',
              message: 'src/ui/** may only import src/ui/bindings/**, sibling UI files, and type-only imports from src/domain/**.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)domain/',
              allowTypeImports: true,
              message: 'src/ui/** may only import type-only imports from src/domain/**.'
            },
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  },
  // src/ports/**: only src/domain/ports/ports.ts and src/domain/rng/Rng.ts
  {
    files: ['src/ports/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/ports/** may not import svelte or svelte/*.'
            },
            {
              regex: '(?:^src/|(?:\.\./)+)ui/',
              message: 'src/ports/** may only import src/domain/ports/ports.ts and src/domain/rng/Rng.ts.'
            },
            {
              regex: '^(?!src/domain/ports/ports\.ts$|src/domain/rng/Rng\.ts$|src/domain/puzzle/PuzzleKey\.ts$|(?:\.\./)+domain/ports/ports\.ts$|(?:\.\./)+domain/rng/Rng\.ts$|(?:\.\./)+domain/puzzle/PuzzleKey\.ts$).*(?:src/|\.\./).*$',
              message: 'src/ports/** may only import src/domain/ports/ports.ts, src/domain/rng/Rng.ts, and src/domain/puzzle/PuzzleKey.ts (StoragePort key type).'
            },
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  },
  // src/ui/bindings/**: brand import banned (H1) — not covered by the src/ui/** block above (ignored)
  {
    files: ['src/ui/bindings/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  },
  // catch-all for src/** not covered by any block above (e.g. src/main.ts): brand import banned (H1)
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    ignores: [
      'src/domain/**',
      'src/builder/state/**',
      'src/player/state/**',
      'src/app/state/**',
      'src/ui/**',
      'src/ports/**'
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^src/domain/brand(?:\\.ts)?$|(?:\\.\\./)+domain/brand(?:\\.ts)?$|(?:\\.\\./)+brand(?:\\.ts)?$)',
              message: 'domain/brand is internal to branded-type owner modules; use the type constructor (e.g. Row.of, PuzzleKey.try, Letter.try) instead of brand().'
            }
          ]
        }
      ]
    }
  }
];
