import { Linter } from 'eslint';
// @ts-expect-error eslint.config.js is JavaScript and has no ambient declaration.
import config from '../../eslint.config.js';

const linter = new Linter({ configType: 'flat' });

function lintFor(filename: string, code: string) {
	const messages = linter.verify(code, config as Linter.Config[], { filename });
	return messages.filter((m) => m.ruleId === '@typescript-eslint/no-restricted-imports');
}

const fixtures: { description: string; filename: string; code: string; expectError: boolean }[] = [
	// Block 1 — src/domain/**/*.ts
	{
		description: 'src/domain/** forbids svelte/store',
		filename: 'src/domain/foo.ts',
		code: 'import x from "svelte/store"',
		expectError: true
	},
	{
		description: 'src/domain/** forbids importing src/ui',
		filename: 'src/domain/foo.ts',
		code: 'import x from "../../ui/bindings/appStore.svelte"',
		expectError: true
	},
	{
		description: 'src/domain/** forbids importing src/ports',
		filename: 'src/domain/foo.ts',
		code: 'import x from "../ports/downloadPort"',
		expectError: true
	},
	{
		description: 'src/domain/** forbids importing src/builder/state',
		filename: 'src/domain/foo.ts',
		code: 'import x from "../../builder/state/state"',
		expectError: true
	},
	{
		description: 'src/domain/** allows sibling domain import',
		filename: 'src/domain/foo.ts',
		code: 'import type { Word } from "../word/Word"',
		expectError: false
	},

	// Block 2 — src/builder/state/**/*.ts
	{
		description: 'src/builder/state/** forbids importing src/ui',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../ui/foo"',
		expectError: true
	},
	{
		description: 'src/builder/state/** forbids importing src/ports',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../../ports/foo"',
		expectError: true
	},
	{
		description: 'src/builder/state/** forbids importing src/app/state',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../app/state/foo"',
		expectError: true
	},
	{
		description: 'src/builder/state/** forbids player/state/internal',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../player/state/internal/anagram"',
		expectError: true
	},
	{
		description: 'src/builder/state/** forbids svelte',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "svelte"',
		expectError: true
	},
	{
		description: 'src/builder/state/** allows sibling domain import',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../../domain/word/Word"',
		expectError: false
	},
	{
		description: 'src/builder/state/** forbids importing src/player/state (no cross-state-module imports)',
		filename: 'src/builder/state/internal/foo.ts',
		code: 'import x from "../../player/state/state"',
		expectError: true
	},

	// Block 3 — src/player/state/**/*.ts
	{
		description: 'src/player/state/** forbids importing src/ui',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../ui/foo"',
		expectError: true
	},
	{
		description: 'src/player/state/** forbids importing src/ports',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../../ports/foo"',
		expectError: true
	},
	{
		description: 'src/player/state/** forbids importing src/app/state',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../app/state/foo"',
		expectError: true
	},
	{
		description: 'src/player/state/** forbids builder/state/internal',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../builder/state/internal/foo"',
		expectError: true
	},
	{
		description: 'src/player/state/** forbids svelte',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "svelte"',
		expectError: true
	},
	{
		description: 'src/player/state/** allows sibling domain import',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../../domain/word/Word"',
		expectError: false
	},
	{
		description: 'src/player/state/** forbids importing src/builder/state (no cross-state-module imports)',
		filename: 'src/player/state/internal/foo.ts',
		code: 'import x from "../../builder/state/state"',
		expectError: true
	},

	// Block 4 — src/app/state/**/*.ts
	{
		description: 'src/app/state/** forbids importing src/ui',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../ui/foo"',
		expectError: true
	},
	{
		description: 'src/app/state/** forbids importing src/ports',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../ports/foo"',
		expectError: true
	},
	{
		description: 'src/app/state/** forbids builder/state/internal',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../builder/state/internal/foo"',
		expectError: true
	},
	{
		description: 'src/app/state/** forbids player/state/internal',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../player/state/internal/foo"',
		expectError: true
	},
	{
		description: 'src/app/state/** forbids svelte',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "svelte"',
		expectError: true
	},
	{
		description: 'src/app/state/** allows domain import',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../../domain/word/Word"',
		expectError: false
	},
	{
		description: 'src/app/state/** allows builder/state public root',
		filename: 'src/app/state/foo.ts',
		code: 'import x from "../builder/state/state"',
		expectError: false
	},

	// Block 5 — src/ui/** except bindings
	{
		description: 'src/ui/** (non-bindings) forbids importing src/ports',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import x from "../../ports/foo";</script>',
		expectError: true
	},
	{
		description: 'src/ui/** (non-bindings) forbids importing src/builder/state',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import x from "../../builder/state/state";</script>',
		expectError: true
	},
	{
		description: 'src/ui/** (non-bindings) forbids value-import of domain function',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import { Word } from "../../domain/word/Word";</script>',
		expectError: true
	},
	{
		description: 'src/ui/** (non-bindings) allows type-only domain import',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import type { Word } from "../../domain/word/Word";</script>',
		expectError: false
	},
	{
		description: 'src/ui/** (non-bindings) allows svelte',
		filename: 'src/ui/player/foo.svelte',
		code: '<script>import { onMount } from "svelte";</script>',
		expectError: false
	},

	// Block 6 — src/ports/**/*.ts
	{
		description: 'src/ports/** forbids svelte',
		filename: 'src/ports/foo.ts',
		code: 'import x from "svelte"',
		expectError: true
	},
	{
		description: 'src/ports/** forbids src/ui',
		filename: 'src/ports/foo.ts',
		code: 'import x from "../ui/foo"',
		expectError: true
	},
	{
		description: 'src/ports/** forbids non-allowlisted src/domain',
		filename: 'src/ports/foo.ts',
		code: 'import x from "../domain/word/Word"',
		expectError: true
	},
	{
		description: 'src/ports/** allows domain/ports/ports',
		filename: 'src/ports/foo.ts',
		code: 'import type { DownloadPort } from "../domain/ports/ports.ts"',
		expectError: false
	},
	{
		description: 'src/ports/** allows domain/rng/Rng',
		filename: 'src/ports/foo.ts',
		code: 'import type { Rng } from "../domain/rng/Rng.ts"',
		expectError: false
	}
];

it.each(fixtures)('$description', ({ filename, code, expectError }) => {
	const filtered = lintFor(filename, code);
	if (expectError) {
		expect(filtered.length).toBeGreaterThan(0);
	} else {
		expect(filtered).toHaveLength(0);
	}
});
