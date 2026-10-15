/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P26 atomization contract: thin CommandPalette orchestrator + module split.
 *
 * Related:
 * - components/CommandPalette.tsx
 * - commandPalette/useCommandPaletteModel.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('CommandPalette P26 atomization contract', () => {
	it('parent CommandPalette.tsx stays under 800 LOC and wires extracted modules', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../CommandPalette.tsx');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain('export type { CommandPaletteProps }');
		expect(src).toContain('export const CommandPalette');
		expect(src).toContain('export default CommandPalette');
		expect(src).toContain('useCommandPaletteModel');
		expect(src).toContain('useCommandPaletteKeyboard');
		expect(src).toContain('CommandPaletteGroups');
		expect(src).toContain('commandPaletteStyles');
	});
});
