/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared locale-aware datetime formatting for UGS Hub and related UI.
 *
 * Invariants:
 * - Empty input returns em dash placeholder.
 * - Invalid ISO falls back to raw string.
 *
 * Related:
 * - components/UGS/hub/UgsHubTaskList.tsx
 * - utils/parseServerUtcIso.ts
 */

/** Format API ISO datetime for display (locale-aware, 24h). */
export function formatDateTime(
	value?: string | null,
	locale: string = 'ru-RU'
): string {
	if (!value) {
		return '—';
	}
	try {
		return new Date(value).toLocaleString(locale, {
			hour12: false,
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return value;
	}
}
