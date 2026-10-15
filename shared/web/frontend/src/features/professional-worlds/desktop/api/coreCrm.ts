/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Core CRM endpoints — profile, clients, deals, artifacts, and learning — for Professional Worlds desktop API.
 *
 * Invariants:
 * - All REST calls go through the canonical EliteEW API helpers.
 * - Out responses use OpenAPI-aligned Zod parsers.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsApiZod.ts
 * - ../types.ts
 */

import type {
	ProfessionalArtifactOut,
	ProfessionalClientOut,
	ProfessionalDealOut,
	ProfessionalDealPropertyLinkBackfillOut,
	SpecialistProfileOut,
} from '../professionalWorldsOpenApi';
import { api } from '@/services/api/client';
import type {
	ProfessionalArtifact,
	ProfessionalClient,
	ProfessionalClientCreate,
	ProfessionalDeal,
	ProfessionalDealCreate,
	ProfessionalDealUpdate,
	SpecialistProfile,
	SpecialistProfileUpsert,
} from '../types';
import {
	parseProfessionalArtifactOutList,
	parseProfessionalClientCreateBody,
	parseProfessionalClientOut,
	parseProfessionalDealCreateBody,
	parseProfessionalDealOut,
	parseProfessionalDealPropertyLinkBackfillOut,
	parseProfessionalDealUpdateBody,
	parseSpecialistProfileOut,
	parseSpecialistProfileUpsertBody,
} from '../professionalWorldsApiZod';
import { getNoCache, PROFESSIONAL_WORLDS_API_BASE } from './httpShared';

export interface ProfessionalArtifactFilters {
	verticalSlug?: string | null;
	propertyId?: string | null;
	moduleKey?: string | null;
	artifactKind?: string | null;
}

export function buildProfessionalArtifactQuery(
	filters: ProfessionalArtifactFilters = {}
): string {
	const params = new URLSearchParams();
	if (filters.verticalSlug) {
		params.set('vertical_slug', filters.verticalSlug);
	}
	if (filters.propertyId) {
		params.set('property_id', filters.propertyId);
	}
	if (filters.moduleKey) {
		params.set('module_key', filters.moduleKey);
	}
	if (filters.artifactKind) {
		params.set('artifact_kind', filters.artifactKind);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

export async function saveSpecialistProfile(
	payload: SpecialistProfileUpsert
): Promise<SpecialistProfile> {
	return parseSpecialistProfileOut(
		await api.put<SpecialistProfileOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/me/profile`,
			parseSpecialistProfileUpsertBody(payload)
		)
	);
}

export async function createProfessionalClient(
	payload: ProfessionalClientCreate
): Promise<ProfessionalClient> {
	return parseProfessionalClientOut(
		await api.post<ProfessionalClientOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/clients`,
			parseProfessionalClientCreateBody(payload)
		)
	);
}

export async function createProfessionalDeal(
	payload: ProfessionalDealCreate
): Promise<ProfessionalDeal> {
	return parseProfessionalDealOut(
		await api.post<ProfessionalDealOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/deals`,
			parseProfessionalDealCreateBody(payload)
		)
	);
}

export async function updateProfessionalDeal(
	dealId: string,
	payload: ProfessionalDealUpdate
): Promise<ProfessionalDeal> {
	return parseProfessionalDealOut(
		await api.patch<ProfessionalDealOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/deals/${dealId}`,
			parseProfessionalDealUpdateBody(payload)
		)
	);
}

export async function deleteProfessionalClient(
	clientId: string
): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_API_BASE}/clients/${encodeURIComponent(clientId)}`
	);
}

export async function deleteProfessionalDeal(dealId: string): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_API_BASE}/deals/${encodeURIComponent(dealId)}`
	);
}

export async function deleteProfessionalArtifact(
	artifactId: string
): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_API_BASE}/artifacts/${encodeURIComponent(artifactId)}`
	);
}

export async function backfillProfessionalDealPropertyLinks(
	verticalSlug: string
): Promise<ProfessionalDealPropertyLinkBackfillOut> {
	return parseProfessionalDealPropertyLinkBackfillOut(
		await api.post<ProfessionalDealPropertyLinkBackfillOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/deals/backfill-property-links?vertical_slug=${encodeURIComponent(verticalSlug)}`,
			{}
		)
	);
}

export async function completeLearningLesson(lessonId: string): Promise<void> {
	await api.post<void>(
		`${PROFESSIONAL_WORLDS_API_BASE}/learning/lessons/${lessonId}/complete`,
		{}
	);
}

export async function listProfessionalArtifacts(
	filters: ProfessionalArtifactFilters = {}
): Promise<ProfessionalArtifact[]> {
	return parseProfessionalArtifactOutList(
		await getNoCache<ProfessionalArtifactOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/artifacts${buildProfessionalArtifactQuery(filters)}`
		)
	);
}
