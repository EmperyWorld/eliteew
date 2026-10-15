/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor property CRUD, media attach, and cross-app draft creation for Professional Worlds desktop API.
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
	RealtorPropertyMediaOut,
	RealtorPropertyOut,
} from '../professionalWorldsOpenApi';
import { api } from '@/services/api/client';
import type {
	ProfessionalArtifact,
	RealtorProperty,
	RealtorPropertyCreate,
	RealtorPropertyMedia,
	RealtorPropertyMediaCreate,
	RealtorPropertyUpdate,
} from '../types';
import {
	parseProfessionalArtifactOut,
	parseRealtorPropertyCreateBody,
	parseRealtorPropertyDraftPayloadBody,
	parseRealtorPropertyMediaCreateBody,
	parseRealtorPropertyMediaOut,
	parseRealtorPropertyOut,
	parseRealtorPropertyUpdateBody,
} from '../professionalWorldsApiZod';
import { PROFESSIONAL_WORLDS_API_BASE } from './httpShared';

export async function createRealtorProperty(
	payload: RealtorPropertyCreate
): Promise<RealtorProperty> {
	return parseRealtorPropertyOut(
		await api.post<RealtorPropertyOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties`,
			parseRealtorPropertyCreateBody(payload)
		)
	);
}

export async function updateRealtorProperty(
	propertyId: string,
	payload: RealtorPropertyUpdate
): Promise<RealtorProperty> {
	return parseRealtorPropertyOut(
		await api.patch<RealtorPropertyOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}`,
			parseRealtorPropertyUpdateBody(payload)
		)
	);
}

export async function attachRealtorPropertyMedia(
	propertyId: string,
	payload: RealtorPropertyMediaCreate
): Promise<RealtorPropertyMedia> {
	return parseRealtorPropertyMediaOut(
		await api.post<RealtorPropertyMediaOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media`,
			parseRealtorPropertyMediaCreateBody(payload)
		)
	);
}

export async function deleteRealtorProperty(propertyId: string): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${encodeURIComponent(propertyId)}`
	);
}

export async function createPropertyDraft(
	propertyId: string,
	draftKind: 'ewrp' | 'site-studio' | 'gaf-chat' | 'ewdesk',
	payload: Record<string, unknown> = {}
): Promise<ProfessionalArtifact> {
	return parseProfessionalArtifactOut(
		await api.post<ProfessionalArtifactOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/drafts/${draftKind}`,
			parseRealtorPropertyDraftPayloadBody(payload)
		)
	);
}
