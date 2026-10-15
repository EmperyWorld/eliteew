/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract: GafContentLibraryPickerPanel parent ≤650 LOC with named export
 * and extracted preview, row, and action-bar modules.
 *
 * Invariants:
 * - Parent GafContentLibraryPickerPanel.tsx ≤650 lines; named export remains there.
 * - Required child modules exist and stay ≤800 each.
 *
 * Related:
 * - GafContentLibraryPickerPanel.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(dir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('GafContentLibraryPickerPanel atomization contract', () => {
	const parentPath = join(componentsDir, 'GafContentLibraryPickerPanel.tsx');
	const children = [
		'GafContentLibraryPreview.tsx',
		'GafContentLibraryPickerRow.tsx',
		'GafContentLibraryPickerActionBar.tsx',
	] as const;

	it('parent GafContentLibraryPickerPanel.tsx is ≤650 LOC with named export', () => {
		const src = read(parentPath);
		expect(lineCount(parentPath)).toBeLessThanOrEqual(650);
		expect(src).toMatch(/export\s+function\s+GafContentLibraryPickerPanel\b/);
		expect(src).toMatch(/export\s+type\s+GafContentLibraryPickerPanelProps\b/);
	});

	it('wires extracted preview, row, and action-bar modules', () => {
		const src = read(parentPath);
		expect(src).toContain("from './GafContentLibraryPreview'");
		expect(src).toContain("from './GafContentLibraryPickerRow'");
		expect(src).toContain("from './GafContentLibraryPickerActionBar'");
		expect(src).toContain('<GafContentLibraryPreview');
		expect(src).toContain('<GafContentLibraryPickerRow');
		expect(src).toContain('<GafContentLibraryPickerActionBar');
	});

	it('child modules exist and are ≤800 LOC each', () => {
		for (const name of children) {
			const path = join(componentsDir, name);
			expect(lineCount(path)).toBeLessThanOrEqual(800);
		}
	});
});
