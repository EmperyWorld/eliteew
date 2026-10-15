/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Small date/format helpers for EWDesk admin news forms.
 *
 * Invariants:
 * - isoToDatetimeLocal returns empty string for invalid/missing ISO input.
 *
 * Related:
 * - EwDeskAdminEditNewsForm.tsx
 * - documentation/product/desktop/EWDESK-NEWS.md
 */

export function isoToDatetimeLocal(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
