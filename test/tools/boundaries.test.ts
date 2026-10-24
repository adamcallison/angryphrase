import { describe, it, expect } from 'vitest';
import { BOUNDARIES, validateBoundaries } from '../../tools/boundaries';

const ownerSources = import.meta.glob<string>('/src/domain/**/*.ts', {
	eager: true,
	query: '?raw',
	import: 'default',
});

function stripExtension(p: string): string {
	return p.replace(/\.[^/.]+$/, '');
}

function dirname(p: string): string {
	const idx = p.lastIndexOf('/');
	return idx === -1 ? '' : p.slice(0, idx);
}

function resolveImport(ownerPath: string, specifier: string): string {
	const dirSegments = dirname(ownerPath).split('/').filter((s) => s.length > 0);
	for (const segment of specifier.split('/')) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') {
			dirSegments.pop();
		} else {
			dirSegments.push(segment);
		}
	}
	return dirSegments.join('/');
}

describe('BOUNDARIES structural checks', () => {
  it('BOUNDARIES: every area points at an existing path in the repository', () => {
    let error: Error | undefined;
    try {
      validateBoundaries(BOUNDARIES);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message ?? '').not.toMatch(/points to missing path/i);
  });

  it('BOUNDARIES: layer names are unique', () => {
    const names = BOUNDARIES.layers.map((layer) => layer.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('BOUNDARIES: every layer references only known areas', () => {
    const known = new Set(Object.keys(BOUNDARIES.areas));
    for (const layer of BOUNDARIES.layers) {
      for (const area of Object.keys(layer.allowed)) {
        expect(known.has(area), `${layer.name} -> ${area}`).toBe(true);
      }
    }
  });

  it('BOUNDARIES: every layer declares a non-empty files list', () => {
    for (const layer of BOUNDARIES.layers) {
      expect(
        Array.isArray(layer.files) && layer.files.length > 0,
        layer.name,
      ).toBe(true);
    }
  });

  it('BOUNDARIES: every allowPaths entry exists', () => {
    let error: Error | undefined;
    try {
      validateBoundaries(BOUNDARIES);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message ?? '').not.toMatch(/allowPaths entry missing/i);
  });

  it('BOUNDARIES: brand owners are unique, exist, and live under src/domain/', () => {
    const owners = BOUNDARIES.brand.owners;
    expect(new Set(owners).size).toBe(owners.length);
    for (const repoRelative of owners) {
      expect(repoRelative.startsWith('src/domain/'), repoRelative).toBe(true);
    }

    let error: Error | undefined;
    try {
      validateBoundaries(BOUNDARIES);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message ?? '').not.toMatch(/brand owner/i);
  });

  it('BOUNDARIES: globals and dynamicImport name known layers', () => {
    const known = new Set(BOUNDARIES.layers.map((layer) => layer.name));
    for (const name of BOUNDARIES.globals.layers) {
      expect(known.has(name), `global layer ${name}`).toBe(true);
    }
    for (const name of BOUNDARIES.dynamicImport.bannedLayers) {
      expect(known.has(name), `dynamicImport layer ${name}`).toBe(true);
    }
  });

  it('BOUNDARIES: every brand owner imports domain/brand', () => {
    for (const owner of BOUNDARIES.brand.owners) {
      const content = ownerSources[`/${owner}`];
      expect(content, `${owner}: source not loaded`).toBeDefined();
      if (!content) {
        throw new Error(`${owner}: source not loaded`);
      }
      const imports = Array.from(
        content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g),
      );
      const importsBrand = imports.some((match) => {
        const specifier = match[1];
        if (!specifier || !specifier.startsWith('.')) return false;
        const resolved = resolveImport(owner, specifier);
        return stripExtension(resolved) === stripExtension(BOUNDARIES.brand.module);
      });
      expect(importsBrand, owner).toBe(true);
    }
  });
});

describe('validateBoundaries', () => {
  it('validateBoundaries accepts the shipped spec', () => {
    expect(validateBoundaries(BOUNDARIES)).toBeUndefined();
  });

  it('validateBoundaries rejects a layer that references an unknown area', () => {
    const spec = structuredClone(BOUNDARIES);
    const layer = spec.layers[0]!;
    layer.allowed.unknownArea = 'value';
    expect(() => validateBoundaries(spec)).toThrow(/unknown area/i);
  });

  it('validateBoundaries rejects duplicate brand owners', () => {
    const spec = structuredClone(BOUNDARIES);
    const firstOwner = spec.brand.owners[0]!;
    spec.brand.owners = [...spec.brand.owners, firstOwner];
    expect(() => validateBoundaries(spec)).toThrow(/duplicate/i);
  });

  it('validateBoundaries rejects a brand owner that does not exist', () => {
    const spec = structuredClone(BOUNDARIES);
    spec.brand.owners[0] = 'src/domain/missing/Missing.ts';
    expect(() => validateBoundaries(spec)).toThrow(/missing|does not exist|exist/i);
  });
});
