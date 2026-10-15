/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for Professional Worlds verticals, profiles, activations, and runtime configuration.
 *
 * Invariants:
 * - Runtime config arrays and version fields keep their existing OpenAPI defaults.
 * - Profile and active-release nullability is preserved before Desktop mapping.
 *
 * Related:
 * - ../api/snapshotBootstrap.ts
 * - ../api/verticals.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type {
	ProfessionalUserVerticalActivation,
	ProfessionalWorldsRuntimeConfig,
	ProfessionVertical,
	SpecialistProfile,
} from '../types';
import { professionalPlaybookRuntimeOutSchema } from './playbooks';
import { parseListWithSchema, parseWithSchema } from './shared';

/** Mirrors `SpecialistProfileUpsert` from the OpenAPI pilot. */
export const specialistProfileUpsertSchema = z.object({
	vertical_slug: z.string().min(2).max(80).optional(),
	display_name: z.string().max(180).nullable().optional(),
	headline: z.string().max(240).nullable().optional(),
	city: z.string().max(120).nullable().optional(),
	agency_name: z.string().max(180).nullable().optional(),
	specialization: z.array(z.string()).optional(),
	profile_data: z.record(z.string(), z.unknown()).optional(),
	is_public_ready: z.boolean().optional(),
});

/** Mirrors `ProfessionalUserVerticalOnboardingPatch` from the OpenAPI pilot. */
export const professionalUserVerticalOnboardingPatchSchema = z.object({
	onboarding: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `ProfessionalUserVerticalActivationUpsert` from the OpenAPI pilot. */
export const professionalUserVerticalActivationUpsertSchema = z.object({
	is_active: z.boolean().default(true),
});

/** Mirrors `ProfessionVerticalOut` from the OpenAPI pilot. */
export const professionVerticalOutSchema = z.object({
	slug: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	icon_key: z.string().default(''),
	profile_schema: z.record(z.string(), z.unknown()).optional(),
	workspace_template: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `SpecialistProfileOut` from the OpenAPI pilot. */
export const specialistProfileOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	vertical_slug: z.string().default('realtor'),
	display_name: z.string().nullable().optional(),
	headline: z.string().nullable().optional(),
	city: z.string().nullable().optional(),
	agency_name: z.string().nullable().optional(),
	specialization: z.array(z.string()).optional(),
	profile_data: z.record(z.string(), z.unknown()).optional(),
	is_public_ready: z.boolean().default(false),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ProfessionalUserVerticalActivationOut` from the OpenAPI pilot. */
export const professionalUserVerticalActivationOutSchema = z.object({
	vertical_slug: z.string(),
	is_active: z.boolean().default(true),
	onboarding: z.record(z.string(), z.unknown()).optional(),
	entitlements: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `ProfessionalVerticalModuleOut` from the OpenAPI pilot. */
export const professionalVerticalModuleOutSchema = z.object({
	id: z.string().uuid(),
	vertical_slug: z.string(),
	module_key: z.string(),
	module_name: z.string().nullable().optional(),
	module_description: z.string().nullable().optional(),
	module_category: z.string().nullable().optional(),
	icon_key: z.string().nullable().optional(),
	config: z.record(z.string(), z.unknown()).optional(),
	sort_order: z.number().default(0),
	is_enabled: z.boolean().default(true),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ProfessionalVerticalSchemaOut` from the OpenAPI pilot. */
export const professionalVerticalSchemaOutSchema = z.object({
	id: z.string().uuid(),
	vertical_slug: z.string(),
	schema_key: z.string(),
	version: z.number().default(1),
	title: z.string(),
	schema_json: z.record(z.string(), z.unknown()).optional(),
	ui_schema: z.record(z.string(), z.unknown()).optional(),
	is_active: z.boolean().default(true),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ProfessionalAiActionRuntimeOut` from the OpenAPI pilot. */
export const professionalAiActionRuntimeOutSchema = z.object({
	module_key: z.string(),
	action_key: z.string(),
	display_name: z.string(),
	description: z.string().nullable().optional(),
	input_schema: z.record(z.string(), z.unknown()).optional(),
	artifact_kind: z.string(),
	sort_order: z.number().default(0),
});

/** Mirrors `ProfessionalPhotoPresetRuntimeOut` from the OpenAPI pilot. */
export const professionalPhotoPresetRuntimeOutSchema = z.object({
	id: z.string().uuid(),
	vertical_slug: z.string(),
	preset_key: z.string(),
	display_name: z.string(),
	description: z.string().nullable().optional(),
	category: z.string(),
	action_type: z.string(),
	ugs_type_key: z.string(),
	parameters: z.record(z.string(), z.unknown()).optional(),
	is_active: z.boolean().default(true),
	sort_order: z.number().default(0),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ProfessionalIntegrationBindingOut` from the OpenAPI pilot. */
export const professionalIntegrationBindingOutSchema = z.object({
	id: z.string().uuid(),
	vertical_slug: z.string(),
	integration_key: z.string(),
	display_name: z.string(),
	config: z.record(z.string(), z.unknown()).optional(),
	is_enabled: z.boolean().default(true),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ProfessionalWorldsRuntimeConfig` from the OpenAPI pilot. */
export const professionalWorldsRuntimeConfigOutSchema = z.object({
	vertical_slug: z.string(),
	modules: z.array(professionalVerticalModuleOutSchema).optional().default([]),
	schemas: z.array(professionalVerticalSchemaOutSchema).optional().default([]),
	ai_actions: z
		.array(professionalAiActionRuntimeOutSchema)
		.optional()
		.default([]),
	photo_presets: z
		.array(professionalPhotoPresetRuntimeOutSchema)
		.optional()
		.default([]),
	integrations: z
		.array(professionalIntegrationBindingOutSchema)
		.optional()
		.default([]),
	playbooks: z
		.array(professionalPlaybookRuntimeOutSchema)
		.optional()
		.default([]),
	config_version_hash: z.string().default(''),
	runtime_epoch: z.number().default(0),
	active_release_id: z.string().uuid().nullable().optional(),
});

/** Mirrors `ProfessionalWorldsMultiRuntimeConfig` from the OpenAPI pilot. */
export const professionalWorldsMultiRuntimeConfigOutSchema = z.object({
	configs: z.array(professionalWorldsRuntimeConfigOutSchema),
});

export function parseProfessionVerticalOutList(
	raw: unknown
): ProfessionVertical[] {
	return parseListWithSchema(
		professionVerticalOutSchema,
		raw,
		'Invalid vertical list response'
	);
}

export function parseSpecialistProfileOut(raw: unknown): SpecialistProfile {
	return parseWithSchema(
		specialistProfileOutSchema,
		raw,
		'Invalid profile response'
	);
}

export function parseNullableSpecialistProfileOut(
	raw: unknown
): SpecialistProfile | null {
	if (raw == null) {
		return null;
	}
	return parseSpecialistProfileOut(raw);
}

export function parseProfessionalUserVerticalActivationOutList(
	raw: unknown
): ProfessionalUserVerticalActivation[] {
	return parseListWithSchema(
		professionalUserVerticalActivationOutSchema,
		raw,
		'Invalid vertical activation list response'
	);
}

export function parseProfessionalUserVerticalActivationOut(
	raw: unknown
): ProfessionalUserVerticalActivation {
	return parseWithSchema(
		professionalUserVerticalActivationOutSchema,
		raw,
		'Invalid vertical activation response'
	);
}

export function parseProfessionalWorldsRuntimeConfigOut(
	raw: unknown
): ProfessionalWorldsRuntimeConfig {
	return parseWithSchema(
		professionalWorldsRuntimeConfigOutSchema,
		raw,
		'Invalid runtime config response'
	);
}

export function parseProfessionalWorldsMultiRuntimeConfigOut(raw: unknown): {
	configs: ProfessionalWorldsRuntimeConfig[];
} {
	return parseWithSchema(
		professionalWorldsMultiRuntimeConfigOutSchema,
		raw,
		'Invalid multi runtime config response'
	);
}

export function parseSpecialistProfileUpsertBody(
	raw: unknown
): z.infer<typeof specialistProfileUpsertSchema> {
	return parseWithSchema(
		specialistProfileUpsertSchema,
		raw,
		'Invalid specialist profile upsert body'
	);
}

export function parseProfessionalVerticalOnboardingPatchBody(
	raw: unknown
): z.infer<typeof professionalUserVerticalOnboardingPatchSchema> {
	return parseWithSchema(
		professionalUserVerticalOnboardingPatchSchema,
		raw,
		'Invalid vertical onboarding patch body'
	);
}

export function parseProfessionalVerticalActivationUpsertBody(
	raw: unknown
): z.infer<typeof professionalUserVerticalActivationUpsertSchema> {
	return parseWithSchema(
		professionalUserVerticalActivationUpsertSchema,
		raw,
		'Invalid vertical activation upsert body'
	);
}
