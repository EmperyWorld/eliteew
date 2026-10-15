/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gating for marketing-cabinet foundation TanStack queries (companies/projects lists).
 *
 * Invariants:
 * - Companies list is required for toolbar auto-select and setup sections.
 * - Projects list is skipped on the companies-only setup tab (no project picker there).
 * - Stub GET by id supplies toolbar labels when full list fetch is deferred.
 *
 * Related:
 * - hooks/useMarketingCabinetFoundationQueries.ts
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import type { MarketingView } from './constants';

/** Вкладка «Компании» — список проектов компании не нужен до перехода в «Проекты» или рабочий раздел. */
export const MARKETING_FOUNDATION_PROJECTS_SKIP_VIEWS = [
	'companies',
] as const satisfies readonly MarketingView[];

/** Setup-вкладки: список компаний нужен сразу (секции и формы). */
export const MARKETING_FOUNDATION_COMPANIES_SETUP_VIEWS = [
	'companies',
	'projects',
	'team',
] as const satisfies readonly MarketingView[];

export function marketingCabinetShouldFetchCompaniesList(
	activeView: MarketingView,
	selectedCompanyId: string | null | undefined,
	contextEngaged: boolean
): boolean {
	if (contextEngaged) return true;
	if (
		(MARKETING_FOUNDATION_COMPANIES_SETUP_VIEWS as readonly string[]).includes(
			activeView
		)
	) {
		return true;
	}
	// Первый визит без mc_company в URL — нужен auto-select первой компании.
	if (!selectedCompanyId) return true;
	return false;
}

export function marketingCabinetShouldFetchProjectsList(
	selectedCompanyId: string | null | undefined,
	activeView: MarketingView
): boolean {
	if (!selectedCompanyId) return false;
	return !(
		MARKETING_FOUNDATION_PROJECTS_SKIP_VIEWS as readonly string[]
	).includes(activeView);
}

/** Подпись в тулбаре: одна компания по id, когда полный `listCompanies` отложен. */
export function marketingCabinetShouldFetchFoundationCompanyStub(
	selectedCompanyId: string | null | undefined,
	fetchCompaniesList: boolean
): boolean {
	return Boolean(selectedCompanyId) && !fetchCompaniesList;
}

/** Подпись в тулбаре: один проект по id, когда полный `listProjects` отложен (вкладка «Компании»). */
export function marketingCabinetShouldFetchFoundationProjectStub(
	selectedProjectId: string | null | undefined,
	fetchProjectsList: boolean
): boolean {
	return Boolean(selectedProjectId) && !fetchProjectsList;
}
