/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hub-specific constants (status filter options, pagination size).
 *
 * Invariants:
 * - Visual tokens live in `ugsHubSharedUi.tsx`; this file holds data constants only.
 *
 * Related:
 * - UgsHubFiltersSection.tsx, UgsHubTabPanels.tsx
 */

export const UGS_HUB_STATUS_FILTER_VALUES = [
	'all',
	'queued',
	'pending',
	'processing',
	'retrying',
	'completed',
	'failed',
	'cancelled',
] as const;

export type UgsHubStatusFilterValue =
	(typeof UGS_HUB_STATUS_FILTER_VALUES)[number];

/** @deprecated Prefer `UGS_HUB_STATUS_FILTER_VALUES` + `ugsHub` i18n `statusFilter.*`. */
export const UGS_HUB_STATUS_FILTER_OPTIONS = UGS_HUB_STATUS_FILTER_VALUES.map(
	(value) => ({ value, label: value })
);

export const UGS_HUB_ITEMS_PER_PAGE = 20;
