/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Test factories for Professional Worlds OpenAPI-aligned rows (runtime modules, presets).
 *
 * Invariants:
 * - Defaults include required OpenAPI timestamp and sort fields.
 *
 * Related:
 * - professionalWorldsApiZod.ts
 * - types.ts
 */

import type {
	ProfessionalCrossAppDraftLink,
	ProfessionalRuntimeIntegration,
	ProfessionalRuntimeModule,
	ProfessionalRuntimePhotoPreset,
	ProfessionalWorldsRuntimeConfig,
	ProfessionalWorldsSnapshot,
} from './types';

export const PW_TEST_TS = '2026-05-27T09:00:00Z';

export function makeRuntimeConfig(
	overrides: Partial<ProfessionalWorldsRuntimeConfig> = {}
): ProfessionalWorldsRuntimeConfig {
	return {
		vertical_slug: 'realtor',
		modules: [],
		schemas: [],
		ai_actions: [],
		photo_presets: [],
		integrations: [],
		playbooks: [],
		config_version_hash: '',
		runtime_epoch: 0,
		...overrides,
	};
}

export function makeEmptySnapshot(
	overrides: Partial<ProfessionalWorldsSnapshot> = {}
): ProfessionalWorldsSnapshot {
	return {
		verticals: [],
		runtimeConfig: makeRuntimeConfig(),
		runtimeConfigs: [],
		verticalActivations: [],
		profile: null,
		properties: [],
		clients: [],
		deals: [],
		courses: [],
		artifacts: [],
		...overrides,
	};
}

export function makeRuntimeModule(
	overrides: Partial<ProfessionalRuntimeModule> &
		Pick<ProfessionalRuntimeModule, 'id' | 'module_key'>
): ProfessionalRuntimeModule {
	return {
		vertical_slug: 'realtor',
		module_name: null,
		module_description: null,
		module_category: null,
		icon_key: null,
		config: {},
		sort_order: 0,
		is_enabled: true,
		created_at: PW_TEST_TS,
		updated_at: PW_TEST_TS,
		...overrides,
	};
}

export function makeRuntimeModuleByKey(
	moduleKey: string,
	id?: string
): ProfessionalRuntimeModule {
	return makeRuntimeModule({
		id:
			id ?? `00000000-0000-4000-8000-${moduleKey.slice(0, 12).padEnd(12, '0')}`,
		module_key: moduleKey,
	});
}

export function makePhotoPreset(
	overrides: Partial<ProfessionalRuntimePhotoPreset> &
		Pick<ProfessionalRuntimePhotoPreset, 'id' | 'preset_key'>
): ProfessionalRuntimePhotoPreset {
	return {
		vertical_slug: 'realtor',
		display_name: overrides.preset_key,
		description: null,
		category: 'enhance',
		action_type: 'enhance',
		ugs_type_key: 'image',
		parameters: {},
		is_active: true,
		sort_order: 0,
		created_at: PW_TEST_TS,
		updated_at: PW_TEST_TS,
		...overrides,
	};
}

export function makeRuntimeIntegration(
	overrides: Partial<ProfessionalRuntimeIntegration> &
		Pick<ProfessionalRuntimeIntegration, 'id' | 'integration_key'>
): ProfessionalRuntimeIntegration {
	return {
		vertical_slug: 'realtor',
		display_name: overrides.integration_key,
		config: {},
		is_enabled: true,
		created_at: PW_TEST_TS,
		updated_at: PW_TEST_TS,
		...overrides,
	};
}

export function makeCrossAppDraftLink(
	overrides: Partial<ProfessionalCrossAppDraftLink> &
		Pick<ProfessionalCrossAppDraftLink, 'id'>
): ProfessionalCrossAppDraftLink {
	return {
		user_id: '22222222-2222-4222-8222-222222222222',
		vertical_slug: 'realtor',
		draft_kind: 'ewrp',
		artifact_id: null,
		lifecycle_state: 'created',
		is_stale: false,
		created_at: PW_TEST_TS,
		updated_at: PW_TEST_TS,
		...overrides,
	};
}
