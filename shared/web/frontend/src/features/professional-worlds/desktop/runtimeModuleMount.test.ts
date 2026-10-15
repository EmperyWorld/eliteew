/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Professional Worlds runtime module mount matrix and snapshot gates.
 *
 * Invariants:
 * - Pure helpers only; no Desktop mount.
 *
 * Related:
 * - runtimeModuleMount.ts
 */

import { describe, expect, it } from 'vitest';

import { PW_FALLBACK_PHOTO_PRESETS } from './ProfessionalMediaWorkbench';
import {
	isRuntimeModuleEnabled,
	resolveRuntimePhotoPresets,
	shouldFetchClientsSnapshot,
	shouldFetchDealsSnapshot,
} from './runtimeModuleMount';
import type { ProfessionalRuntimeModule } from './types';

function mod(moduleKey: string, enabled = true): ProfessionalRuntimeModule {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		vertical_slug: 'realtor',
		module_key: moduleKey,
		module_name: moduleKey,
		module_category: 'crm',
		icon_key: null,
		config: {},
		sort_order: 1,
		is_enabled: enabled,
		created_at: '2026-05-27T09:00:00Z',
		updated_at: '2026-05-27T09:00:00Z',
	};
}

describe('runtimeModuleMount', () => {
	it('gates deals snapshot on clients or deals module', () => {
		expect(shouldFetchDealsSnapshot([mod('profile')])).toBe(false);
		expect(shouldFetchDealsSnapshot([mod('clients')])).toBe(true);
		expect(shouldFetchDealsSnapshot([mod('deals')])).toBe(true);
	});

	it('gates clients snapshot on clients module only', () => {
		expect(shouldFetchClientsSnapshot([mod('deals')])).toBe(false);
		expect(shouldFetchClientsSnapshot([mod('clients')])).toBe(true);
	});

	it('returns empty photo presets when media-studio is disabled', () => {
		expect(
			resolveRuntimePhotoPresets(
				[mod('objects')],
				[],
				PW_FALLBACK_PHOTO_PRESETS
			)
		).toEqual([]);
	});

	it('uses runtime presets or fallback when media-studio is enabled', () => {
		const presets = [
			{
				id: '1',
				vertical_slug: 'realtor',
				preset_key: 'bright',
				display_name: 'Bright',
				description: null,
				category: 'enhance',
				action_type: 'edit',
				ugs_type_key: 'x',
				parameters: {},
				is_active: true,
				sort_order: 1,
				created_at: '',
				updated_at: '',
			},
		];
		expect(
			resolveRuntimePhotoPresets([mod('media-studio')], presets, [])
		).toEqual(presets);
		expect(
			resolveRuntimePhotoPresets(
				[mod('media-studio')],
				[],
				PW_FALLBACK_PHOTO_PRESETS
			).length
		).toBeGreaterThan(0);
	});

	it('respects disabled module rows', () => {
		expect(isRuntimeModuleEnabled([mod('deals', false)], 'deals')).toBe(false);
	});
});
