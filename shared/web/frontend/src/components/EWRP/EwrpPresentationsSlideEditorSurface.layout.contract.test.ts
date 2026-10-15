/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EWRP editor focus-mode scroll layout: one slide-list scroll owner with
 * `min-h-0`, never a vh-based min-height that clips sticky footer under
 * overflow-hidden ancestors.
 *
 * Invariants:
 * - Focus-mode list classes include `min-h-0` + `flex-1`.
 * - Source must not reintroduce `min-h-[min(62vh` in the slide list region.
 *
 * Related:
 * - `EwrpPresentationsSlideEditorSurface.tsx`
 * - `documentation/product/EWRP-EDITOR.md` §5
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const surfacePath = join(dir, 'EwrpPresentationsSlideEditorSurface.tsx');

describe('EWRP slide editor focus-mode scroll layout', () => {
	it('keeps focus-mode list as flex-1 min-h-0 without vh min-height', () => {
		const source = readFileSync(surfacePath, 'utf8');
		expect(source).toContain(
			"'min-h-0 flex-1 overflow-hidden px-3 pb-4 sm:px-4'"
		);
		expect(source).toContain(
			"'min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 sm:px-4'"
		);
		expect(source).not.toMatch(/min-h-\[min\(62vh/);
		expect(source).toContain('never `min-h-[…vh…]`');
	});
});
