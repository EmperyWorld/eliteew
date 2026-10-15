/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin survey deadline helpers for datetime-local inputs and API ISO payloads.
 *
 * Invariants:
 * - Empty local value maps to null (clear deadline on save).
 *
 * Related:
 * - SurveysAdminSection.tsx
 */
export function surveyIsoToDatetimeLocalValue(
	iso: string | null | undefined
): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function surveyDatetimeLocalValueToIso(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}
