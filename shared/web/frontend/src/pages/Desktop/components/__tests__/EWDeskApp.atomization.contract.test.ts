/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract: EWDeskApp orchestrator ≤800 LOC with stable default export
 * and extracted list/detail/header/keyboard modules under ewDesk/.
 *
 * Invariants:
 * - Parent EWDeskApp.tsx ≤800 lines; default export remains there.
 * - Required child modules exist and stay ≤800 each.
 *
 * Related:
 * - documentation/product/desktop/EWDESK-NEWS.md
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(dir, '..');
const ewDeskDir = join(componentsDir, 'ewDesk');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('EWDeskApp atomization contract', () => {
	const parentPath = join(componentsDir, 'EWDeskApp.tsx');
	const children = [
		'EwDeskFeedListSection.tsx',
		'EwDeskFeedDetailSection.tsx',
		'EwDeskAppHeader.tsx',
		'useEwDeskAppKeyboard.ts',
	] as const;

	it('parent EWDeskApp.tsx is ≤800 LOC with default export', () => {
		const src = read(parentPath);
		expect(lineCount(parentPath)).toBeLessThanOrEqual(800);
		expect(src).toMatch(/export\s+default\s+function\s+EWDeskApp\b/);
	});

	it('wires extracted list/detail/header/keyboard modules', () => {
		const src = read(parentPath);
		expect(src).toContain("from './ewDesk/EwDeskFeedListSection'");
		expect(src).toContain("from './ewDesk/EwDeskFeedDetailSection'");
		expect(src).toContain("from './ewDesk/EwDeskAppHeader'");
		expect(src).toContain("from './ewDesk/useEwDeskAppKeyboard'");
		expect(src).toContain('<EwDeskFeedListSection');
		expect(src).toContain('<EwDeskFeedDetailSection');
		expect(src).toContain('<EwDeskAppHeader');
		expect(src).toContain('useEwDeskAppKeyboard(');
	});

	it('child modules exist and are ≤800 LOC each', () => {
		for (const name of children) {
			const path = join(ewDeskDir, name);
			expect(lineCount(path)).toBeLessThanOrEqual(800);
		}
	});
});
