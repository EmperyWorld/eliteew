/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for the generic Professional Worlds CRM-lite clients and deals.
 *
 * Invariants:
 * - Client and deal response defaults remain aligned with the OpenAPI pilot.
 * - Deal/property backfill counters are non-negative integers.
 *
 * Related:
 * - ../api/coreCrm.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type {
	ProfessionalClient,
	ProfessionalDeal,
	ProfessionalDealPropertyLinkBackfillOut,
} from '../types';
import {
	decimalCreateField,
	decimalOutField,
	parseListWithSchema,
	parseWithSchema,
} from './shared';

/** Mirrors `ProfessionalClientOut` from the OpenAPI pilot. */
export const professionalClientOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	vertical_slug: z.string().default('realtor'),
	name: z.string(),
	contact: z.string().nullable().optional(),
	need_summary: z.string().nullable().optional(),
	budget_from: decimalOutField,
	budget_to: decimalOutField,
	preferred_areas: z.array(z.string()).optional(),
	emotional_motive: z.string().nullable().optional(),
	next_action: z.string().nullable().optional(),
	status: z.string().default('lead'),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ProfessionalDealOut` from the OpenAPI pilot. */
export const professionalDealOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	vertical_slug: z.string().default('realtor'),
	client_id: z.string().uuid().nullable().optional(),
	title: z.string(),
	stage: z.string().default('lead'),
	amount: decimalOutField,
	next_action: z.string().nullable().optional(),
	deal_data: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `ProfessionalClientCreate` from the OpenAPI pilot. */
export const professionalClientCreateSchema = z.object({
	vertical_slug: z.string().optional(),
	name: z.string().min(1).max(180),
	contact: z.string().max(240).nullable().optional(),
	need_summary: z.string().nullable().optional(),
	budget_from: decimalCreateField,
	budget_to: decimalCreateField,
	preferred_areas: z.array(z.string()).optional(),
	emotional_motive: z.string().nullable().optional(),
	next_action: z.string().nullable().optional(),
	status: z.string().max(80).optional(),
});

/** Mirrors `ProfessionalDealCreate` from the OpenAPI pilot. */
export const professionalDealCreateSchema = z.object({
	vertical_slug: z.string().optional(),
	client_id: z.string().uuid().nullable().optional(),
	title: z.string().min(1).max(220),
	stage: z.string().max(80).optional(),
	amount: decimalCreateField,
	next_action: z.string().nullable().optional(),
	deal_data: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `ProfessionalDealUpdate` from the OpenAPI pilot. */
export const professionalDealUpdateSchema = z.object({
	client_id: z.string().uuid().nullable().optional(),
	title: z.string().min(1).max(220).nullable().optional(),
	stage: z.string().max(80).nullable().optional(),
	amount: decimalCreateField,
	next_action: z.string().nullable().optional(),
	deal_data: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** Mirrors `ProfessionalDealPropertyLinkBackfillOut` from the OpenAPI pilot. */
export const professionalDealPropertyLinkBackfillOutSchema = z.object({
	updated: z.number().int().min(0),
	skipped: z.number().int().min(0),
});

export function parseProfessionalClientOut(raw: unknown): ProfessionalClient {
	return parseWithSchema(
		professionalClientOutSchema,
		raw,
		'Invalid client response'
	);
}

export function parseProfessionalClientOutList(
	raw: unknown
): ProfessionalClient[] {
	return parseListWithSchema(
		professionalClientOutSchema,
		raw,
		'Invalid client list response'
	);
}

export function parseProfessionalDealOut(raw: unknown): ProfessionalDeal {
	return parseWithSchema(
		professionalDealOutSchema,
		raw,
		'Invalid deal response'
	);
}

export function parseProfessionalDealOutList(raw: unknown): ProfessionalDeal[] {
	return parseListWithSchema(
		professionalDealOutSchema,
		raw,
		'Invalid deal list response'
	);
}

export function parseProfessionalDealPropertyLinkBackfillOut(
	raw: unknown
): ProfessionalDealPropertyLinkBackfillOut {
	return parseWithSchema(
		professionalDealPropertyLinkBackfillOutSchema,
		raw,
		'Invalid deal property link backfill response'
	);
}

export function parseProfessionalClientCreateBody(
	raw: unknown
): z.infer<typeof professionalClientCreateSchema> {
	return parseWithSchema(
		professionalClientCreateSchema,
		raw,
		'Invalid professional client create body'
	);
}

export function parseProfessionalDealCreateBody(
	raw: unknown
): z.infer<typeof professionalDealCreateSchema> {
	return parseWithSchema(
		professionalDealCreateSchema,
		raw,
		'Invalid professional deal create body'
	);
}

export function parseProfessionalDealUpdateBody(
	raw: unknown
): z.infer<typeof professionalDealUpdateSchema> {
	return parseWithSchema(
		professionalDealUpdateSchema,
		raw,
		'Invalid professional deal update body'
	);
}
