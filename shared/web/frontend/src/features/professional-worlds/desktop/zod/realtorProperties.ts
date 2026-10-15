/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for realtor listing CRUD, draft payloads, and intake commands.
 *
 * Invariants:
 * - Listing decimal and nullable fields retain their OpenAPI input/output shapes.
 * - Intake commit requires a UUID job id; free-form draft payloads remain records only.
 *
 * Related:
 * - ../api/realtorProperties.ts
 * - ../api/streaming.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type { RealtorProperty } from '../types';
import {
	decimalCreateField,
	decimalOutField,
	parseListWithSchema,
	parseWithSchema,
} from './shared';

/** Mirrors `RealtorPropertyOut` from the OpenAPI pilot. */
export const realtorPropertyOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	title: z.string(),
	property_type: z.string().default('apartment'),
	deal_type: z.string().default('sale'),
	city: z.string().default('Владивосток'),
	district: z.string().nullable().optional(),
	address: z.string().nullable().optional(),
	price: decimalOutField,
	area_m2: decimalOutField,
	rooms: z.number().int().nullable().optional(),
	floor: z.number().int().nullable().optional(),
	total_floors: z.number().int().nullable().optional(),
	view: z.string().nullable().optional(),
	infrastructure: z.array(z.string()).optional(),
	jtbd_context: z.record(z.string(), z.unknown()).optional(),
	facts: z.record(z.string(), z.unknown()).optional(),
	status: z.string().default('draft'),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorPropertyCreate` from the OpenAPI pilot. */
export const realtorPropertyCreateSchema = z.object({
	title: z.string().min(1).max(220),
	property_type: z.string().max(80).optional(),
	deal_type: z.string().max(80).optional(),
	city: z.string().max(120).optional(),
	district: z.string().max(160).nullable().optional(),
	address: z.string().max(240).nullable().optional(),
	price: decimalCreateField,
	area_m2: decimalCreateField,
	rooms: z.number().int().min(0).max(100).nullable().optional(),
	floor: z.number().int().min(-10).max(300).nullable().optional(),
	total_floors: z.number().int().min(0).max(300).nullable().optional(),
	view: z.string().max(220).nullable().optional(),
	infrastructure: z.array(z.string()).optional(),
	jtbd_context: z.record(z.string(), z.unknown()).optional(),
	facts: z.record(z.string(), z.unknown()).optional(),
	status: z.string().max(80).optional(),
});

/** Mirrors `RealtorPropertyUpdate` from the OpenAPI pilot. */
export const realtorPropertyUpdateSchema = z.object({
	title: z.string().min(1).max(220).nullable().optional(),
	property_type: z.string().max(80).nullable().optional(),
	deal_type: z.string().max(80).nullable().optional(),
	city: z.string().max(120).nullable().optional(),
	district: z.string().max(160).nullable().optional(),
	address: z.string().max(240).nullable().optional(),
	price: decimalCreateField,
	area_m2: decimalCreateField,
	rooms: z.number().int().min(0).max(100).nullable().optional(),
	floor: z.number().int().min(-10).max(300).nullable().optional(),
	total_floors: z.number().int().min(0).max(300).nullable().optional(),
	view: z.string().max(220).nullable().optional(),
	infrastructure: z.array(z.string()).nullable().optional(),
	jtbd_context: z.record(z.string(), z.unknown()).nullable().optional(),
	facts: z.record(z.string(), z.unknown()).nullable().optional(),
	status: z.string().max(80).nullable().optional(),
});

/** Free-form property draft POST payload (`additionalProperties: true` in pilot). */
export const realtorPropertyDraftPayloadSchema = z.record(
	z.string(),
	z.unknown()
);

/** Mirrors `ObjectIntakeParseRequest` from the OpenAPI pilot. */
export const objectIntakeParseRequestSchema = z.object({
	source_text: z.string().min(20).max(12000),
	target_property_id: z.string().uuid().nullable().optional(),
	idempotency_key: z.string().min(8).max(120).nullable().optional(),
});

/** Mirrors `ObjectIntakeCommitRequest` from the OpenAPI pilot. */
export const objectIntakeCommitRequestSchema = z.object({
	job_id: z.string().uuid(),
	accepted_fields: z.array(z.string()).optional(),
	target_property_id: z.string().uuid().nullable().optional(),
});

export function parseRealtorPropertyOut(raw: unknown): RealtorProperty {
	return parseWithSchema(
		realtorPropertyOutSchema,
		raw,
		'Invalid property response'
	);
}

export function parseRealtorPropertyOutList(raw: unknown): RealtorProperty[] {
	return parseListWithSchema(
		realtorPropertyOutSchema,
		raw,
		'Invalid property list response'
	);
}

export function parseRealtorPropertyCreateBody(
	raw: unknown
): z.infer<typeof realtorPropertyCreateSchema> {
	return parseWithSchema(
		realtorPropertyCreateSchema,
		raw,
		'Invalid realtor property create body'
	);
}

export function parseRealtorPropertyUpdateBody(
	raw: unknown
): z.infer<typeof realtorPropertyUpdateSchema> {
	return parseWithSchema(
		realtorPropertyUpdateSchema,
		raw,
		'Invalid realtor property update body'
	);
}

export function parseRealtorPropertyDraftPayloadBody(
	raw: unknown
): z.infer<typeof realtorPropertyDraftPayloadSchema> {
	return parseWithSchema(
		realtorPropertyDraftPayloadSchema,
		raw,
		'Invalid property draft payload'
	);
}

export function parseObjectIntakeParseRequestBody(
	raw: unknown
): z.infer<typeof objectIntakeParseRequestSchema> {
	return parseWithSchema(
		objectIntakeParseRequestSchema,
		raw,
		'Invalid object intake parse body'
	);
}

export function parseObjectIntakeCommitRequestBody(
	raw: unknown
): z.infer<typeof objectIntakeCommitRequestSchema> {
	return parseWithSchema(
		objectIntakeCommitRequestSchema,
		raw,
		'Invalid object intake commit body'
	);
}
