/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locale-aware formatting for EWRP localStorage slide draft timestamps.
 *
 * Invariants:
 * - Invalid or zero timestamps yield an empty string (no throw).
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` (`EwrpDraftRestoreBanner`), `ewrpDraftDateFormat.test.ts`
 */

import i18n from 'i18next';

/** Locale-aware timestamp for localStorage slide drafts (`savedAt` ms). */
export function formatEwrpLocalDraftSavedAt(savedAtMs: number): string {
	if (!savedAtMs || !Number.isFinite(savedAtMs)) return '';
	try {
		const loc = i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
		return new Date(savedAtMs).toLocaleString(loc, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return '';
	}
}
