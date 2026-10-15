/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for spotlight guide capture keyboard handling.
 *
 * Related:
 * - src/components/guided-tour/SpotlightGuideModal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('SpotlightGuideModal keyboard contract', () => {
	it('delegates keyboard handling to useGuideTourCaptureKeyboard', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../SpotlightGuideModal.tsx'), 'utf8');
		expect(src).toContain('useGuideTourCaptureKeyboard');
	});
});
