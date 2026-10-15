/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for workflow row menu keyboard semantics (E5 flow, plan 19/20).
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionWorkflowRowMenu.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('CompanionWorkflowRowMenu keyboard contract', () => {
	it('exposes menu trigger semantics for keyboard users', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../../companionOutputSurface/CompanionWorkflowRowMenu.tsx'),
			'utf8'
		);
		expect(src).toContain('aria-haspopup="menu"');
		expect(src).toContain('aria-expanded={open}');
		expect(src).toContain('aria-controls={menuId}');
		expect(src).toContain('role="menu"');
		expect(src).toContain('DESKTOP_CHROME_FOCUS_VISIBLE');
	});
});
