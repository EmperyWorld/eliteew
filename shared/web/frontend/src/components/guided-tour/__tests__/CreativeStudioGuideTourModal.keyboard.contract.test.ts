/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for Creative Studio guide capture keyboard handling.
 *
 * Related:
 * - src/components/guided-tour/CreativeStudioGuideTourModal.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('CreativeStudioGuideTourModal keyboard contract', () => {
	it('delegates keyboard handling to useGuideTourCaptureKeyboard', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../CreativeStudioGuideTourModal.tsx'),
			'utf8'
		);
		expect(src).toContain('useGuideTourCaptureKeyboard');
	});
});
