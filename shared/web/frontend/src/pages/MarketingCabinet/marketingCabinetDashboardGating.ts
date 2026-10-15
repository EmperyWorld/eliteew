/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gating for the marketing-cabinet project-dashboard TanStack Query bundle (avoid overfetch on setup views).
 *
 * Invariants:
 * - Dashboard bundle loads only on overview views; rail badges use cache (gcTime) or AI/IMC poll elsewhere.
 * - AI/IMC rail poll is off on MARKETING_DASHBOARD_BUNDLE_SKIP_VIEWS (setup + low-traffic tabs).
 *
 * Related:
 * - hooks/useMarketingCabinetDashboardBundle.ts
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import type { MarketingView } from './constants';

/** Единственные вкладки, где нужен живой агрегат `project-dashboard`. */
export const MARKETING_DASHBOARD_BUNDLE_LOAD_VIEWS = [
	'overview',
	'overview_dashboard',
] as const satisfies readonly MarketingView[];

/**
 * Вкладки без poll AI/IMC rail (и без fetch dashboard — см. allow-list).
 * Rail — из кэша дашборда после обзора или из entity hooks на рабочих разделах.
 */
export const MARKETING_DASHBOARD_BUNDLE_SKIP_VIEWS = [
	'companies',
	'projects',
	'team',
	'chat',
	'project_rag',
	'client_interaction',
	'amka',
	'imc',
	'ai_studio',
] as const satisfies readonly MarketingView[];

export function marketingCabinetShouldLoadProjectDashboard(
	selectedProjectId: string | null | undefined,
	activeView: MarketingView
): boolean {
	if (!selectedProjectId) return false;
	return (MARKETING_DASHBOARD_BUNDLE_LOAD_VIEWS as readonly string[]).includes(
		activeView
	);
}

/** Poll активных AI/IMC runs (rail + общий cache с Job Center на рабочих вкладках). */
export function marketingCabinetShouldPollActiveAiRuns(
	selectedProjectId: string | null | undefined,
	activeView: MarketingView
): boolean {
	if (!selectedProjectId) return false;
	return !(MARKETING_DASHBOARD_BUNDLE_SKIP_VIEWS as readonly string[]).includes(
		activeView
	);
}
