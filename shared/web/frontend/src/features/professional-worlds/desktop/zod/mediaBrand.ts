/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for Professional Worlds property media, enhancement batches, albums, and brand kits.
 *
 * Invariants:
 * - Media batch detail composes the same item and enhancement-job Out schemas used by direct endpoints.
 * - Nullable brand-kit responses preserve the existing null passthrough.
 *
 * Related:
 * - ../api/media.ts
 * - ../api/realtorProperties.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type {
	BrandVisualKitOut,
	MediaEnhancementJob,
	MediaEnhancementRequest,
	ProfessionalMediaAlbum,
	RealtorMediaBatchDetail,
	RealtorMediaBatchItem,
	RealtorPropertyMedia,
} from '../types';
import { parseListWithSchema, parseWithSchema } from './shared';

/** Mirrors `RealtorPropertyMediaCreate` from the OpenAPI pilot. */
export const realtorPropertyMediaCreateSchema = z.object({
	unified_content_id: z.string().uuid(),
	caption: z.string().max(240).nullable().optional(),
	sort_order: z.number().int().optional(),
});

/** Mirrors `RealtorMediaBatchCreate` from the OpenAPI pilot. */
export const realtorMediaBatchCreateSchema = z.object({
	preset_key: z.string().min(2).max(140),
	instruction: z.string().max(2000).nullable().optional(),
	source_content_ids: z.array(z.string().uuid()).min(1).max(64),
	idempotency_key: z.string().min(8).max(160).nullable().optional(),
	batch_meta: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorMediaBatchItemReviewBody` from the OpenAPI pilot. */
export const realtorMediaBatchItemReviewBodySchema = z.object({
	decision: z.enum(['accepted', 'rejected', 'skipped', 'pending']),
});

/** Mirrors `ProfessionalMediaAlbumCreate` from the OpenAPI pilot. */
export const professionalMediaAlbumCreateSchema = z.object({
	title: z.string().min(1).max(220),
	vertical_slug: z.string().max(80).optional(),
	property_id: z.string().uuid().nullable().optional(),
	campaign_id: z.string().uuid().nullable().optional(),
	artifact_id: z.string().uuid().nullable().optional(),
	unified_content_ids: z.array(z.string().uuid()).optional(),
	album_data: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `ProfessionalMediaAlbumPatch` from the OpenAPI pilot. */
export const professionalMediaAlbumPatchSchema = z.object({
	title: z.string().min(1).max(220).nullable().optional(),
	unified_content_ids: z.array(z.string().uuid()).nullable().optional(),
	album_data_patch: z.record(z.string(), z.unknown()).nullable().optional(),
	property_id: z.string().uuid().nullable().optional(),
	campaign_id: z.string().uuid().nullable().optional(),
	artifact_id: z.string().uuid().nullable().optional(),
});

/** Mirrors `BrandVisualKitUpsert` from the OpenAPI pilot. */
export const brandVisualKitUpsertSchema = z.object({
	kit: z.record(z.string(), z.unknown()),
});

/** Mirrors `RealtorPropertyMediaOut` from the OpenAPI pilot. */
export const realtorPropertyMediaOutSchema = z.object({
	id: z.string().uuid(),
	property_id: z.string().uuid(),
	unified_content_id: z.string().uuid(),
	caption: z.string().nullable().optional(),
	sort_order: z.number().default(0),
	created_at: z.string(),
});

/** Mirrors `MediaEnhancementJobOut` from the OpenAPI pilot. */
export const mediaEnhancementJobOutSchema = z.object({
	id: z.string().uuid(),
	property_id: z.string().uuid(),
	source_content_id: z.string().uuid().nullable().optional(),
	output_content_id: z.string().uuid().nullable().optional(),
	preset_key: z.string(),
	status: z.string(),
	instruction: z.string().nullable().optional(),
	provider_result: z.record(z.string(), z.unknown()).optional(),
	batch_job_id: z.string().uuid().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorMediaBatchItemOut` from the OpenAPI pilot. */
export const realtorMediaBatchItemOutSchema = z.object({
	id: z.string().uuid(),
	batch_job_id: z.string().uuid(),
	source_content_id: z.string().uuid(),
	enhancement_job_id: z.string().uuid().nullable().optional(),
	preset_key: z.string().nullable().optional(),
	status: z.string(),
	review_decision: z.string().nullable().optional(),
	error: z.string().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorMediaBatchJobOut` from the OpenAPI pilot. */
export const realtorMediaBatchJobOutSchema = z.object({
	id: z.string().uuid(),
	property_id: z.string().uuid(),
	preset_key: z.string(),
	status: z.string(),
	instruction: z.string().nullable().optional(),
	idempotency_key: z.string().nullable().optional(),
	batch_meta: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
	items: z.array(realtorMediaBatchItemOutSchema).optional().default([]),
});

/** Mirrors `RealtorMediaBatchDetailOut` from the OpenAPI pilot. */
export const realtorMediaBatchDetailOutSchema = z.object({
	batch: realtorMediaBatchJobOutSchema,
	items: z.array(realtorMediaBatchItemOutSchema),
	enhancement_jobs: z
		.array(mediaEnhancementJobOutSchema)
		.optional()
		.default([]),
});

/** Mirrors `ProfessionalMediaAlbumOut` from the OpenAPI pilot. */
export const professionalMediaAlbumOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	vertical_slug: z.string(),
	title: z.string(),
	property_id: z.string().uuid().nullable().optional(),
	campaign_id: z.string().uuid().nullable().optional(),
	artifact_id: z.string().uuid().nullable().optional(),
	unified_content_ids: z.array(z.string()).optional().default([]),
	album_data: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `BrandVisualKitOut` from the OpenAPI pilot. */
export const brandVisualKitOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	vertical_slug: z.string(),
	kit: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `MediaEnhancementRequest` from the OpenAPI pilot. */
export const mediaEnhancementRequestSchema = z.object({
	content_id: z.string().uuid(),
	preset_key: z.string().min(2),
	instruction: z.string().nullable().optional(),
	attach_on_complete: z.boolean().default(false),
	idempotency_key: z.string().nullable().optional(),
	reuse_existing_duplicate_job: z.boolean().default(false),
});

export function parseRealtorPropertyMediaOut(
	raw: unknown
): RealtorPropertyMedia {
	return parseWithSchema(
		realtorPropertyMediaOutSchema,
		raw,
		'Invalid property media response'
	);
}

export function parseRealtorPropertyMediaOutList(
	raw: unknown
): RealtorPropertyMedia[] {
	return parseListWithSchema(
		realtorPropertyMediaOutSchema,
		raw,
		'Invalid property media list response'
	);
}

export function parseMediaEnhancementJobOut(raw: unknown): MediaEnhancementJob {
	return parseWithSchema(
		mediaEnhancementJobOutSchema,
		raw,
		'Invalid media enhancement job response'
	);
}

export function parseMediaEnhancementJobOutList(
	raw: unknown
): MediaEnhancementJob[] {
	return parseListWithSchema(
		mediaEnhancementJobOutSchema,
		raw,
		'Invalid media enhancement job list response'
	);
}

export function parseRealtorMediaBatchDetailOut(
	raw: unknown
): RealtorMediaBatchDetail {
	return parseWithSchema(
		realtorMediaBatchDetailOutSchema,
		raw,
		'Invalid media batch detail response'
	);
}

export function parseRealtorMediaBatchItemOut(
	raw: unknown
): RealtorMediaBatchItem {
	return parseWithSchema(
		realtorMediaBatchItemOutSchema,
		raw,
		'Invalid media batch item response'
	);
}

export function parseProfessionalMediaAlbumOut(
	raw: unknown
): ProfessionalMediaAlbum {
	return parseWithSchema(
		professionalMediaAlbumOutSchema,
		raw,
		'Invalid media album response'
	);
}

export function parseProfessionalMediaAlbumOutList(
	raw: unknown
): ProfessionalMediaAlbum[] {
	return parseListWithSchema(
		professionalMediaAlbumOutSchema,
		raw,
		'Invalid media album list response'
	);
}

export function parseBrandVisualKitOut(raw: unknown): BrandVisualKitOut {
	return parseWithSchema(
		brandVisualKitOutSchema,
		raw,
		'Invalid brand visual kit response'
	);
}

export function parseNullableBrandVisualKitOut(
	raw: unknown
): BrandVisualKitOut | null {
	if (raw == null) {
		return null;
	}
	return parseBrandVisualKitOut(raw);
}

export function parseMediaEnhancementRequestBody(
	raw: unknown
): MediaEnhancementRequest {
	return parseWithSchema(
		mediaEnhancementRequestSchema,
		raw,
		'Invalid media enhancement request body'
	);
}

export function parseRealtorPropertyMediaCreateBody(
	raw: unknown
): z.infer<typeof realtorPropertyMediaCreateSchema> {
	return parseWithSchema(
		realtorPropertyMediaCreateSchema,
		raw,
		'Invalid property media create body'
	);
}

export function parseRealtorMediaBatchCreateBody(
	raw: unknown
): z.infer<typeof realtorMediaBatchCreateSchema> {
	return parseWithSchema(
		realtorMediaBatchCreateSchema,
		raw,
		'Invalid media batch create body'
	);
}

export function parseRealtorMediaBatchItemReviewBody(
	raw: unknown
): z.infer<typeof realtorMediaBatchItemReviewBodySchema> {
	return parseWithSchema(
		realtorMediaBatchItemReviewBodySchema,
		raw,
		'Invalid media batch item review body'
	);
}

export function parseProfessionalMediaAlbumCreateBody(
	raw: unknown
): z.infer<typeof professionalMediaAlbumCreateSchema> {
	return parseWithSchema(
		professionalMediaAlbumCreateSchema,
		raw,
		'Invalid media album create body'
	);
}

export function parseProfessionalMediaAlbumPatchBody(
	raw: unknown
): z.infer<typeof professionalMediaAlbumPatchSchema> {
	return parseWithSchema(
		professionalMediaAlbumPatchSchema,
		raw,
		'Invalid media album patch body'
	);
}

export function parseBrandVisualKitUpsertBody(
	raw: unknown
): z.infer<typeof brandVisualKitUpsertSchema> {
	return parseWithSchema(
		brandVisualKitUpsertSchema,
		raw,
		'Invalid brand visual kit body'
	);
}
