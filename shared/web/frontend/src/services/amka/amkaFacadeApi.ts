/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for `/api/v1/ewa/*` facade routes outside Marketing Cabinet (UGS core-alignment reads).
 *
 * Invariants:
 * - Uses the same bearer session as the rest of the app; UGS alignment endpoints require `require_ugs_admin_user`.
 * - Response shape matches `AmkaCoreAlignmentOut` / frontend `AmkaCoreAlignmentResponse`.
 *
 * Related:
 * - shared/api/ewa_platform/gateways/routers/standalone_facade.py
 * - src/services/ewa/ewaDesktopOrchApi.ts
 * - Operator UI for UGS alignment belongs outside Marketing Cabinet AMKA (e.g. Unified Admin).
 */
import type { AmkaCoreAlignmentResponse } from '@/features/amka/amkaTypes';
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient } from '@/services/api/client';

export type AmkaUgsAlignmentProfile = 'model_routing' | 'generation_inventory';

export function amkaUgsCoreAlignmentPath(
	profile: AmkaUgsAlignmentProfile
): string {
	return profile === 'model_routing'
		? '/ewa/ugs/model-routing/core-alignment'
		: '/ewa/ugs/generation-inventory/core-alignment';
}

export async function fetchAmkaUgsCoreAlignment(
	profile: AmkaUgsAlignmentProfile
): Promise<AmkaCoreAlignmentResponse> {
	const res = await apiClient.get<AmkaCoreAlignmentResponse>(
		amkaUgsCoreAlignmentPath(profile),
		API_OPTIONS
	);
	return res.data;
}
