/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map app UI language to Postgres `system_gaf_instruction.locale` row key.
 *
 * Invariants:
 * - Only `ru` and `en` are supported by the API today.
 *
 * Related:
 * - `pages/Admin/SystemGafInstructionSection.tsx`
 * - `api/routers/system_gaf_admin.py`
 */

export type GafInstructionLocale = 'ru' | 'en';

/** Resolves template row locale from i18next language tag. */
export function resolveGafInstructionLocale(
	language: string | undefined
): GafInstructionLocale {
	return language?.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export function parseGafInstructionLocaleFromJson(
	value: unknown
): GafInstructionLocale | null {
	if (typeof value !== 'string') {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === 'ru' || normalized === 'en') {
		return normalized;
	}
	return null;
}
