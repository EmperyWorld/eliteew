/**
 * Layout query key (`mc-dashboard-layout`): виджеты и позиции в `OverviewInteractiveDashboard`.
 * Бандл данных для тел плиток — отдельный ключ `project-dashboard` в `MarketingCabinetPage` (K.106).
 */
export const DASHBOARD_LAYOUT_QUERY_KEY = 'mc-dashboard-layout' as const;
export const DASHBOARD_PRESETS_QUERY_KEY = 'mc-dashboard-presets' as const;
export const DASHBOARD_LAYOUT_TEMPLATES_QUERY_KEY =
	'mc-dashboard-layout-templates' as const;
export const RGL_COLS = 12;
export const RGL_ROW_HEIGHT = 28;
export const LAYOUT_SAVE_DEBOUNCE_MS = 500;
export const DASHBOARD_LAYOUT_EXPORT_SCHEMA_VERSION = 1;
/** v2: default collapsed (v1 defaulted expanded via `!== '0'`). */
export const MC_DASHBOARD_TOOLBAR_EXPANDED_STORAGE =
	'marketing-cabinet:dashboard-toolbar-expanded:v2' as const;

/** Persist preference: only `'1'` means expanded; missing / other → collapsed. */
export function readDashboardToolbarExpandedPreference(
	getItem: (key: string) => string | null
): boolean {
	try {
		return getItem(MC_DASHBOARD_TOOLBAR_EXPANDED_STORAGE) === '1';
	} catch {
		return false;
	}
}
