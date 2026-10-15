/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for professional vertical template helpers (core modules, media context gates).
 *
 * Invariants:
 * - Consultant has no listing media context; realtor maps to realtor media APIs.
 *
 * Related:
 * - professionalVerticalTemplate.ts
 */

import { describe, expect, it } from 'vitest';

import {
	listCoreModuleKeys,
	mediaContextForVertical,
	playbooksModuleKeyForVertical,
	verticalSupportsListingWorkspace,
} from './professionalVerticalTemplate';
import type { ProfessionalRuntimeModule } from './types';

function objectsModuleFixture(
	overrides: Partial<ProfessionalRuntimeModule> = {}
): ProfessionalRuntimeModule {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		vertical_slug: 'realtor',
		module_key: 'objects',
		module_name: 'objects',
		module_description: null,
		module_category: 'crm',
		icon_key: null,
		config: {},
		sort_order: 1,
		is_enabled: true,
		created_at: '2026-05-27T09:00:00Z',
		updated_at: '2026-05-27T09:00:00Z',
		...overrides,
	};
}

describe('professionalVerticalTemplate', () => {
	it('listCoreModuleKeys returns shared catalog keys without objects addon', () => {
		expect(listCoreModuleKeys()).toEqual([
			'profile',
			'clients',
			'deals',
			'learning',
			'public-presence',
			'artifacts',
		]);
	});

	it('playbooksModuleKeyForVertical follows slug convention', () => {
		expect(playbooksModuleKeyForVertical('consultant')).toBe(
			'consultant_playbooks'
		);
	});

	it('mediaContextForVertical returns realtor for realtor slug', () => {
		expect(mediaContextForVertical('realtor')).toBe('realtor');
	});

	it('mediaContextForVertical returns null for consultant (no listing media)', () => {
		expect(mediaContextForVertical('consultant')).toBeNull();
	});

	it('verticalSupportsListingWorkspace stays realtor-gated when objects enabled', () => {
		expect(
			verticalSupportsListingWorkspace('realtor', [objectsModuleFixture()])
		).toBe(true);
		expect(
			verticalSupportsListingWorkspace('consultant', [
				objectsModuleFixture({ vertical_slug: 'consultant' }),
			])
		).toBe(false);
	});
});
