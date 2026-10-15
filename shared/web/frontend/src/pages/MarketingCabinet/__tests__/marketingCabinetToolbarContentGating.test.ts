/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for toolbar project-content query gating.
 *
 * Related:
 * - marketingCabinetToolbarContentGating.ts
 */
import { describe, expect, it } from 'vitest';

import {
	MARKETING_TOOLBAR_CONTENT_AUTO_LOAD_VIEWS,
	marketingCabinetShouldLoadToolbarProjectContent,
} from '../marketingCabinetToolbarContentGating';

describe('marketingCabinetShouldLoadToolbarProjectContent', () => {
	it('auto-loads on content-heavy views', () => {
		for (const view of MARKETING_TOOLBAR_CONTENT_AUTO_LOAD_VIEWS) {
			expect(
				marketingCabinetShouldLoadToolbarProjectContent(view, true, false)
			).toBe(true);
		}
	});

	it('defers on jtbd until engage', () => {
		expect(
			marketingCabinetShouldLoadToolbarProjectContent('jtbd', true, false)
		).toBe(false);
		expect(
			marketingCabinetShouldLoadToolbarProjectContent('jtbd', true, true)
		).toBe(true);
	});

	it('returns false without project', () => {
		expect(
			marketingCabinetShouldLoadToolbarProjectContent('overview', false, true)
		).toBe(false);
	});
});
