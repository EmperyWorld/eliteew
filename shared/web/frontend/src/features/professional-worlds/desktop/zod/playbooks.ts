/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for Professional Worlds playbook runtime, runs, launch bodies, and quota summaries.
 *
 * Invariants:
 * - Playbook run artifacts retain strict step-order and optional artifact metadata validation.
 * - Launch idempotency keys remain capped at 160 characters.
 *
 * Related:
 * - ../api/playbooks.ts
 * - ../api/verticals.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type { ProfessionalPlaybookRun } from '../types';
import { parseListWithSchema, parseWithSchema } from './shared';

/** Mirrors `ProfessionalPlaybookRuntimeOut` from the OpenAPI pilot. */
export const professionalPlaybookRuntimeOutSchema = z.object({
	playbook_key: z.string(),
	display_name: z.string(),
	description: z.string().nullable().optional(),
	sort_order: z.number().default(0),
});

/** Mirrors `ProfessionalPlaybookRunArtifactOut` from the OpenAPI pilot. */
export const professionalPlaybookRunArtifactOutSchema = z.object({
	step_order: z.number(),
	artifact_id: z.string().uuid().nullable().optional(),
	artifact_kind: z.string().nullable().optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `ProfessionalPlaybookRunOut` from the OpenAPI pilot. */
export const professionalPlaybookRunOutSchema = z.object({
	id: z.string().uuid(),
	vertical_slug: z.string(),
	playbook_key: z.string(),
	status: z.string(),
	idempotency_key: z.string().nullable().optional(),
	step_logs: z.array(z.unknown()).optional().default([]),
	error: z.string().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
	artifacts: z
		.array(professionalPlaybookRunArtifactOutSchema)
		.optional()
		.default([]),
});

/** Mirrors `ProfessionalPlaybookLaunchBody` from the OpenAPI pilot. */
export const professionalPlaybookLaunchBodySchema = z.object({
	variables: z.record(z.string(), z.unknown()).optional(),
	idempotency_key: z.string().max(160).nullable().optional(),
});

/** Mirrors `RealtorQuotaPlaybookEstimateOut` from OpenAPI. */
export const realtorQuotaPlaybookEstimateOutSchema = z.object({
	playbook_key: z.string(),
	display_name: z.string().nullable().optional(),
	total_estimated_units: z.number().default(0),
	total_ugs_credits: z.number().nullable().optional(),
});

/** Mirrors `RealtorQuotaSummaryOut` from OpenAPI. */
export const realtorQuotaSummaryOutSchema = z.object({
	vertical_slug: z.string().default('realtor'),
	credits_used_24h: z.number().default(0),
	credits_balance: z.number().nullable().optional(),
	playbook_estimates: z
		.array(realtorQuotaPlaybookEstimateOutSchema)
		.default([]),
});

export function parseProfessionalPlaybookRunOut(
	raw: unknown
): ProfessionalPlaybookRun {
	return parseWithSchema(
		professionalPlaybookRunOutSchema,
		raw,
		'Invalid playbook run response'
	);
}

export function parseProfessionalPlaybookRunOutList(
	raw: unknown
): ProfessionalPlaybookRun[] {
	return parseListWithSchema(
		professionalPlaybookRunOutSchema,
		raw,
		'Invalid playbook run list response'
	);
}

export function parseProfessionalPlaybookLaunchBody(
	raw: unknown
): z.infer<typeof professionalPlaybookLaunchBodySchema> {
	return parseWithSchema(
		professionalPlaybookLaunchBodySchema,
		raw,
		'Invalid playbook launch body'
	);
}

export function parseRealtorQuotaSummaryOut(
	raw: unknown
): z.infer<typeof realtorQuotaSummaryOutSchema> {
	return parseWithSchema(
		realtorQuotaSummaryOutSchema,
		raw,
		'Invalid realtor quota summary'
	);
}
