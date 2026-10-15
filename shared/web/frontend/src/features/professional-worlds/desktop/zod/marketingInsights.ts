/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for realtor pricing insights, marketing, objections, and publication channels.
 *
 * Invariants:
 * - Write schemas preserve nullable patch semantics from the OpenAPI pilot.
 * - Marketing and publication response lists fail closed on any drifted row.
 *
 * Related:
 * - ../api/realtorProMarketing.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type {
	RealtorListingQualityScore,
	RealtorMarketingCampaign,
	RealtorObjectionReply,
	RealtorObjectionReplyUpsert,
	RealtorPriceAnalysisSnapshot,
	RealtorPublicationChannel,
	RealtorPublicationChannelPatch,
	RealtorPublicationChannelUpsert,
} from '../types';
import { parseListWithSchema, parseWithSchema } from './shared';

/** Mirrors `MarketingCampaignCreate` from the OpenAPI pilot. */
export const marketingCampaignCreateSchema = z.object({
	property_id: z.string().uuid().nullable().optional(),
	title: z.string().min(1).max(220),
	channels: z.array(z.unknown()).optional(),
	status: z.string().max(80).optional(),
	campaign_data: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `MarketingCampaignUpdate` from the OpenAPI pilot. */
export const marketingCampaignUpdateSchema = z.object({
	title: z.string().min(1).max(220).nullable().optional(),
	channels: z.array(z.unknown()).nullable().optional(),
	status: z.string().max(80).nullable().optional(),
	campaign_data: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** Mirrors `PriceAnalysisSnapshotCreate` from the OpenAPI pilot. */
export const priceAnalysisSnapshotCreateSchema = z.object({
	snapshot: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorListingQualityScoreOut` from the OpenAPI pilot. */
export const realtorListingQualityScoreOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	property_id: z.string().uuid(),
	score: z.number(),
	breakdown: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
});

/** Mirrors `RealtorPriceAnalysisSnapshotOut` from the OpenAPI pilot. */
export const realtorPriceAnalysisSnapshotOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	property_id: z.string().uuid(),
	snapshot: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
});

/** Mirrors `RealtorMarketingCampaignOut` from the OpenAPI pilot. */
export const realtorMarketingCampaignOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	property_id: z.string().uuid().nullable().optional(),
	title: z.string(),
	channels: z.array(z.unknown()).optional().default([]),
	status: z.string(),
	campaign_data: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorObjectionReplyOut` from the OpenAPI pilot. */
export const realtorObjectionReplyOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	objection_key: z.string(),
	reply_text: z.string(),
	tags: z.array(z.unknown()).optional().default([]),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorPublicationChannelOut` from the OpenAPI pilot. */
export const realtorPublicationChannelOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	property_id: z.string().uuid(),
	channel_key: z.string(),
	status: z.string(),
	meta: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ObjectionReplyUpsert` from the OpenAPI pilot. */
export const objectionReplyUpsertSchema = z.object({
	reply_text: z.string().min(1),
	tags: z.array(z.string()).optional(),
});

/** Mirrors `PublicationChannelUpsert` from the OpenAPI pilot. */
export const publicationChannelUpsertSchema = z.object({
	channel_key: z.string().min(1),
	status: z.enum(['pending', 'published', 'failed']).default('pending'),
	meta: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `PublicationChannelPatch` from the OpenAPI pilot. */
export const publicationChannelPatchSchema = z.object({
	status: z.enum(['pending', 'published', 'failed']).nullable().optional(),
	meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export function parseRealtorListingQualityScoreOut(
	raw: unknown
): RealtorListingQualityScore {
	return parseWithSchema(
		realtorListingQualityScoreOutSchema,
		raw,
		'Invalid listing quality score response'
	);
}

export function parseRealtorListingQualityScoreOutList(
	raw: unknown
): RealtorListingQualityScore[] {
	return parseListWithSchema(
		realtorListingQualityScoreOutSchema,
		raw,
		'Invalid listing quality score list response'
	);
}

export function parseRealtorPriceAnalysisSnapshotOut(
	raw: unknown
): RealtorPriceAnalysisSnapshot {
	return parseWithSchema(
		realtorPriceAnalysisSnapshotOutSchema,
		raw,
		'Invalid price analysis snapshot response'
	);
}

export function parseRealtorPriceAnalysisSnapshotOutList(
	raw: unknown
): RealtorPriceAnalysisSnapshot[] {
	return parseListWithSchema(
		realtorPriceAnalysisSnapshotOutSchema,
		raw,
		'Invalid price analysis snapshot list response'
	);
}

export function parseRealtorMarketingCampaignOut(
	raw: unknown
): RealtorMarketingCampaign {
	return parseWithSchema(
		realtorMarketingCampaignOutSchema,
		raw,
		'Invalid marketing campaign response'
	);
}

export function parseRealtorMarketingCampaignOutList(
	raw: unknown
): RealtorMarketingCampaign[] {
	return parseListWithSchema(
		realtorMarketingCampaignOutSchema,
		raw,
		'Invalid marketing campaign list response'
	);
}

export function parseRealtorObjectionReplyOutList(
	raw: unknown
): RealtorObjectionReply[] {
	return parseListWithSchema(
		realtorObjectionReplyOutSchema,
		raw,
		'Invalid objection reply list response'
	);
}

export function parseRealtorObjectionReplyOut(
	raw: unknown
): RealtorObjectionReply {
	return parseWithSchema(
		realtorObjectionReplyOutSchema,
		raw,
		'Invalid objection reply response'
	);
}

export function parseRealtorPublicationChannelOut(
	raw: unknown
): RealtorPublicationChannel {
	return parseWithSchema(
		realtorPublicationChannelOutSchema,
		raw,
		'Invalid publication channel response'
	);
}

export function parseRealtorPublicationChannelOutList(
	raw: unknown
): RealtorPublicationChannel[] {
	return parseListWithSchema(
		realtorPublicationChannelOutSchema,
		raw,
		'Invalid publication channel list response'
	);
}

export function parseMarketingCampaignCreateBody(
	raw: unknown
): z.infer<typeof marketingCampaignCreateSchema> {
	return parseWithSchema(
		marketingCampaignCreateSchema,
		raw,
		'Invalid marketing campaign create body'
	);
}

export function parseMarketingCampaignUpdateBody(
	raw: unknown
): z.infer<typeof marketingCampaignUpdateSchema> {
	return parseWithSchema(
		marketingCampaignUpdateSchema,
		raw,
		'Invalid marketing campaign update body'
	);
}

export function parsePriceAnalysisSnapshotCreateBody(
	raw: unknown
): z.infer<typeof priceAnalysisSnapshotCreateSchema> {
	return parseWithSchema(
		priceAnalysisSnapshotCreateSchema,
		raw,
		'Invalid price analysis snapshot create body'
	);
}

export function parseObjectionReplyUpsertBody(
	raw: unknown
): RealtorObjectionReplyUpsert {
	return parseWithSchema(
		objectionReplyUpsertSchema,
		raw,
		'Invalid objection reply upsert body'
	);
}

export function parsePublicationChannelUpsertBody(
	raw: unknown
): RealtorPublicationChannelUpsert {
	return parseWithSchema(
		publicationChannelUpsertSchema,
		raw,
		'Invalid publication channel upsert body'
	);
}

export function parsePublicationChannelPatchBody(
	raw: unknown
): RealtorPublicationChannelPatch {
	return parseWithSchema(
		publicationChannelPatchSchema,
		raw,
		'Invalid publication channel patch body'
	);
}
