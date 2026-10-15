import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

/** Meta line under a list item title (compact vs comfortable density). */
export function dashboardListItemMetaClass(compact: boolean): string {
	return compact ? DESKTOP_TYPOGRAPHY.small : DESKTOP_TYPOGRAPHY.caption;
}

/** Summary row above lists (counts + «open section»). */
export const DASHBOARD_WIDGET_TOOLBAR_META_CLASS = DESKTOP_TYPOGRAPHY.meta;

/**
 * List row hover + focus ring — row is a card with embedded controls (select/button inside).
 * Wave 24 / E.53 — единый токен для tasks, alerts.
 */
export const DASHBOARD_LIST_ROW_SHELL_FOCUS_WITHIN =
	'transition-[border-color,box-shadow] hover:border-(--desktop-border-strong)/80 focus-within:border-(--desktop-border-strong) focus-within:ring-2 focus-within:ring-(--mc-accent-60)/35';

/**
 * List row hover + focus — full-row `<button>` / link (keyboard focus on the control itself).
 * Wave 24 / E.53 — campaigns, segments, researches, jtbd, value_props, competitors, imc, funnel.
 */
export const DASHBOARD_LIST_ROW_SHELL_FOCUS_VISIBLE =
	'transition-[border-color,box-shadow] hover:border-(--desktop-border-strong)/80 focus-visible:border-(--desktop-border-strong) focus-visible:ring-2 focus-visible:ring-(--mc-accent-60)/35';
