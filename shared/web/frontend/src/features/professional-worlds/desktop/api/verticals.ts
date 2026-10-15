/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vertical activation, onboarding, and quota endpoints for Professional Worlds desktop API.
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
	ProfessionalUserVerticalActivationOut,
	RealtorQuotaSummaryOut,
} from '../professionalWorldsOpenApi';
import { api } from '@/services/api/client';
import type {
	ProfessionalUserVerticalActivation,
	RealtorQuotaSummary,
} from '../types';
import {
	parseProfessionalUserVerticalActivationOut,
	parseProfessionalUserVerticalActivationOutList,
	parseProfessionalVerticalActivationUpsertBody,
	parseProfessionalVerticalOnboardingPatchBody,
	parseRealtorQuotaSummaryOut,
} from '../professionalWorldsApiZod';
import { getNoCache, PROFESSIONAL_WORLDS_API_BASE } from './httpShared';

export async function listProfessionalVerticalActivations(): Promise<
	ProfessionalUserVerticalActivation[]
> {
	return parseProfessionalUserVerticalActivationOutList(
		await getNoCache<ProfessionalUserVerticalActivationOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/me/vertical-activations`
		)
	);
}

export async function activateProfessionalVertical(
	verticalSlug: string,
	isActive = true
): Promise<ProfessionalUserVerticalActivation> {
	return parseProfessionalUserVerticalActivationOut(
		await api.post<ProfessionalUserVerticalActivationOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/me/vertical-activations/${verticalSlug}`,
			parseProfessionalVerticalActivationUpsertBody({ is_active: isActive })
		)
	);
}

export async function loadRealtorQuotaSummary(): Promise<RealtorQuotaSummary> {
	return parseRealtorQuotaSummaryOut(
		await getNoCache<RealtorQuotaSummaryOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/quota-summary`
		)
	);
}

export async function patchProfessionalVerticalOnboarding(
	verticalSlug: string,
	onboarding: Record<string, unknown>
): Promise<ProfessionalUserVerticalActivation> {
	return parseProfessionalUserVerticalActivationOut(
		await api.patch<ProfessionalUserVerticalActivationOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/me/vertical-activations/${verticalSlug}/onboarding`,
			parseProfessionalVerticalOnboardingPatchBody({ onboarding })
		)
	);
}
