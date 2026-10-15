/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cross-app draft link list, refresh, and lifecycle report endpoints for Professional Worlds desktop API.
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

import type { ProfessionalCrossAppDraftLinkOut } from '../professionalWorldsOpenApi';
import { api } from '@/services/api/client';
import type { ProfessionalCrossAppDraftLink } from '../types';
import {
	parseProfessionalCrossAppDraftLinkOut,
	parseProfessionalCrossAppDraftLinkOutList,
} from '../professionalWorldsApiZod';
import { getNoCache, PROFESSIONAL_WORLDS_API_BASE } from './httpShared';

export async function listProfessionalCrossAppDraftLinks(options?: {
	artifact_id?: string;
	stale_check_property_id?: string;
}): Promise<ProfessionalCrossAppDraftLink[]> {
	const params = new URLSearchParams();
	if (options?.artifact_id?.trim())
		params.set('artifact_id', options.artifact_id.trim());
	if (options?.stale_check_property_id?.trim()) {
		params.set(
			'stale_check_property_id',
			options.stale_check_property_id.trim()
		);
	}
	const q = params.toString();
	return parseProfessionalCrossAppDraftLinkOutList(
		await getNoCache<ProfessionalCrossAppDraftLinkOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/cross-app/drafts${q ? `?${q}` : ''}`
		)
	);
}

export async function refreshProfessionalCrossAppDraft(
	linkId: string
): Promise<ProfessionalCrossAppDraftLink> {
	return parseProfessionalCrossAppDraftLinkOut(
		await api.post<ProfessionalCrossAppDraftLinkOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/cross-app/drafts/${encodeURIComponent(linkId)}/refresh`,
			{}
		)
	);
}

export async function reportProfessionalCrossAppDraft(
	linkId: string,
	payload: {
		lifecycle_state: string;
		remote_tracking?: Record<string, string>;
	}
): Promise<ProfessionalCrossAppDraftLink> {
	return parseProfessionalCrossAppDraftLinkOut(
		await api.post<ProfessionalCrossAppDraftLinkOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/cross-app/drafts/${encodeURIComponent(linkId)}/report`,
			payload
		)
	);
}
