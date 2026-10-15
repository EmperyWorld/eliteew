import type { MarketingView } from '../constants';

/**
 * A.11 — правила подтверждения при смене проекта (продукт):
 * - Пользовательская смена проекта с overview_dashboard при несохранённом canvas → confirm.
 * - Автовыбор проекта в effects (список projects / компания) и выбор только что созданного проекта → без confirm (см. вызовы `setSelectedProjectId` в `MarketingCabinetPage`).
 */
export function shouldConfirmMarketingCanvasDraftProjectSwitch(params: {
	activeView: MarketingView;
	currentProjectId: string | null;
	nextProjectId: string | null;
	hasDraftForCurrentProject: boolean;
}): boolean {
	if (params.activeView !== 'overview_dashboard') {
		return false;
	}
	if (!params.currentProjectId) {
		return false;
	}
	if (params.nextProjectId === params.currentProjectId) {
		return false;
	}
	return params.hasDraftForCurrentProject;
}
