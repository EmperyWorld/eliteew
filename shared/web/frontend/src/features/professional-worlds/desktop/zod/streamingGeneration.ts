/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for Professional Worlds generation bodies and SSE result payloads.
 *
 * Invariants:
 * - Object-intake stream events without job/property identity remain ignorable; malformed identified previews fail closed.
 * - Optional stream artifacts use the same strict artifact Out parser as REST responses.
 *
 * Related:
 * - ../api/streaming.ts
 * - ../api/httpShared.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type {
	CoachSimulationRequest,
	ProfessionalArtifact,
	RealtorGenerationRequest,
} from '../types';
import { parseProfessionalArtifactOut } from './learningArtifacts';
import { realtorPropertyCreateSchema } from './realtorProperties';
import { parseWithSchema } from './shared';

/** Mirrors `RealtorGenerationBody` from the OpenAPI pilot. */
export const realtorGenerationBodySchema = z.object({
	tone: z
		.enum(['jtbd', 'investor', 'family', 'rental', 'premium', 'concise'])
		.default('jtbd'),
	channel: z.string().nullable().optional(),
	instruction: z.string().nullable().optional(),
	idempotency_key: z.string().nullable().optional(),
});

/** Mirrors `CoachSimulationBody` from the OpenAPI pilot. */
export const coachSimulationBodySchema = z.object({
	scenario: z.string().min(1),
	user_message: z.string().min(1),
	idempotency_key: z.string().nullable().optional(),
});

/** Object intake diagnostics emitted on parse SSE (no dedicated pilot Out schema). */
export const objectIntakeDiagnosticsSchema = z.object({
	parse_failed: z.boolean(),
	had_property_key: z.boolean(),
	empty_property_signal: z.boolean(),
	json_strategy: z.string(),
	intake_fallback: z.boolean(),
});

/** Object intake preview payload from parse SSE `result` event. */
export const objectIntakePreviewSchema = z.object({
	job_id: z.string().uuid(),
	property: realtorPropertyCreateSchema,
	confidence: z.record(z.string(), z.number()).optional().default({}),
	warnings: z.array(z.string()).optional().default([]),
	source_text: z.string(),
	intake_diagnostics: objectIntakeDiagnosticsSchema.optional(),
});

/** SSE-only intake diagnostics (no pilot Out schema). */
export type ObjectIntakeDiagnostics = z.infer<
	typeof objectIntakeDiagnosticsSchema
>;

/** SSE-only intake preview (property slice mirrors `RealtorPropertyCreate`). */
export type ObjectIntakePreview = z.infer<typeof objectIntakePreviewSchema>;

export function parseStreamProfessionalArtifactOut(
	raw: unknown
): ProfessionalArtifact | undefined {
	if (raw == null) {
		return undefined;
	}
	return parseProfessionalArtifactOut(raw);
}

export function parseRealtorGenerationBody(
	raw: unknown
): RealtorGenerationRequest {
	return parseWithSchema(
		realtorGenerationBodySchema,
		raw,
		'Invalid generation request body'
	);
}

export function parseCoachSimulationBody(raw: unknown): CoachSimulationRequest {
	return parseWithSchema(
		coachSimulationBodySchema,
		raw,
		'Invalid coach simulation request body'
	);
}

export function parseObjectIntakeStreamPreview(
	raw: unknown
): ObjectIntakePreview | undefined {
	if (raw == null || typeof raw !== 'object') {
		return undefined;
	}
	const row = raw as Record<string, unknown>;
	if (row.job_id == null || row.property == null) {
		return undefined;
	}
	return parseWithSchema(
		objectIntakePreviewSchema,
		{
			job_id: row.job_id,
			property: row.property,
			confidence: row.confidence,
			warnings: row.warnings,
			source_text: row.source_text,
			intake_diagnostics: row.intake_diagnostics,
		},
		'Invalid object intake preview'
	);
}
