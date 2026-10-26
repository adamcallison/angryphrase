import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The declarative boundary matrix for the project.
 *
 * `areas` are repo-relative path prefixes. A target path belongs to the area
 * with the longest matching prefix.
 *
 * `allowed[area] === 'value'` permits static and dynamic imports of values
 * from that area. `'type'` permits only type-only imports. An area absent from
 * `allowed` is forbidden.
 *
 * `allowPaths` lists exact repo-relative files that may be imported regardless
 * of their area's `allowed` setting.
 *
 * @type {{
 *   areas: Record<string, string>;
 *   layers: Array<{
 *     name: string;
 *     files: string[];
 *     ignores: string[];
 *     allowed: Record<string, 'value' | 'type'>;
 *     allowPaths: string[];
 *     bannedPackages: string[];
 *   }>;
 *   globals: { names: string[]; layers: string[] };
 *   dynamicImport: { bannedLayers: string[] };
 *   brand: { module: string; owners: string[] };
 * }}
 */
export const BOUNDARIES = {
  areas: {
    domain: 'src/domain/',
    builderState: 'src/builder/state/',
    playerState: 'src/player/state/',
    appState: 'src/app/state/',
    uiBindings: 'src/ui/bindings/',
    ui: 'src/ui/',
    ports: 'src/ports/',
    assets: 'src/assets/',
    main: 'src/main.ts',
  },
  layers: [
    {
      name: 'domain',
      files: ['src/domain/**/*.ts'],
      ignores: [],
      allowed: { domain: 'value' },
      allowPaths: [],
      bannedPackages: ['svelte', 'svelte/*'],
    },
    {
      name: 'builderState',
      files: ['src/builder/state/**/*.ts'],
      ignores: [],
      allowed: { domain: 'value', builderState: 'value' },
      allowPaths: [],
      bannedPackages: ['svelte', 'svelte/*'],
    },
    {
      name: 'playerState',
      files: ['src/player/state/**/*.ts'],
      ignores: [],
      allowed: { domain: 'value', playerState: 'value' },
      allowPaths: [],
      bannedPackages: ['svelte', 'svelte/*'],
    },
    {
      name: 'appState',
      files: ['src/app/state/**/*.ts'],
      ignores: [],
      allowed: { domain: 'value', appState: 'value' },
      allowPaths: [
        'src/builder/state/state.ts',
        'src/builder/state/intents.ts',
        'src/builder/state/reducer.ts',
        'src/player/state/state.ts',
        'src/player/state/intents.ts',
        'src/player/state/reducer.ts',
      ],
      bannedPackages: ['svelte', 'svelte/*'],
    },
    {
      name: 'uiBindings',
      files: ['src/ui/bindings/**/*.ts'],
      ignores: [],
      allowed: {
        domain: 'value',
        builderState: 'value',
        playerState: 'value',
        appState: 'value',
        uiBindings: 'value',
        ui: 'value',
        ports: 'value',
        assets: 'value',
        main: 'value',
      },
      allowPaths: [],
      bannedPackages: [],
    },
    {
      name: 'uiLeaf',
      files: ['src/ui/**/*.ts', 'src/ui/**/*.svelte'],
      ignores: ['src/ui/bindings/**', 'src/ui/app/App.svelte'],
      allowed: { ui: 'value', domain: 'type', uiBindings: 'type' },
      allowPaths: [],
      bannedPackages: [],
    },
    {
      name: 'appShell',
      files: ['src/ui/app/App.svelte'],
      ignores: [],
      allowed: { ui: 'value', uiBindings: 'value', domain: 'type' },
      allowPaths: [],
      bannedPackages: [],
    },
    {
      name: 'ports',
      files: ['src/ports/**/*.ts'],
      ignores: [],
      allowed: {},
      allowPaths: [
        'src/domain/ports/ports.ts',
        'src/domain/rng/Rng.ts',
        'src/domain/puzzle/PuzzleKey.ts',
      ],
      bannedPackages: ['svelte', 'svelte/*'],
    },
    {
      name: 'root',
      files: ['src/main.ts'],
      ignores: [],
      allowed: {
        domain: 'value',
        builderState: 'value',
        playerState: 'value',
        appState: 'value',
        uiBindings: 'value',
        ui: 'value',
        ports: 'value',
        assets: 'value',
        main: 'value',
      },
      allowPaths: ['src/app.css'],
      bannedPackages: [],
    },
  ],
  globals: {
    names: [
      'window',
      'document',
      'localStorage',
      'sessionStorage',
      'navigator',
      'location',
      'history',
      'fetch',
      'globalThis',
    ],
    layers: ['domain', 'builderState', 'playerState', 'appState'],
  },
  dynamicImport: {
    bannedLayers: ['domain', 'builderState', 'playerState', 'appState'],
  },
  brand: {
    module: 'src/domain/brand.ts',
    owners: [
      'src/domain/grid/Row.ts',
      'src/domain/grid/Col.ts',
      'src/domain/grid/GridSize.ts',
      'src/domain/letter/Letter.ts',
      'src/domain/puzzle/PuzzleKey.ts',
      'src/domain/puzzle/Title.ts',
      'src/domain/puzzle/Author.ts',
      'src/domain/builder/DisplacedClueId.ts',
      'src/domain/word/WordLength.ts',
      'src/domain/word/WordNumber.ts',
      'src/domain/notifications/ToastId.ts',
      'src/domain/time/EpochMs.ts',
      'src/domain/time/DurationMs.ts',
    ],
  },
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} repoRelative
 * @returns {boolean}
 */
function pathExists(repoRelative) {
  try {
    fs.statSync(path.join(repoRoot, repoRelative));
    return true;
  } catch {
    return false;
  }
}

/**
 * Throws when the boundary spec is malformed.
 *
 * Checks:
 * - layer names are unique;
 * - every `allowed` key is a known area;
 * - every area path exists (file or directory);
 * - every layer has a non-empty `files` list;
 * - every `allowPaths` entry exists;
 * - brand owners exist, are unique, and live under `src/domain/`;
 * - `globals.layers` and `dynamicImport.bannedLayers` name known layers.
 *
 * @param {typeof BOUNDARIES} spec
 * @returns {undefined}
 */
export function validateBoundaries(spec) {
  const knownAreas = Object.keys(spec.areas);

  for (const [area, repoRelative] of Object.entries(spec.areas)) {
    if (!pathExists(repoRelative)) {
      throw new Error(`Area "${area}" points to missing path: ${repoRelative}`);
    }
  }

  const seenLayerNames = new Set();
  for (const layer of spec.layers) {
    if (seenLayerNames.has(layer.name)) {
      throw new Error(`Duplicate layer name: ${layer.name}`);
    }
    seenLayerNames.add(layer.name);

    if (!Array.isArray(layer.files) || layer.files.length === 0) {
      throw new Error(`Layer "${layer.name}" must declare a non-empty files list`);
    }

    for (const area of Object.keys(layer.allowed)) {
      if (!knownAreas.includes(area)) {
        throw new Error(
          `Layer "${layer.name}" references unknown area "${area}"`,
        );
      }
    }

    for (const repoRelative of layer.allowPaths) {
      if (!pathExists(repoRelative)) {
        throw new Error(
          `Layer "${layer.name}" allowPaths entry missing: ${repoRelative}`,
        );
      }
    }
  }

  const seenOwners = new Set();
  for (const repoRelative of spec.brand.owners) {
    if (!repoRelative.startsWith('src/domain/')) {
      throw new Error(
        `Brand owner "${repoRelative}" must live under src/domain/`,
      );
    }
    if (!pathExists(repoRelative)) {
      throw new Error(`Brand owner does not exist: ${repoRelative}`);
    }
    if (seenOwners.has(repoRelative)) {
      throw new Error(`Duplicate brand owner: ${repoRelative}`);
    }
    seenOwners.add(repoRelative);
  }

  const knownLayers = new Set(spec.layers.map((layer) => layer.name));
  for (const layerName of spec.globals.layers) {
    if (!knownLayers.has(layerName)) {
      throw new Error(
        `globals.layers references unknown layer "${layerName}"`,
      );
    }
  }
  for (const layerName of spec.dynamicImport.bannedLayers) {
    if (!knownLayers.has(layerName)) {
      throw new Error(
        `dynamicImport.bannedLayers references unknown layer "${layerName}"`,
      );
    }
  }

  return undefined;
}
