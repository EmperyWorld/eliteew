/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock seat import / redeem paths: omitted allow_fofline must not coerce to false.
 *
 * Invariants:
 * - Import/redeem use resolveAllowFoflineBoot (or explicit null), never `: false` on omit.
 *
 * Related:
 * - resolveAllowFoflineBoot.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4.2
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

describe('seatImportAllowFofline contract', () => {
	it('seat import resolves omit via resolveAllowFoflineBoot', () => {
		const src = readFileSync(
			resolve(root, 'src/hooks/useSeatPackageImport.ts'),
			'utf8'
		);
		expect(src).toContain('resolveAllowFoflineBoot');
		expect(src).not.toMatch(
			/allow_fofline === 'boolean'\s*\?\s*seat\.allow_fofline\s*:\s*false/
		);
	});

	it('license redeem does not coerce omitted allow_fofline to false', () => {
		const src = readFileSync(
			resolve(root, 'src/hooks/useLicenseRedeem.ts'),
			'utf8'
		);
		expect(src).not.toMatch(
			/allow_fofline === 'boolean'\s*\?\s*result\.allow_fofline\s*:\s*false/
		);
		expect(src).toMatch(/:\s*null/);
	});
});
