/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P11 — structured desktop performance recommendation codes + locale render.
 * Hook emits codes/vars; views translate via desktopUi.
 *
 * Invariants:
 * - No hardcoded user-facing language in the optimizer.
 * - Unknown codes fall back to the raw code string (no silent empty).
 *
 * Related:
 * - hooks/usePerformanceOptimizer.ts
 * - components/DesktopFloatingPerformanceStrip.tsx
 * - components/settings/DesktopSettingsPerformanceTab.tsx
 */

import type { TFunction } from 'i18next';

export type DesktopPerformanceRecommendationCode =
	| 'high_memory'
	| 'low_fps'
	| 'high_render_time'
	| 'auto_quiet_windows'
	| 'many_windows'
	| 'suspended_adapters'
	| 'high_bg_invalidations'
	| 'long_task';

export type DesktopPerformanceRecommendation = {
	code: DesktopPerformanceRecommendationCode;
	values?: Record<string, string | number>;
};

export function translateDesktopPerformanceRecommendation(
	t: TFunction<'desktopUi'>,
	item: DesktopPerformanceRecommendation
): string {
	return t(`performance.recommendation.${item.code}`, {
		...(item.values ?? {}),
		defaultValue: item.code,
	});
}

export function desktopPerformanceRecommendationKey(
	item: DesktopPerformanceRecommendation
): string {
	if (!item.values) return item.code;
	return `${item.code}:${JSON.stringify(item.values)}`;
}
