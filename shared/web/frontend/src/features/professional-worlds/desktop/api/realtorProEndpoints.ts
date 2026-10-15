/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro CRM endpoints — leads, showings, tasks, buyer/seller, deal events, and documents.
 *
 * Invariants:
 * - All REST calls go through the canonical EliteEW API helpers.
 * - Out responses use OpenAPI-aligned Zod parsers.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsOpenApi.ts
 * - ../professionalWorldsApiZod.ts
 * - ../types.ts
 */

import type {
	RealtorBuyerRequirementOut,
	RealtorDealEventOut,
	RealtorLeadConvertOut,
	RealtorLeadOut,
	RealtorProDocumentOut,
	RealtorPropertyShowingOut,
	RealtorSellerProfileOut,
	RealtorTaskOut,
} from '../professionalWorldsOpenApi';
import { api } from '@/services/api/client';
import type {
	ProfessionalClient,
	RealtorBuyerRequirement,
	RealtorBuyerRequirementCreate,
	RealtorBuyerRequirementUpdate,
	RealtorDealEvent,
	RealtorDealEventAppend,
	RealtorDocument,
	RealtorDocumentCreate,
	RealtorDocumentUpdate,
	RealtorLead,
	RealtorLeadCreate,
	RealtorSellerProfile,
	RealtorSellerProfileCreate,
	RealtorSellerProfileUpdate,
	RealtorShowing,
	RealtorShowingCreate,
	RealtorShowingUpdate,
	RealtorTask,
	RealtorTaskCreate,
	RealtorTaskUpdate,
} from '../types';
import {
	parseDealEventAppendBody,
	parseRealtorBuyerRequirementCreateBody,
	parseRealtorBuyerRequirementOut,
	parseRealtorBuyerRequirementOutList,
	parseRealtorBuyerRequirementUpdateBody,
	parseRealtorDealEventOut,
	parseRealtorDealEventOutList,
	parseRealtorLeadConvertOut,
	parseRealtorLeadCreateBody,
	parseRealtorLeadOut,
	parseRealtorLeadOutList,
	parseRealtorProDocumentCreateBody,
	parseRealtorProDocumentOut,
	parseRealtorProDocumentOutList,
	parseRealtorProDocumentUpdateBody,
	parseRealtorPropertyShowingCreateBody,
	parseRealtorPropertyShowingOut,
	parseRealtorPropertyShowingOutList,
	parseRealtorPropertyShowingUpdateBody,
	parseRealtorSellerProfileCreateBody,
	parseRealtorSellerProfileOut,
	parseRealtorSellerProfileOutList,
	parseRealtorSellerProfileUpdateBody,
	parseRealtorTaskCreateBody,
	parseRealtorTaskOut,
	parseRealtorTaskOutList,
	parseRealtorTaskUpdateBody,
} from '../professionalWorldsApiZod';
import { getNoCache, PROFESSIONAL_WORLDS_API_BASE } from './httpShared';

export async function listRealtorLeads(): Promise<RealtorLead[]> {
	return parseRealtorLeadOutList(
		await getNoCache<RealtorLeadOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/leads`
		)
	);
}

export async function createRealtorLead(
	payload: RealtorLeadCreate
): Promise<RealtorLead> {
	return parseRealtorLeadOut(
		await api.post<RealtorLeadOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/leads`,
			parseRealtorLeadCreateBody(payload)
		)
	);
}

export async function convertRealtorLeadToClient(leadId: string): Promise<{
	lead: RealtorLead;
	client: ProfessionalClient;
}> {
	return parseRealtorLeadConvertOut(
		await api.post<RealtorLeadConvertOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/leads/${leadId}/convert-to-client`,
			{}
		)
	);
}

export interface RealtorShowingsFilters {
	propertyId?: string | null;
	scheduledFrom?: string | null;
	scheduledTo?: string | null;
}

export function buildRealtorShowingsQuery(
	filters: RealtorShowingsFilters = {}
): string {
	const params = new URLSearchParams();
	if (filters.propertyId) {
		params.set('property_id', filters.propertyId);
	}
	if (filters.scheduledFrom) {
		params.set('scheduled_from', filters.scheduledFrom);
	}
	if (filters.scheduledTo) {
		params.set('scheduled_to', filters.scheduledTo);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

export async function listRealtorShowings(
	filters: RealtorShowingsFilters = {}
): Promise<RealtorShowing[]> {
	const suffix = buildRealtorShowingsQuery(filters);
	return parseRealtorPropertyShowingOutList(
		await getNoCache<RealtorPropertyShowingOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/showings${suffix}`
		)
	);
}

export async function createRealtorShowing(
	payload: RealtorShowingCreate
): Promise<RealtorShowing> {
	return parseRealtorPropertyShowingOut(
		await api.post<RealtorPropertyShowingOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/showings`,
			parseRealtorPropertyShowingCreateBody(payload)
		)
	);
}

export async function getRealtorShowing(
	showingId: string
): Promise<RealtorShowing> {
	return parseRealtorPropertyShowingOut(
		await api.get<RealtorPropertyShowingOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/showings/${showingId}`
		)
	);
}

export async function updateRealtorShowing(
	showingId: string,
	payload: RealtorShowingUpdate
): Promise<RealtorShowing> {
	return parseRealtorPropertyShowingOut(
		await api.patch<RealtorPropertyShowingOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/showings/${showingId}`,
			parseRealtorPropertyShowingUpdateBody(payload)
		)
	);
}

export async function deleteRealtorShowing(showingId: string): Promise<void> {
	await api.delete<void>(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/showings/${showingId}`
	);
}

export interface RealtorTasksFilters {
	status?: string | null;
	propertyId?: string | null;
	dueBefore?: string | null;
	dueAfter?: string | null;
}

export function buildRealtorTasksQuery(
	filters: RealtorTasksFilters = {}
): string {
	const params = new URLSearchParams();
	if (filters.status) {
		params.set('status', filters.status);
	}
	if (filters.propertyId) {
		params.set('property_id', filters.propertyId);
	}
	if (filters.dueBefore) {
		params.set('due_before', filters.dueBefore);
	}
	if (filters.dueAfter) {
		params.set('due_after', filters.dueAfter);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

export async function listRealtorTasks(
	filters: RealtorTasksFilters = {}
): Promise<RealtorTask[]> {
	const suffix = buildRealtorTasksQuery(filters);
	return parseRealtorTaskOutList(
		await getNoCache<RealtorTaskOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/tasks${suffix}`
		)
	);
}

export async function createRealtorTask(
	payload: RealtorTaskCreate
): Promise<RealtorTask> {
	return parseRealtorTaskOut(
		await api.post<RealtorTaskOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/tasks`,
			parseRealtorTaskCreateBody(payload)
		)
	);
}

export async function getRealtorTask(taskId: string): Promise<RealtorTask> {
	return parseRealtorTaskOut(
		await api.get<RealtorTaskOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/tasks/${taskId}`
		)
	);
}

export async function updateRealtorTask(
	taskId: string,
	payload: RealtorTaskUpdate
): Promise<RealtorTask> {
	return parseRealtorTaskOut(
		await api.patch<RealtorTaskOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/tasks/${taskId}`,
			parseRealtorTaskUpdateBody(payload)
		)
	);
}

export async function deleteRealtorTask(taskId: string): Promise<void> {
	await api.delete<void>(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/tasks/${taskId}`
	);
}

export async function listRealtorBuyerRequirements(): Promise<
	RealtorBuyerRequirement[]
> {
	return parseRealtorBuyerRequirementOutList(
		await getNoCache<RealtorBuyerRequirementOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/buyer-requirements`
		)
	);
}

export async function createRealtorBuyerRequirement(
	payload: RealtorBuyerRequirementCreate
): Promise<RealtorBuyerRequirement> {
	return parseRealtorBuyerRequirementOut(
		await api.post<RealtorBuyerRequirementOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/buyer-requirements`,
			parseRealtorBuyerRequirementCreateBody(payload)
		)
	);
}

export async function updateRealtorBuyerRequirement(
	requirementId: string,
	payload: RealtorBuyerRequirementUpdate
): Promise<RealtorBuyerRequirement> {
	return parseRealtorBuyerRequirementOut(
		await api.patch<RealtorBuyerRequirementOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/buyer-requirements/${requirementId}`,
			parseRealtorBuyerRequirementUpdateBody(payload)
		)
	);
}

export async function listRealtorSellerProfiles(): Promise<
	RealtorSellerProfile[]
> {
	return parseRealtorSellerProfileOutList(
		await getNoCache<RealtorSellerProfileOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/seller-profiles`
		)
	);
}

export async function createRealtorSellerProfile(
	payload: RealtorSellerProfileCreate
): Promise<RealtorSellerProfile> {
	return parseRealtorSellerProfileOut(
		await api.post<RealtorSellerProfileOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/seller-profiles`,
			parseRealtorSellerProfileCreateBody(payload)
		)
	);
}

export async function updateRealtorSellerProfile(
	profileId: string,
	payload: RealtorSellerProfileUpdate
): Promise<RealtorSellerProfile> {
	return parseRealtorSellerProfileOut(
		await api.patch<RealtorSellerProfileOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/seller-profiles/${profileId}`,
			parseRealtorSellerProfileUpdateBody(payload)
		)
	);
}

export async function listRealtorDealEvents(
	dealId: string
): Promise<RealtorDealEvent[]> {
	return parseRealtorDealEventOutList(
		await getNoCache<RealtorDealEventOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/deals/${dealId}/events`
		)
	);
}

export async function appendRealtorDealEvent(
	dealId: string,
	payload: RealtorDealEventAppend
): Promise<RealtorDealEvent> {
	return parseRealtorDealEventOut(
		await api.post<RealtorDealEventOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/deals/${dealId}/events`,
			parseDealEventAppendBody(payload)
		)
	);
}

export interface RealtorDocumentFilters {
	dealId?: string | null;
	propertyId?: string | null;
}

export function buildRealtorDocumentQuery(
	filters: RealtorDocumentFilters = {}
): string {
	const params = new URLSearchParams();
	if (filters.dealId) {
		params.set('deal_id', filters.dealId);
	}
	if (filters.propertyId) {
		params.set('property_id', filters.propertyId);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

export async function listRealtorDocuments(
	filters: RealtorDocumentFilters = {}
): Promise<RealtorDocument[]> {
	return parseRealtorProDocumentOutList(
		await getNoCache<RealtorProDocumentOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/documents${buildRealtorDocumentQuery(filters)}`
		)
	);
}

export async function createRealtorDocument(
	payload: RealtorDocumentCreate
): Promise<RealtorDocument> {
	return parseRealtorProDocumentOut(
		await api.post<RealtorProDocumentOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/documents`,
			parseRealtorProDocumentCreateBody(payload)
		)
	);
}

export async function updateRealtorDocument(
	documentId: string,
	payload: RealtorDocumentUpdate
): Promise<RealtorDocument> {
	return parseRealtorProDocumentOut(
		await api.patch<RealtorProDocumentOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/documents/${documentId}`,
			parseRealtorProDocumentUpdateBody(payload)
		)
	);
}
