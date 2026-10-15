import type { ClientInteractionLayout } from './clientInteractionTypes';

export type ClientInteractionMarketingTab =
	| 'summary'
	| 'diagnostic'
	| 'documents'
	| 'presentations'
	| 'chat';

export type ClientInteractionTabVisibilityInput = {
	variant: 'default' | 'embedded';
	layout: ClientInteractionLayout;
	isLead: boolean;
};

/**
 * Вкладки верхнего уровня для маркетингового кабинета (полный экран).
 * Для embedded / не-full режимов возвращает пустой список — таббар не показывается.
 */
export function getVisibleMarketingClientInteractionTabs(
	input: ClientInteractionTabVisibilityInput
): ClientInteractionMarketingTab[] {
	if (input.variant === 'embedded' || input.layout !== 'full') {
		return [];
	}
	const tail: ClientInteractionMarketingTab[] = [
		'documents',
		'presentations',
		'chat',
	];
	if (input.isLead) {
		return ['summary', 'diagnostic', ...tail];
	}
	/* Представитель заказчика и прочие участники: сводка только для чтения (как в кабинете заказчика). */
	return ['summary', ...tail];
}

export function normalizeMarketingClientInteractionTab(
	visible: ClientInteractionMarketingTab[],
	current: ClientInteractionMarketingTab
): ClientInteractionMarketingTab {
	if (visible.length === 0) return current;
	if (visible.includes(current)) return current;
	const first = visible[0];
	return first === undefined ? current : first;
}
