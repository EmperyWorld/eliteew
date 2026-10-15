/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer E lock — UltimateDocEditorInner stable path stays a thin facade;
 * compose stages and InnerView children stay within LOC budget.
 *
 * Invariants:
 * - Facade exports named UltimateDocEditorInner and stays ≤200 LOC.
 * - UltimateDocEditor.tsx still imports from `./UltimateDocEditorInner`.
 * - Each Wave 13 child module ≤800 LOC.
 *
 * Related:
 * - UltimateDocEditorInner.tsx, hooks/useUltimateDocEditorInnerCompose.ts
 * - documentation/product/ULTIMATE-DOC-EDITOR.md
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const innerDir = join(dir, '..');
const udeDir = join(innerDir, '..');
const hooksDir = join(udeDir, 'hooks');
const MAX_FACADE_LOC = 200;
const MAX_CHILD_LOC = 800;

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('UltimateDocEditorInner atomization contract (Wave 13)', () => {
	const facadePath = join(udeDir, 'UltimateDocEditorInner.tsx');
	const publicEntryPath = join(udeDir, 'UltimateDocEditor.tsx');
	const children = [
		{
			path: join(hooksDir, 'useUltimateDocEditorInnerCompose.ts'),
			label: 'useUltimateDocEditorInnerCompose.ts',
		},
		{
			path: join(hooksDir, 'useUltimateDocEditorInnerBootstrapCompose.ts'),
			label: 'useUltimateDocEditorInnerBootstrapCompose.ts',
		},
		{
			path: join(hooksDir, 'useUltimateDocEditorInnerContentCompose.ts'),
			label: 'useUltimateDocEditorInnerContentCompose.ts',
		},
		{
			path: join(hooksDir, 'useUltimateDocEditorInnerChromeCompose.ts'),
			label: 'useUltimateDocEditorInnerChromeCompose.ts',
		},
		{
			path: join(innerDir, 'UltimateDocEditorInnerView.tsx'),
			label: 'UltimateDocEditorInnerView.tsx',
		},
	] as const;

	it('facade exports named UltimateDocEditorInner', () => {
		const src = read(facadePath);
		expect(src).toMatch(/export\s+const\s+UltimateDocEditorInner\b/);
	});

	it('facade is thin compose+view shell (≤200 LOC)', () => {
		const src = read(facadePath);
		const loc = lineCount(facadePath);
		expect(loc).toBeLessThanOrEqual(MAX_FACADE_LOC);
		expect(src).toContain("from './hooks/useUltimateDocEditorInnerCompose'");
		expect(src).toContain("from './inner/UltimateDocEditorInnerView'");
		expect(src).toContain('useUltimateDocEditorInnerCompose(');
		expect(src).toContain('<UltimateDocEditorInnerView');
		expect(src).not.toMatch(/useDocEditorCanonicalSave\s*\(/);
		expect(src).not.toMatch(/useDocEditorCompanionShellPayload\s*\(/);
		expect(src).not.toContain('UltimateDocEditorChromeStack');
	});

	it('UltimateDocEditor.tsx still imports Inner from ./UltimateDocEditorInner', () => {
		const src = read(publicEntryPath);
		expect(src).toContain("from './UltimateDocEditorInner'");
		expect(src).toContain('<UltimateDocEditorInner');
	});

	it('all Wave 13 child modules exist and stay ≤800 LOC', () => {
		for (const child of children) {
			expect(existsSync(child.path), child.label).toBe(true);
			const loc = lineCount(child.path);
			expect(loc, child.label).toBeLessThanOrEqual(MAX_CHILD_LOC);
		}
	});

	it('orchestrator chains bootstrap → content → chrome compose', () => {
		const src = read(join(hooksDir, 'useUltimateDocEditorInnerCompose.ts'));
		expect(src).toContain('useUltimateDocEditorInnerBootstrapCompose(');
		expect(src).toContain('useUltimateDocEditorInnerContentCompose(');
		expect(src).toContain('useUltimateDocEditorInnerChromeCompose(');
	});
});
