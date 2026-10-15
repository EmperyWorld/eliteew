/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source-level lock for GET /desktop/install-profile client path.
 *
 * Invariants:
 * - Client path stays `/desktop/install-profile` under DESKTOP_USER_API_PREFIX.
 *
 * Related:
 * - `desktopApi/installProfile.ts`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('desktop install-profile client', () => {
	it('calls /desktop/install-profile', () => {
		const src = readFileSync(
			join(here, '../desktopApi/installProfile.ts'),
			'utf8'
		);
		expect(src).toContain('/install-profile');
		expect(src).toContain('getDesktopInstallProfile');
	});

	it('re-exports from desktopApi aggregator', () => {
		const agg = readFileSync(join(here, '../desktopApi.ts'), 'utf8');
		expect(agg).toContain('getDesktopInstallProfile');
		expect(agg).toContain('DesktopInstallProfileResponse');
	});

	it('keeps community and managed access fields in both API contracts', () => {
		const localTypes = readFileSync(
			join(here, '../desktopApi/types.ts'),
			'utf8'
		);
		const generatedTypes = readFileSync(
			join(here, '../../../../generated/desktop-openapi.ts'),
			'utf8'
		);

		for (const source of [localTypes, generatedTypes]) {
			expect(source).toContain('access_mode');
			expect(source).toContain('seat_activation_required');
		}
	});
});
