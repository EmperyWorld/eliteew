/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard monaco-editor ≥0.56 worker import ids — short paths under package exports,
 * not ``monaco-editor/esm/vs/...`` (double-prefix miss → Rolldown / stack0 bake fail).
 *
 * Invariants:
 * - configureMonacoEnvironment.ts must not contain ``monaco-editor/esm/vs/``.
 * - Must import editor + language workers via ``monaco-editor/{editor,language}/…?worker``.
 *
 * Related:
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md §Monaco Editor
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENV_FILE = join(__dirname, '../configureMonacoEnvironment.ts');

describe('monaco worker import paths (exports map)', () => {
	const src = readFileSync(ENV_FILE, 'utf8');

	it('does not import via legacy esm/vs worker prefixes', () => {
		const importLines = src
			.split('\n')
			.filter((line) => /^\s*import\s/.test(line))
			.join('\n');
		expect(importLines).not.toMatch(/monaco-editor\/esm\/vs\//);
	});

	it('imports workers via short package-export ids', () => {
		expect(src).toMatch(
			/from\s+['"]monaco-editor\/editor\/editor\.worker\?worker['"]/
		);
		expect(src).toMatch(
			/from\s+['"]monaco-editor\/language\/css\/css\.worker\?worker['"]/
		);
		expect(src).toMatch(
			/from\s+['"]monaco-editor\/language\/html\/html\.worker\?worker['"]/
		);
		expect(src).toMatch(
			/from\s+['"]monaco-editor\/language\/json\/json\.worker\?worker['"]/
		);
		expect(src).toMatch(
			/from\s+['"]monaco-editor\/language\/typescript\/ts\.worker\?worker['"]/
		);
	});
});
