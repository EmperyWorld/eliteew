/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared layout helpers and badge classifiers for UGS Admin v2 tabs.
 *
 * Related:
 * - features/ugs/shared/ugsDesktopUi.ts
 */

import {
	UGS_ACTIVE_STATE_BADGE,
	ugsAdminOverviewCardClass,
	UGS_DESKTOP_FORM,
	UGS_DESKTOP_SURFACE,
	UGS_DESKTOP_TABLE,
} from '@/features/ugs/shared/ugsDesktopUi';
import { cn } from '@/utils/cn';

export const ugsAdminV2SectionClass = ugsAdminOverviewCardClass;

export const ugsAdminV2TableWrapClass = cn(
	UGS_DESKTOP_SURFACE.soft,
	'overflow-hidden'
);

export const ugsAdminV2SearchInputClass = UGS_DESKTOP_FORM.input;

export const ugsAdminV2SearchLabelClass = cn(
	'text-xs font-semibold uppercase tracking-[0.2em]',
	UGS_DESKTOP_FORM.hint
);

export const ugsAdminV2TableHeadClass = UGS_DESKTOP_TABLE.head;

export const ugsAdminV2TableRowClass = cn(
	UGS_DESKTOP_TABLE.row,
	'cursor-pointer hover:bg-(--desktop-surface-soft-hover)/50'
);

export const ugsAdminV2TableFooterClass = UGS_DESKTOP_TABLE.footer;

export function ugsAdminActiveStateBadgeClass(active: boolean): string {
	return active
		? UGS_ACTIVE_STATE_BADGE.active
		: UGS_ACTIVE_STATE_BADGE.inactive;
}
