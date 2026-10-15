/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod aggregate schema and parser for the Professional Worlds Desktop bootstrap snapshot.
 *
 * Invariants:
 * - This module imports sibling Out schemas only; leaf domains never depend on the aggregate.
 * - Aggregate rows are validated before the existing snake_case-to-Desktop mapping.
 *
 * Related:
 * - ../api/snapshotBootstrap.ts
 * - ../professionalWorldsSnapshotUtils.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type { ProfessionalWorldsSnapshotApiRow } from '../professionalWorldsSnapshotUtils';
import {
	professionalClientOutSchema,
	professionalDealOutSchema,
} from './crmLite';
import {
	professionalArtifactOutSchema,
	professionalLearningCourseOutSchema,
} from './learningArtifacts';
import { realtorPropertyOutSchema } from './realtorProperties';
import { parseWithSchema } from './shared';
import {
	professionalUserVerticalActivationOutSchema,
	professionalWorldsRuntimeConfigOutSchema,
	professionVerticalOutSchema,
	specialistProfileOutSchema,
} from './verticalsRuntime';

/** Minimal `ProfessionalWorldsSnapshotOut` top-level contract before camelCase mapping. */
export const snapshotOutSchema = z.object({
	verticals: z.array(professionVerticalOutSchema),
	runtime_config: professionalWorldsRuntimeConfigOutSchema.nullable(),
	runtime_configs: z.array(professionalWorldsRuntimeConfigOutSchema),
	vertical_activations: z.array(professionalUserVerticalActivationOutSchema),
	profile: specialistProfileOutSchema.nullable(),
	properties: z.array(realtorPropertyOutSchema),
	clients: z.array(professionalClientOutSchema),
	deals: z.array(professionalDealOutSchema),
	courses: z.array(professionalLearningCourseOutSchema),
	artifacts: z.array(professionalArtifactOutSchema),
	provider_health: z
		.object({
			ugs_ok: z.boolean(),
			degraded: z.boolean(),
			message: z.string().optional().default(''),
		})
		.nullish(),
});

export function parseProfessionalWorldsSnapshotOut(
	raw: unknown
): ProfessionalWorldsSnapshotApiRow {
	return parseWithSchema(
		snapshotOutSchema,
		raw,
		'Invalid snapshot response'
	) as ProfessionalWorldsSnapshotApiRow;
}
