/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schema and parsers for Professional Worlds cross-app draft lifecycle links.
 *
 * Invariants:
 * - Draft lifecycle and stale metadata preserve server values without client-side coercion.
 * - Invalid list members fail the complete response closed.
 *
 * Related:
 * - ../api/crossAppDrafts.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type { ProfessionalCrossAppDraftLink } from '../types';
import { parseListWithSchema, parseWithSchema } from './shared';

/** Mirrors `ProfessionalCrossAppDraftLinkOut` from the OpenAPI pilot. */
export const professionalCrossAppDraftLinkOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	vertical_slug: z.string(),
	draft_kind: z.string(),
	artifact_id: z.string().uuid().nullable().optional(),
	external_ref: z.record(z.string(), z.unknown()).optional(),
	lifecycle_state: z.string(),
	stale_reason: z.string().nullable().optional(),
	source_digest: z.string().nullable().optional(),
	is_stale: z.boolean().default(false),
	stale_hint: z.string().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

export function parseProfessionalCrossAppDraftLinkOut(
	raw: unknown
): ProfessionalCrossAppDraftLink {
	return parseWithSchema(
		professionalCrossAppDraftLinkOutSchema,
		raw,
		'Invalid cross-app draft link response'
	);
}

export function parseProfessionalCrossAppDraftLinkOutList(
	raw: unknown
): ProfessionalCrossAppDraftLink[] {
	return parseListWithSchema(
		professionalCrossAppDraftLinkOutSchema,
		raw,
		'Invalid cross-app draft link list response'
	);
}
