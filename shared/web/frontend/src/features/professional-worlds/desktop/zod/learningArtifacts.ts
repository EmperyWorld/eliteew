/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for Professional Worlds learning courses and generated artifacts.
 *
 * Invariants:
 * - Lesson and artifact defaults match the OpenAPI pilot before UI mapping.
 * - Invalid list members fail the complete response closed.
 *
 * Related:
 * - ../api/coreCrm.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type {
	ProfessionalArtifact,
	ProfessionalLearningCourse,
} from '../types';
import { parseListWithSchema, parseWithSchema } from './shared';

/** Mirrors `ProfessionalLearningLessonOut` from the OpenAPI pilot. */
export const professionalLearningLessonOutSchema = z.object({
	id: z.string().uuid(),
	lesson_key: z.string(),
	title: z.string(),
	summary: z.string().nullable().optional(),
	content_md: z.string(),
	exercise: z.record(z.string(), z.unknown()).optional(),
	sort_order: z.number().int().default(0),
	completed: z.boolean().default(false),
});

/** Mirrors `ProfessionalLearningCourseOut` from the OpenAPI pilot. */
export const professionalLearningCourseOutSchema = z.object({
	id: z.string().uuid(),
	course_key: z.string(),
	vertical_slug: z.string(),
	title: z.string(),
	description: z.string().nullable().optional(),
	level: z.string(),
	sort_order: z.number().int().default(0),
	lessons: z.array(professionalLearningLessonOutSchema).optional(),
});

/** Mirrors `ProfessionalArtifactOut` from the OpenAPI pilot. */
export const professionalArtifactOutSchema = z.object({
	id: z.string().uuid(),
	vertical_slug: z.string(),
	source_type: z.string(),
	source_id: z.string().uuid().nullable().optional(),
	recipe_key: z.string().nullable().optional(),
	title: z.string(),
	content: z.string().nullable().optional(),
	artifact_data: z.record(z.string(), z.unknown()).optional(),
	unified_content_id: z.string().uuid().nullable().optional(),
	ugs_request_id: z.string().uuid().nullable().optional(),
	module_key: z.string().nullable().optional(),
	artifact_kind: z.string().default(''),
	parent_artifact_id: z.string().uuid().nullable().optional(),
	source_media_id: z.string().uuid().nullable().optional(),
	export_metadata: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
});

export function parseProfessionalLearningCourseOutList(
	raw: unknown
): ProfessionalLearningCourse[] {
	return parseListWithSchema(
		professionalLearningCourseOutSchema,
		raw,
		'Invalid learning course list response'
	);
}

export function parseProfessionalArtifactOut(
	raw: unknown
): ProfessionalArtifact {
	return parseWithSchema(
		professionalArtifactOutSchema,
		raw,
		'Invalid artifact response'
	);
}

export function parseProfessionalArtifactOutList(
	raw: unknown
): ProfessionalArtifact[] {
	return parseListWithSchema(
		professionalArtifactOutSchema,
		raw,
		'Invalid artifact list response'
	);
}
