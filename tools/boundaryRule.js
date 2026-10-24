import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXTENSIONS = [
  '.ts',
  '.tsx',
  '.svelte',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.png',
  '.svg',
  '.jpg',
];

/**
 * @param {string} p
 * @returns {string}
 */
function posix(p) {
  return p.replace(/\\/g, '/');
}

/**
 * @param {string} p
 * @returns {string}
 */
function stripExtension(p) {
  for (const ext of EXTENSIONS) {
    if (p.endsWith(ext)) {
      return p.slice(0, -ext.length);
    }
  }
  return p;
}

/**
 * @param {string} importerPath
 * @param {string} specifier
 * @returns {string}
 */
function resolveTarget(importerPath, specifier) {
  if (specifier.startsWith('.')) {
    const base = path.posix.dirname(importerPath);
    return path.posix.normalize(path.posix.join(base, specifier));
  }
  if (specifier.startsWith('/')) {
    return path.posix.normalize(specifier.slice(1));
  }
  return specifier;
}

/**
 * @param {Record<string, string>} areas
 * @param {string} target
 * @returns {{ area: string | null, prefix: number }}
 */
function findArea(areas, target) {
  /** @type {Array<{ area: string; prefix: string }>} */
  const entries = Object.entries(areas).map(([area, prefix]) => ({ area, prefix }));
  entries.sort((a, b) => b.prefix.length - a.prefix.length);

  const stripped = stripExtension(target);
  let best = /** @type {{ area: string | null, prefix: number }} */ ({ area: null, prefix: -1 });

  for (const { area, prefix } of entries) {
    if (target.startsWith(prefix) && prefix.length > best.prefix) {
      best = { area, prefix: prefix.length };
    }
    if (stripped.startsWith(prefix) && prefix.length > best.prefix) {
      best = { area, prefix: prefix.length };
    }
  }

  return best;
}

/**
 * @param {string[]} allowPaths
 * @param {string} target
 * @returns {boolean}
 */
function isAllowPath(allowPaths, target) {
  const stripped = stripExtension(target);
  return allowPaths.some((p) => stripExtension(p) === stripped);
}

/**
 * @param {string[]} bannedPackages
 * @param {string} specifier
 * @returns {boolean}
 */
function isBannedPackage(bannedPackages, specifier) {
  return bannedPackages.some((banned) => {
    if (banned === specifier) return true;
    if (banned.endsWith('/*')) {
      const base = banned.slice(0, -2);
      return specifier === base || specifier.startsWith(`${base}/`);
    }
    return false;
  });
}

const GLOB_METACHARACTERS = /[*?]/;

/**
 * Minimal glob matcher for the boundary spec's pattern subset.
 *
 * Supported patterns:
 * - Exact repo-relative paths ('src/main.ts', 'src/ui/app/App.svelte').
 * - Prefix + '/' + '**', where '**' matches zero or more directories.
 * - Prefix + '/' + '**' + '/' + '*.ext', where '**' matches zero or more
 *   directories and '*.ext' matches one path segment ending with '.ext'.
 *
 * '/' is the only path separator. '*' never crosses a segment boundary.
 *
 * @param {string} file
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesPattern(file, pattern) {
  if (!GLOB_METACHARACTERS.test(pattern)) {
    return file === pattern;
  }
  const regex = globPatternToRegex(pattern);
  return regex.test(file);
}

/**
 * @param {string} c
 * @returns {string}
 */
function escapeRegexChar(c) {
  if ('.*+?^${}()|[]\\'.includes(c)) {
    return '\\' + c;
  }
  return c;
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function globPatternToRegex(pattern) {
  let regex = '^';
  let i = 0;
  while (i < pattern.length) {
    if (pattern.slice(i, i + 3) === '**/') {
      regex += '(?:.*/)*';
      i += 3;
    } else if (pattern.slice(i, i + 2) === '**' && i + 2 === pattern.length) {
      regex += '(?:.*/)*[^/]*';
      i += 2;
    } else if (pattern[i] === '*') {
      regex += '[^/]*';
      i += 1;
    } else if (pattern[i] === '?') {
      regex += '[^/]';
      i += 1;
    } else {
      regex += escapeRegexChar(pattern[i]);
      i += 1;
    }
  }
  regex += '$';
  return new RegExp(regex);
}

/**
 * @param {string} file
 * @param {{ name: string; files: string[]; ignores: string[] }} layer
 * @returns {boolean}
 */
function fileMatchesLayer(file, layer) {
  const inFiles = layer.files.some((pattern) => matchesPattern(file, pattern));
  if (!inFiles) {
    return false;
  }
  const inIgnores = layer.ignores.some((pattern) => matchesPattern(file, pattern));
  return !inIgnores;
}

/**
 * @param {string} layerName
 * @returns {string}
 */
function importerDesc(layerName) {
  switch (layerName) {
    case 'domain':
      return 'src/domain/**';
    case 'builderState':
      return 'src/builder/state/**';
    case 'playerState':
      return 'src/player/state/**';
    case 'appState':
      return 'src/app/state/**';
    case 'uiBindings':
      return 'src/ui/bindings/**';
    case 'uiLeaf':
      return 'src/ui/**';
    case 'appShell':
      return 'src/ui/app/App.svelte';
    case 'ports':
      return 'src/ports/**';
    case 'root':
      return 'src/main.ts';
    default:
      return layerName;
  }
}

/**
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {string | null}
 */
function getImporterPath(context) {
  const raw = context.filename;
  const absolute = path.isAbsolute(raw)
    ? raw
    : path.resolve(context.cwd ?? process.cwd(), raw);
  const rel = path.relative(repoRoot, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return posix(rel);
}

/** @type {import('eslint').Rule.RuleModule} */
const noLayerImports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce the project layer import matrix.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          layer: { type: 'string' },
          areas: { type: 'object', additionalProperties: { type: 'string' } },
          allowed: {
            type: 'object',
            additionalProperties: { enum: ['value', 'type'] },
          },
          allowPaths: { type: 'array', items: { type: 'string' } },
          bannedPackages: { type: 'array', items: { type: 'string' } },
          dynamicImportBanned: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        '{{importer}} may not import {{target}} (layer "{{layer}}").',
      typeOnly:
        '{{importer}} may only import types from {{target}} (layer "{{layer}}").',
      noArea:
        '{{target}} is outside any known area and is not allowlisted (layer "{{layer}}").',
      bannedPackage:
        '{{importer}} may not import package {{specifier}} (layer "{{layer}}").',
      dynamicImportBanned:
        '{{importer}} may not use dynamic import() (layer "{{layer}}").',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const layerName = options.layer ?? 'unknown';
    const areas = options.areas ?? {};
    const allowed = options.allowed ?? {};
    const allowPaths = options.allowPaths ?? [];
    const bannedPackages = options.bannedPackages ?? [];
    const dynamicBanned = options.dynamicImportBanned ?? false;

    const importerPath = getImporterPath(context);
    if (importerPath === null) {
      return {};
    }

    const sourceDesc = importerDesc(layerName);

    /**
     * @param {import('estree').Node} node
     * @param {string} specifier
     * @param {boolean} isTypeOnly
     * @param {boolean} isDynamic
     */
    function check(node, specifier, isTypeOnly, isDynamic) {
      if (isDynamic && dynamicBanned) {
        context.report({
          node,
          messageId: 'dynamicImportBanned',
          data: { importer: sourceDesc, layer: layerName },
        });
        return;
      }

      if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
        if (isBannedPackage(bannedPackages, specifier)) {
          context.report({
            node,
            messageId: 'bannedPackage',
            data: { importer: sourceDesc, specifier, layer: layerName },
          });
        }
        return;
      }

      const target = resolveTarget(importerPath, specifier);
      const area = findArea(areas, target).area;

      if (area === null) {
        if (isAllowPath(allowPaths, target)) {
          return;
        }
        context.report({
          node,
          messageId: 'noArea',
          data: { target, layer: layerName },
        });
        return;
      }

      if (isAllowPath(allowPaths, target)) {
        return;
      }

      const permission = allowed[area];
      if (permission === 'value') {
        return;
      }
      if (permission === 'type' && isTypeOnly) {
        return;
      }

      const targetDesc = areas[area] ?? target;
      if (permission === 'type') {
        context.report({
          node,
          messageId: 'typeOnly',
          data: { importer: sourceDesc, target: targetDesc, layer: layerName },
        });
      } else {
        context.report({
          node,
          messageId: 'forbidden',
          data: { importer: sourceDesc, target: targetDesc, layer: layerName },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        const source = /** @type {import('estree').Literal} */ (node.source);
        if (typeof source.value !== 'string') return;
        check(node, source.value, node.importKind === 'type', false);
      },
      ExportNamedDeclaration(node) {
        if (!node.source) return;
        const source = /** @type {import('estree').Literal} */ (node.source);
        if (typeof source.value !== 'string') return;
        check(node, source.value, node.exportKind === 'type', false);
      },
      ExportAllDeclaration(node) {
        const source = /** @type {import('estree').Literal} */ (node.source);
        if (typeof source.value !== 'string') return;
        check(node, source.value, false, false);
      },
      TSImportEqualsDeclaration(node) {
        const ref = /** @type {any} */ (node).moduleReference;
        if (!ref || ref.type !== 'TSExternalModuleReference') return;
        const expr = ref.expression;
        if (!expr || typeof expr.value !== 'string') return;
        check(node, expr.value, node.importKind === 'type', false);
      },
      ImportExpression(node) {
        const source = /** @type {import('estree').Node & { value?: unknown }} */ (node.source);
        if (source.type !== 'Literal' || typeof source.value !== 'string') return;
        check(node, source.value, false, true);
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const noBrandImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Restrict domain/brand imports to owner modules.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          module: { type: 'string' },
          owners: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        '{{importer}} may not import {{module}}; only branded-type owner modules may import it.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const brandModule = options.module ?? '';
    const owners = (options.owners ?? []).map(stripExtension);

    const importerPath = getImporterPath(context);
    if (importerPath === null) {
      return {};
    }
    const strippedImporter = stripExtension(importerPath);

    /**
     * @param {import('estree').Node} node
     * @param {string} specifier
     */
    function check(node, specifier) {
      const target = resolveTarget(importerPath, specifier);
      if (stripExtension(target) !== stripExtension(brandModule)) {
        return;
      }
      if (owners.includes(strippedImporter)) {
        return;
      }
      context.report({
        node,
        messageId: 'forbidden',
        data: { importer: importerPath, module: brandModule },
      });
    }

    return {
      ImportDeclaration(node) {
        const source = /** @type {import('estree').Literal} */ (node.source);
        if (typeof source.value !== 'string') return;
        check(node, source.value);
      },
      ExportNamedDeclaration(node) {
        if (!node.source) return;
        const source = /** @type {import('estree').Literal} */ (node.source);
        if (typeof source.value !== 'string') return;
        check(node, source.value);
      },
      ExportAllDeclaration(node) {
        const source = /** @type {import('estree').Literal} */ (node.source);
        if (typeof source.value !== 'string') return;
        check(node, source.value);
      },
      TSImportEqualsDeclaration(node) {
        const ref = /** @type {any} */ (node).moduleReference;
        if (!ref || ref.type !== 'TSExternalModuleReference') return;
        const expr = ref.expression;
        if (!expr || typeof expr.value !== 'string') return;
        check(node, expr.value);
      },
      ImportExpression(node) {
        const source = /** @type {import('estree').Node & { value?: unknown }} */ (node.source);
        if (source.type !== 'Literal' || typeof source.value !== 'string') return;
        check(node, source.value);
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const noUnlayeredFile = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Every source file must belong to exactly one boundary layer.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          layers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                files: { type: 'array', items: { type: 'string' } },
                ignores: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'files'],
              additionalProperties: true,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unlayered:
        '{{file}} is not assigned to a boundary layer (layer files patterns: {{patterns}}).',
      multiLayered:
        '{{file}} matches multiple boundary layers ({{layers}}).',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const layers = options.layers ?? [];

    const importerPath = getImporterPath(context);
    if (importerPath === null) {
      return {};
    }

    // Ambient declaration files declare types; they do not import at runtime.
    if (importerPath.endsWith('.d.ts')) {
      return {};
    }

    const matchedLayers = [];
    for (const layer of layers) {
      if (fileMatchesLayer(importerPath, layer)) {
        matchedLayers.push(layer.name);
      }
    }

    return {
      'Program:exit'(node) {
        if (matchedLayers.length === 0) {
          const patterns = layers
            .map((layer) => layer.files.join(', '))
            .join('; ');
          context.report({
            node,
            messageId: 'unlayered',
            data: { file: importerPath, patterns },
          });
        } else if (matchedLayers.length > 1) {
          context.report({
            node,
            messageId: 'multiLayered',
            data: { file: importerPath, layers: matchedLayers.join(', ') },
          });
        }
      },
    };
  },
};

/** @type {{ rules: Record<string, import('eslint').Rule.RuleModule> }} */
const plugin = {
  rules: {
    'no-layer-imports': noLayerImports,
    'no-brand-import': noBrandImport,
    'no-unlayered-file': noUnlayeredFile,
  },
};

export default plugin;
