/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize EWRP job status payloads from axios responses (flat or nested `data`).
 *
 * Invariants:
 * - Returns null when `status` is missing or not a string.
 *
 * Related:
 * - `ewrpApi.ts`, `EWRPGeneratorMain.tsx`, `EwrpSlideEditorPanel.tsx`
 */

import type { EwrpStatusResponse } from '@/services/ewrpApi';

export function parseEwrpStatusResponse(
	res: unknown
): EwrpStatusResponse | null {
	const wrap = res as {
		data?: EwrpStatusResponse | { data?: EwrpStatusResponse };
	};
	const raw = wrap?.data;
	const data: EwrpStatusResponse | undefined =
		raw && typeof raw === 'object' && 'status' in raw
			? (raw as EwrpStatusResponse)
			: (raw as { data?: EwrpStatusResponse })?.data;
	if (!data || typeof data.status !== 'string') return null;
	return data;
}
