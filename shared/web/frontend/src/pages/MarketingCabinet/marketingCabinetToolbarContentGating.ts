/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gating for toolbar `listProjectContent` (shared MarketingContentSource).
 *
 * Invariants:
 * - Default load only on views that use the document picker in toolbar or section body.
 * - Hover/focus on document fieldset or opening the select enables fetch on any working tab.
 *
 * Related:
 * - hooks/useMarketingCabinetProjectEntityQueries.ts
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import type { MarketingView } from './constants';

/** Вкладки, где список документов в тулбаре нужен без явного engage. */
export const MARKETING_TOOLBAR_CONTENT_AUTO_LOAD_VIEWS = [
	'evidence',
	'overview',
	'overview_dashboard',
	'ai_studio',
	'imc',
] as const satisfies readonly MarketingView[];

export function marketingCabinetShouldLoadToolbarProjectContent(
	activeView: MarketingView,
	hasProject: boolean,
	toolbarContentEngaged: boolean
): boolean {
	if (!hasProject) return false;
	if (toolbarContentEngaged) return true;
	return (
		MARKETING_TOOLBAR_CONTENT_AUTO_LOAD_VIEWS as readonly string[]
	).includes(activeView);
}
