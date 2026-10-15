/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod schemas and parsers for Realtor Pro CRM leads, tasks, showings, documents, and communications.
 *
 * Invariants:
 * - Lead conversion composes the CRM-lite client Out schema without redefining it.
 * - Every Realtor Pro list parser rejects a drifted member instead of returning a partial list.
 *
 * Related:
 * - ../api/realtorProEndpoints.ts
 * - ../api/realtorProMarketing.ts
 * - ../professionalWorldsApiZod.ts
 */

import { z } from 'zod';

import type {
	ProfessionalClient,
	RealtorBuyerRequirement,
	RealtorCommunicationLog,
	RealtorDealEvent,
	RealtorDocument,
	RealtorLead,
	RealtorSellerProfile,
	RealtorShowing,
	RealtorTask,
} from '../types';
import { professionalClientOutSchema } from './crmLite';
import { parseListWithSchema, parseWithSchema } from './shared';

/** Mirrors `CommunicationLogCreate` from the OpenAPI pilot. */
export const communicationLogCreateSchema = z.object({
	related_type: z.string().min(1).max(80),
	related_id: z.string().uuid().nullable().optional(),
	channel: z.string().min(1).max(80),
	body: z.string().min(1),
	meta: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorCommunicationLogOut` from the OpenAPI pilot. */
export const communicationLogOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	related_type: z.string(),
	related_id: z.string().uuid().nullable().optional(),
	channel: z.string(),
	body: z.string(),
	meta: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
});

/** Mirrors `RealtorLeadOut` from the OpenAPI pilot. */
export const realtorLeadOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	vertical_slug: z.string(),
	name: z.string(),
	contact: z.string().nullable().optional(),
	source: z.string().nullable().optional(),
	status: z.string(),
	notes: z.string().nullable().optional(),
	converted_client_id: z.string().uuid().nullable().optional(),
	lead_data: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorTaskOut` from the OpenAPI pilot. */
export const realtorTaskOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	title: z.string(),
	status: z.string(),
	priority: z.string(),
	due_at: z.string().nullable().optional(),
	reminder_at: z.string().nullable().optional(),
	next_action: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	property_id: z.string().uuid().nullable().optional(),
	client_id: z.string().uuid().nullable().optional(),
	showing_id: z.string().uuid().nullable().optional(),
	deal_id: z.string().uuid().nullable().optional(),
	task_meta: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorLeadConvertOut` from the OpenAPI pilot. */
export const realtorLeadConvertOutSchema = z.object({
	lead: realtorLeadOutSchema,
	client: professionalClientOutSchema,
});

/** Mirrors `RealtorLeadCreate` from the OpenAPI pilot. */
export const realtorLeadCreateSchema = z.object({
	name: z.string().min(1).max(180),
	contact: z.string().max(240).nullable().optional(),
	source: z.string().max(120).nullable().optional(),
	notes: z.string().nullable().optional(),
	status: z.string().max(80).optional(),
	vertical_slug: z.string().max(80).optional(),
	lead_data: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorTaskCreate` from the OpenAPI pilot. */
export const realtorTaskCreateSchema = z.object({
	title: z.string().min(1).max(220),
	status: z.string().max(60).optional(),
	priority: z.string().max(40).optional(),
	due_at: z.string().nullable().optional(),
	reminder_at: z.string().nullable().optional(),
	next_action: z.string().max(280).nullable().optional(),
	notes: z.string().nullable().optional(),
	property_id: z.string().uuid().nullable().optional(),
	client_id: z.string().uuid().nullable().optional(),
	showing_id: z.string().uuid().nullable().optional(),
	deal_id: z.string().uuid().nullable().optional(),
	task_meta: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorTaskUpdate` from the OpenAPI pilot. */
export const realtorTaskUpdateSchema = z.object({
	title: z.string().min(1).max(220).nullable().optional(),
	status: z.string().max(60).nullable().optional(),
	priority: z.string().max(40).nullable().optional(),
	due_at: z.string().nullable().optional(),
	reminder_at: z.string().nullable().optional(),
	next_action: z.string().max(280).nullable().optional(),
	notes: z.string().nullable().optional(),
	property_id: z.string().uuid().nullable().optional(),
	clear_property: z.boolean().optional(),
	client_id: z.string().uuid().nullable().optional(),
	clear_client: z.boolean().optional(),
	showing_id: z.string().uuid().nullable().optional(),
	clear_showing: z.boolean().optional(),
	deal_id: z.string().uuid().nullable().optional(),
	clear_deal: z.boolean().optional(),
	task_meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** Mirrors `RealtorPropertyShowingCreate` from the OpenAPI pilot. */
export const realtorPropertyShowingCreateSchema = z.object({
	property_id: z.string().uuid(),
	client_id: z.string().uuid().nullable().optional(),
	scheduled_at: z.string().min(1),
	status: z.string().max(80).optional(),
	notes: z.string().nullable().optional(),
	duration_minutes: z.number().int().min(1).max(1440).nullable().optional(),
	location_notes: z.string().max(2000).nullable().optional(),
	deal_id: z.string().uuid().nullable().optional(),
});

/** Mirrors `RealtorPropertyShowingUpdate` from the OpenAPI pilot. */
export const realtorPropertyShowingUpdateSchema = z.object({
	client_id: z.string().uuid().nullable().optional(),
	clear_client: z.boolean().optional(),
	scheduled_at: z.string().nullable().optional(),
	status: z.string().max(80).nullable().optional(),
	notes: z.string().nullable().optional(),
	duration_minutes: z.number().int().min(1).max(1440).nullable().optional(),
	location_notes: z.string().max(2000).nullable().optional(),
	deal_id: z.string().uuid().nullable().optional(),
	clear_deal: z.boolean().optional(),
});

/** Mirrors `RealtorPropertyShowingOut` from the OpenAPI pilot. */
export const realtorPropertyShowingOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	property_id: z.string().uuid(),
	client_id: z.string().uuid().nullable().optional(),
	scheduled_at: z.string(),
	status: z.string(),
	notes: z.string().nullable().optional(),
	duration_minutes: z.number().int().nullable().optional(),
	location_notes: z.string().nullable().optional(),
	deal_id: z.string().uuid().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorBuyerRequirementCreate` from the OpenAPI pilot. */
export const realtorBuyerRequirementCreateSchema = z.object({
	title: z.string().min(1).max(220),
	client_id: z.string().uuid().nullable().optional(),
	requirements: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorBuyerRequirementUpdate` from the OpenAPI pilot. */
export const realtorBuyerRequirementUpdateSchema = z.object({
	title: z.string().min(1).max(220).nullable().optional(),
	requirements: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** Mirrors `RealtorSellerProfileCreate` from the OpenAPI pilot. */
export const realtorSellerProfileCreateSchema = z.object({
	client_id: z.string().uuid().nullable().optional(),
	seller_context: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorSellerProfileUpdate` from the OpenAPI pilot. */
export const realtorSellerProfileUpdateSchema = z.object({
	seller_context: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `DealEventAppend` from the OpenAPI pilot. */
export const dealEventAppendSchema = z.object({
	stage_from: z.string().max(80).nullable().optional(),
	stage_to: z.string().min(1).max(80),
	note: z.string().nullable().optional(),
	event_data: z.record(z.string(), z.unknown()).optional(),
});

/** Mirrors `RealtorProDocumentCreate` from the OpenAPI pilot. */
export const realtorProDocumentCreateSchema = z.object({
	deal_id: z.string().uuid().nullable().optional(),
	property_id: z.string().uuid().nullable().optional(),
	title: z.string().min(1).max(220),
	doc_type: z.string().max(120).optional(),
	checklist_state: z.record(z.string(), z.unknown()).optional(),
	unified_content_id: z.string().uuid().nullable().optional(),
});

/** Mirrors `RealtorProDocumentUpdate` from the OpenAPI pilot. */
export const realtorProDocumentUpdateSchema = z.object({
	title: z.string().min(1).max(220).nullable().optional(),
	doc_type: z.string().max(120).nullable().optional(),
	checklist_state: z.record(z.string(), z.unknown()).nullable().optional(),
	unified_content_id: z.string().uuid().nullable().optional(),
});

/** Mirrors `RealtorProDocumentOut` from the OpenAPI pilot. */
export const realtorProDocumentOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	deal_id: z.string().uuid().nullable().optional(),
	property_id: z.string().uuid().nullable().optional(),
	title: z.string(),
	doc_type: z.string(),
	checklist_state: z.record(z.string(), z.unknown()).optional(),
	unified_content_id: z.string().uuid().nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorBuyerRequirementOut` from the OpenAPI pilot. */
export const realtorBuyerRequirementOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	client_id: z.string().uuid().nullable().optional(),
	title: z.string(),
	requirements: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorSellerProfileOut` from the OpenAPI pilot. */
export const realtorSellerProfileOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	client_id: z.string().uuid().nullable().optional(),
	seller_context: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** Mirrors `RealtorDealEventOut` from the OpenAPI pilot. */
export const realtorDealEventOutSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	deal_id: z.string().uuid(),
	stage_from: z.string().nullable().optional(),
	stage_to: z.string(),
	note: z.string().nullable().optional(),
	event_data: z.record(z.string(), z.unknown()).optional(),
	created_at: z.string(),
});

export function parseRealtorCommunicationLogOut(
	raw: unknown
): RealtorCommunicationLog {
	return parseWithSchema(
		communicationLogOutSchema,
		raw,
		'Invalid communication log response'
	);
}

export function parseRealtorCommunicationLogOutList(
	raw: unknown
): RealtorCommunicationLog[] {
	return parseListWithSchema(
		communicationLogOutSchema,
		raw,
		'Invalid communication log list response'
	);
}

export function parseRealtorLeadOut(raw: unknown): RealtorLead {
	return parseWithSchema(realtorLeadOutSchema, raw, 'Invalid lead response');
}

export function parseRealtorLeadOutList(raw: unknown): RealtorLead[] {
	return parseListWithSchema(
		realtorLeadOutSchema,
		raw,
		'Invalid lead list response'
	);
}

export function parseRealtorLeadConvertOut(raw: unknown): {
	lead: RealtorLead;
	client: ProfessionalClient;
} {
	return parseWithSchema(
		realtorLeadConvertOutSchema,
		raw,
		'Invalid lead convert response'
	);
}

export function parseRealtorTaskOut(raw: unknown): RealtorTask {
	return parseWithSchema(realtorTaskOutSchema, raw, 'Invalid task response');
}

export function parseRealtorTaskOutList(raw: unknown): RealtorTask[] {
	return parseListWithSchema(
		realtorTaskOutSchema,
		raw,
		'Invalid task list response'
	);
}

export function parseRealtorPropertyShowingOut(raw: unknown): RealtorShowing {
	return parseWithSchema(
		realtorPropertyShowingOutSchema,
		raw,
		'Invalid showing response'
	);
}

export function parseRealtorPropertyShowingOutList(
	raw: unknown
): RealtorShowing[] {
	return parseListWithSchema(
		realtorPropertyShowingOutSchema,
		raw,
		'Invalid showing list response'
	);
}

export function parseRealtorProDocumentOut(raw: unknown): RealtorDocument {
	return parseWithSchema(
		realtorProDocumentOutSchema,
		raw,
		'Invalid document response'
	);
}

export function parseRealtorProDocumentOutList(
	raw: unknown
): RealtorDocument[] {
	return parseListWithSchema(
		realtorProDocumentOutSchema,
		raw,
		'Invalid document list response'
	);
}

export function parseRealtorBuyerRequirementOut(
	raw: unknown
): RealtorBuyerRequirement {
	return parseWithSchema(
		realtorBuyerRequirementOutSchema,
		raw,
		'Invalid buyer requirement response'
	);
}

export function parseRealtorBuyerRequirementOutList(
	raw: unknown
): RealtorBuyerRequirement[] {
	return parseListWithSchema(
		realtorBuyerRequirementOutSchema,
		raw,
		'Invalid buyer requirement list response'
	);
}

export function parseRealtorSellerProfileOut(
	raw: unknown
): RealtorSellerProfile {
	return parseWithSchema(
		realtorSellerProfileOutSchema,
		raw,
		'Invalid seller profile response'
	);
}

export function parseRealtorSellerProfileOutList(
	raw: unknown
): RealtorSellerProfile[] {
	return parseListWithSchema(
		realtorSellerProfileOutSchema,
		raw,
		'Invalid seller profile list response'
	);
}

export function parseRealtorDealEventOut(raw: unknown): RealtorDealEvent {
	return parseWithSchema(
		realtorDealEventOutSchema,
		raw,
		'Invalid deal event response'
	);
}

export function parseRealtorDealEventOutList(raw: unknown): RealtorDealEvent[] {
	return parseListWithSchema(
		realtorDealEventOutSchema,
		raw,
		'Invalid deal event list response'
	);
}

export function parseCommunicationLogCreateBody(
	raw: unknown
): z.infer<typeof communicationLogCreateSchema> {
	return parseWithSchema(
		communicationLogCreateSchema,
		raw,
		'Invalid communication log create body'
	);
}

export function parseRealtorLeadCreateBody(
	raw: unknown
): z.infer<typeof realtorLeadCreateSchema> {
	return parseWithSchema(
		realtorLeadCreateSchema,
		raw,
		'Invalid realtor lead create body'
	);
}

export function parseRealtorTaskCreateBody(
	raw: unknown
): z.infer<typeof realtorTaskCreateSchema> {
	return parseWithSchema(
		realtorTaskCreateSchema,
		raw,
		'Invalid realtor task create body'
	);
}

export function parseRealtorTaskUpdateBody(
	raw: unknown
): z.infer<typeof realtorTaskUpdateSchema> {
	return parseWithSchema(
		realtorTaskUpdateSchema,
		raw,
		'Invalid realtor task update body'
	);
}

export function parseRealtorPropertyShowingCreateBody(
	raw: unknown
): z.infer<typeof realtorPropertyShowingCreateSchema> {
	return parseWithSchema(
		realtorPropertyShowingCreateSchema,
		raw,
		'Invalid realtor showing create body'
	);
}

export function parseRealtorPropertyShowingUpdateBody(
	raw: unknown
): z.infer<typeof realtorPropertyShowingUpdateSchema> {
	return parseWithSchema(
		realtorPropertyShowingUpdateSchema,
		raw,
		'Invalid realtor showing update body'
	);
}

export function parseRealtorBuyerRequirementCreateBody(
	raw: unknown
): z.infer<typeof realtorBuyerRequirementCreateSchema> {
	return parseWithSchema(
		realtorBuyerRequirementCreateSchema,
		raw,
		'Invalid buyer requirement create body'
	);
}

export function parseRealtorBuyerRequirementUpdateBody(
	raw: unknown
): z.infer<typeof realtorBuyerRequirementUpdateSchema> {
	return parseWithSchema(
		realtorBuyerRequirementUpdateSchema,
		raw,
		'Invalid buyer requirement update body'
	);
}

export function parseRealtorSellerProfileCreateBody(
	raw: unknown
): z.infer<typeof realtorSellerProfileCreateSchema> {
	return parseWithSchema(
		realtorSellerProfileCreateSchema,
		raw,
		'Invalid seller profile create body'
	);
}

export function parseRealtorSellerProfileUpdateBody(
	raw: unknown
): z.infer<typeof realtorSellerProfileUpdateSchema> {
	return parseWithSchema(
		realtorSellerProfileUpdateSchema,
		raw,
		'Invalid seller profile update body'
	);
}

export function parseDealEventAppendBody(
	raw: unknown
): z.infer<typeof dealEventAppendSchema> {
	return parseWithSchema(
		dealEventAppendSchema,
		raw,
		'Invalid deal event append body'
	);
}

export function parseRealtorProDocumentCreateBody(
	raw: unknown
): z.infer<typeof realtorProDocumentCreateSchema> {
	return parseWithSchema(
		realtorProDocumentCreateSchema,
		raw,
		'Invalid document create body'
	);
}

export function parseRealtorProDocumentUpdateBody(
	raw: unknown
): z.infer<typeof realtorProDocumentUpdateSchema> {
	return parseWithSchema(
		realtorProDocumentUpdateSchema,
		raw,
		'Invalid document update body'
	);
}
