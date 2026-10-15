/**
 * Owner promotion checklist labels (spec §3.2, wireframes §12).
 */

import type { PoemmaPromotionChecklist } from '../poemmaDomain';

export type PoemmaPromotionChecklistKey = keyof PoemmaPromotionChecklist;

export const POEMMA_PROMOTION_CHECKLIST_ITEMS: {
	key: PoemmaPromotionChecklistKey;
	label: string;
}[] = [
	{ key: 'siteOk', label: 'Сайт открывается' },
	{ key: 'productionOk', label: 'Производство: сроки' },
	{ key: 'legalOk', label: 'Юридически ок' },
	{ key: 'utmOk', label: 'UTM готов' },
	{ key: 'salesOwnerOk', label: 'Ответственный за заказы' },
];

const POEMMA_PROMOTION_STATUS_LABELS = {
	draft: 'Черновик',
	live: 'Идёт',
	ended: 'Завершена',
} as const;

export function labelPoemmaPromotionStatus(
	status: keyof typeof POEMMA_PROMOTION_STATUS_LABELS
): string {
	return POEMMA_PROMOTION_STATUS_LABELS[status];
}

export function countPoemmaPromotionChecklistDone(
	checklist: PoemmaPromotionChecklist
): number {
	return POEMMA_PROMOTION_CHECKLIST_ITEMS.filter((item) => checklist[item.key])
		.length;
}
