/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for pinned-app context menu keyboard dismiss alignment.
 *
 * Related:
 * - src/pages/Desktop/components/taskbarStrip/TaskbarPinnedMenuIsland.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskbarPinnedAndWindowsStrip keyboard contract', () => {
	it('aligns pinned app context menu dismiss with capture Escape and initial focus', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../taskbarStrip/TaskbarPinnedMenuIsland.tsx'),
			'utf8'
		);
		expect(src).toContain('escapeCapture: true');
		expect(src).toContain('focusFirstMenuItem: true');
	});

	it('closes pinned app context menu on Escape before dismissing pinned grid modal', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../taskbarStrip/TaskbarPinnedMenuIsland.tsx'),
			'utf8'
		);
		expect(src).toContain("if (e.key !== 'Escape') return");
		expect(src).toContain('if (pinnedAppCtx != null)');
		expect(src).toContain('setPinnedAppCtx(null)');
	});
});
