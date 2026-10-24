import { Linter } from 'eslint';
import config from '../../eslint.config.js';

const linter = new Linter({ configType: 'flat' });

function lintFor(filename: string, code: string) {
	const messages = linter.verify(code, config as Linter.Config[], { filename });
	return messages.filter(
		(m) =>
			m.ruleId === 'local/no-layer-imports' ||
			m.ruleId === 'local/no-brand-import' ||
			m.ruleId === 'local/no-unlayered-file' ||
			m.ruleId === 'no-restricted-globals'
	);
}

const fixtures: {
	description: string;
	filename: string;
	code: string;
	expectError: boolean;
	expectRule?: string;
}[] = [
	// FORBIDDEN
	{
		description: 'src/domain/foo.ts: FORBIDDEN — import src/ui/**',
		filename: 'src/domain/foo.ts',
		code: 'import x from "../../ui/app/App.svelte"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/domain/foo.ts: FORBIDDEN — import src/ports/**',
		filename: 'src/domain/foo.ts',
		code: 'import x from "../ports/downloadPort"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/domain/foo.ts: FORBIDDEN — import src/builder/state/**',
		filename: 'src/domain/foo.ts',
		code: 'import x from "../../builder/state/state"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/domain/foo.ts: FORBIDDEN — import src/main.ts',
		filename: 'src/domain/foo.ts',
		code: 'import x from "../main.ts"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/domain/foo.ts: FORBIDDEN — import svelte',
		filename: 'src/domain/foo.ts',
		code: 'import x from "svelte"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/domain/format/v1.ts: FORBIDDEN — import src/domain/brand',
		filename: 'src/domain/format/v1.ts',
		code: "import { brand } from '../brand'",
		expectError: true,
		expectRule: 'local/no-brand-import'
	},
	{
		description: 'src/builder/state/internal/foo.ts: FORBIDDEN — import src/player/state/**',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../player/state/state"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/builder/state/internal/foo.ts: FORBIDDEN — import src/app/state/**',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../app/state/state"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/builder/state/internal/foo.ts: FORBIDDEN — import svelte',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "svelte"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/player/state/internal/foo.ts: FORBIDDEN — import src/builder/state/**',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../builder/state/state"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/player/state/internal/foo.ts: FORBIDDEN — import src/app/state/**',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../app/state/state"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/app/state/foo.ts: FORBIDDEN — import src/builder/state/internal/**',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../builder/state/internal/foo"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/app/state/foo.ts: FORBIDDEN — import non-root file of src/builder/state/**',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../builder/state/internal/anagram"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/app/state/foo.ts: FORBIDDEN — import src/ui/**',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../ui/foo"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/app/state/foo.ts: FORBIDDEN — import svelte',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "svelte"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ui/player/foo.svelte: FORBIDDEN — import src/ports/**',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import x from "../../ports/foo";</script>',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ui/player/foo.svelte: FORBIDDEN — import src/builder/state/**',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import x from "../../builder/state/state";</script>',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ui/player/foo.svelte: FORBIDDEN — value import src/domain/**',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import { Word } from "../../domain/word/Word";</script>',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ui/player/foo.svelte: FORBIDDEN — value import src/ui/bindings/**',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import { createBuilderFacade } from "../bindings/builderFacade";</script>',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ui/player/foo.svelte: FORBIDDEN — dynamic import of src/ui/bindings/**',
		filename: 'src/ui/player/foo.svelte',
		code: "<script>const x = import('../bindings/builderFacade');</script>",
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ports/foo.ts: FORBIDDEN — non-allowlisted src/domain module',
		filename: 'src/ports/foo.ts',
		code: 'import x from "../domain/word/Word"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ports/foo.ts: FORBIDDEN — import svelte',
		filename: 'src/ports/foo.ts',
		code: 'import x from "svelte"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/ports/foo.ts: FORBIDDEN — import src/domain/brand',
		filename: 'src/ports/foo.ts',
		code: "import { brand } from '../domain/brand'",
		expectError: true,
		expectRule: 'local/no-brand-import'
	},
	{
		description: 'src/ui/bindings/foo.ts: FORBIDDEN — import src/domain/brand',
		filename: 'src/ui/bindings/foo.ts',
		code: "import { brand } from '../../domain/brand'",
		expectError: true,
		expectRule: 'local/no-brand-import'
	},
	{
		description: 'src/main.ts: FORBIDDEN — import src/domain/brand',
		filename: 'src/main.ts',
		code: "import { brand } from './domain/brand'",
		expectError: true,
		expectRule: 'local/no-brand-import'
	},
	{
		description: 'src/domain/foo.ts: FORBIDDEN — dynamic import()',
		filename: 'src/domain/foo.ts',
		code: "const x = import('./foo')",
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/domain/foo.ts: FORBIDDEN — window reference',
		filename: 'src/domain/foo.ts',
		code: 'const x = window;',
		expectError: true,
		expectRule: 'no-restricted-globals'
	},
	{
		description: 'src/builder/state/internal/foo.ts: FORBIDDEN — document reference',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'const x = document;',
		expectError: true,
		expectRule: 'no-restricted-globals'
	},
	{
		description: 'src/domain/deep/nested/foo.ts: FORBIDDEN — relative path resolving outside src/domain',
		filename: 'src/domain/deep/nested/foo.ts',
		code: 'import x from "../../../main.ts"',
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},
	{
		description: 'src/helpers/orphan.ts: FORBIDDEN — file is not assigned to a boundary layer',
		filename: 'src/helpers/orphan.ts',
		code: 'export const x = 1;',
		expectError: true,
		expectRule: 'local/no-unlayered-file'
	},
	{
		description: 'src/ui/player/foo.svelte: FORBIDDEN — dynamic import of src/ports/**',
		filename: 'src/ui/player/foo.svelte',
		code: "<script>const x = import('../../ports/foo');</script>",
		expectError: true,
		expectRule: 'local/no-layer-imports'
	},

	// ALLOWED
	{
		description: 'src/domain/foo.ts: ALLOWED — sibling domain import',
		filename: 'src/domain/foo.ts',
		code: 'import type { Word } from "./word/Word"',
		expectError: false
	},
	{
		description: 'src/builder/state/internal/foo.ts: ALLOWED — import src/domain/**',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../../domain/word/Word"',
		expectError: false
	},
	{
		description: 'src/player/state/internal/foo.ts: ALLOWED — import src/domain/**',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../../domain/word/Word"',
		expectError: false
	},
	{
		description: 'src/app/state/foo.ts: ALLOWED — public root file of src/builder/state/**',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../builder/state/state"',
		expectError: false
	},
	{
		description: 'src/ui/player/foo.svelte: ALLOWED — type-only import src/domain/**',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import type { Word } from "../../domain/word/Word";</script>',
		expectError: false
	},
	{
		description: 'src/ui/player/foo.svelte: ALLOWED — type-only import src/ui/bindings/**',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import type { BuilderFacade } from "../bindings/builderFacade";</script>',
		expectError: false
	},
	{
		description: 'src/ui/app/App.svelte: ALLOWED — value import src/ui/bindings/**',
		filename: 'src/ui/app/App.svelte',
		code: '<script>import { createBuilderFacade } from "../bindings/builderFacade";</script>',
		expectError: false
	},
	{
		description: 'src/ui/bindings/foo.ts: ALLOWED — import src/domain/**',
		filename: 'src/ui/bindings/foo.ts',
		code: 'import x from "../../domain/word/Word"',
		expectError: false
	},
	{
		description: 'src/ui/bindings/foo.ts: ALLOWED — import src/builder/state/**',
		filename: 'src/ui/bindings/foo.ts',
		code: 'import x from "../../builder/state/state"',
		expectError: false
	},
	{
		description: 'src/ports/foo.ts: ALLOWED — domain/ports/ports',
		filename: 'src/ports/foo.ts',
		code: 'import type { DownloadPort } from "../domain/ports/ports"',
		expectError: false
	},
	{
		description: 'src/ports/foo.ts: ALLOWED — domain/rng/Rng',
		filename: 'src/ports/foo.ts',
		code: 'import type { Rng } from "../domain/rng/Rng"',
		expectError: false
	},
	{
		description: 'src/ports/foo.ts: ALLOWED — domain/puzzle/PuzzleKey',
		filename: 'src/ports/foo.ts',
		code: 'import type { PuzzleKey } from "../domain/puzzle/PuzzleKey"',
		expectError: false
	},
	{
		description: 'src/domain/grid/Row.ts: ALLOWED — brand owner import',
		filename: 'src/domain/grid/Row.ts',
		code: "import { brand } from '../brand'",
		expectError: false
	},
	{
		description: 'src/main.ts: ALLOWED — import src/ui/app/App.svelte',
		filename: 'src/main.ts',
		code: 'import App from "./ui/app/App.svelte"',
		expectError: false
	},
	{
		description: 'src/ui/bindings/foo.ts: ALLOWED — window reference',
		filename: 'src/ui/bindings/foo.ts',
		code: 'const x = window;',
		expectError: false
	},
	{
		description: 'src/vite-env.d.ts: ALLOWED — ambient declaration file is exempt',
		filename: 'src/vite-env.d.ts',
		code: '/// <reference types="vite/client" />',
		expectError: false
	}
];

it.each(fixtures)('$description', ({ filename, code, expectError, expectRule }) => {
	const filtered = lintFor(filename, code);
	if (expectError) {
		const matching = filtered.filter((m) => m.ruleId === expectRule);
		expect(matching.length).toBeGreaterThan(0);
	} else {
		expect(filtered).toHaveLength(0);
	}
});
