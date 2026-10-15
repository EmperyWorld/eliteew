/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Non-UI helpers for Professional Worlds forms and media/idempotency.
 *
 * Invariants:
 * - No React imports; safe for hooks and API layers.
 *
 * Related:
 * - professionalWorldsDesktopUi.tsx (re-exports)
 */

export const PROFESSIONAL_WORLDS_FIELD_CLASS =
	'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none focus:border-(--desktop-border-strong)';

export function toInputValue(
	value: string | number | null | undefined
): string {
	return value == null ? '' : String(value);
}

export function toNullableNumber(value: string): number | null {
	if (!value.trim()) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function createIdempotencyKey(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function albumBelongsToProperty(
	albumPropertyId: string | null | undefined,
	listingId: string
): boolean {
	if (albumPropertyId == null || String(albumPropertyId).trim() === '') {
		return false;
	}
	const a = String(albumPropertyId).replace(/-/g, '').toLowerCase();
	const b = String(listingId).replace(/-/g, '').toLowerCase();
	return a === b && a.length > 0;
}
