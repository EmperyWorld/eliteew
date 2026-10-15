/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared UI variant types for UGS admin form primitives (badges, buttons).
 *
 * Invariants:
 * - Variant ids stay aligned with `ugsAdminConstants` class maps.
 *
 * Related:
 * - src/features/ugs/shared/ugsAdminUi.tsx
 * - src/features/ugs/shared/ugsAdminConstants.ts
 */

export type UgsAdminBadgeVariant =
	| 'default'
	| 'success'
	| 'info'
	| 'warning'
	| 'secondary';

export type UgsAdminButtonVariant =
	| 'primary'
	| 'secondary'
	| 'ghost'
	| 'danger';
