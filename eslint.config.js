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
  // src/domain/**: only sibling files under src/domain/**
  {
    files: ['src/domain/**/*.ts'],
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
              regex: 'player/state/internal/',
              message: 'src/builder/state/** may import the public root files of player/state/** but not its internal/ implementation files.'
            },
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/builder/state/** may not import svelte or svelte/*.'
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
              regex: 'builder/state/internal/',
              message: 'src/player/state/** may import the public root files of builder/state/** but not its internal/ implementation files.'
            },
            {
              group: ['svelte', 'svelte/*'],
              message: 'src/player/state/** may not import svelte or svelte/*.'
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
            }
          ]
        }
      ]
    }
  },
  // src/ports/**: only src/domain/persistence/ports.ts and src/domain/rng/Rng.ts
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
              message: 'src/ports/** may only import src/domain/persistence/ports.ts and src/domain/rng/Rng.ts.'
            },
            {
              regex: '^(?!src/domain/persistence/ports\.ts$|src/domain/rng/Rng\.ts$|src/domain/puzzle/PuzzleKey\.ts$|(?:\.\./)+domain/persistence/ports\.ts$|(?:\.\./)+domain/rng/Rng\.ts$|(?:\.\./)+domain/puzzle/PuzzleKey\.ts$).*(?:src/|\.\./).*$',
              message: 'src/ports/** may only import src/domain/persistence/ports.ts, src/domain/rng/Rng.ts, and src/domain/puzzle/PuzzleKey.ts (StoragePort key type).'
            }
          ]
        }
      ]
    }
  }
];
