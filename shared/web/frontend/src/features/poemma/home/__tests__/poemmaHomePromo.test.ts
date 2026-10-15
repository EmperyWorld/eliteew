import { describe, expect, it } from 'vitest';
import type { PoemmaChannel, PoemmaPromotionAction } from '../../poemmaDomain';
import { POEMMA_EMPTY_PROMOTION_CHECKLIST } from '../../poemmaDomain';
import { buildPoemmaHomePromoView } from '../poemmaHomePromo';

const baseChannels: PoemmaChannel[] = [
	{ id: 'c1', orgId: 'org', type: 'yandex', status: 'dormant' },
	{ id: 'c2', orgId: 'org', type: 'vk', status: 'dormant' },
	{ id: 'c3', orgId: 'org', type: 'site', status: 'dormant' },
];

describe('poemmaHomePromo', () => {
	it('summarizes dormant channels when nothing is live', () => {
		const view = buildPoemmaHomePromoView({
			channels: baseChannels,
			promotions: [],
			isOwner: true,
		});

		expect(view.mode).toBe('dormant');
		expect(view.headline).toBe('Спят: 3');
		expect(view.detailLine).toBe('Акция: 0');
		expect(view.note).toBe('Нет бюджета на рекламу');
		expect(view.showOwnerCta).toBe(true);
	});

	it('shows live promotion with checklist progress', () => {
		const promotions: PoemmaPromotionAction[] = [
			{
				id: 'promo-1',
				periodId: 'p1',
				channelId: 'c2',
				name: 'Летняя акция',
				status: 'live',
				checklist: {
					...POEMMA_EMPTY_PROMOTION_CHECKLIST,
					siteOk: true,
					utmOk: true,
				},
			},
		];

		const view = buildPoemmaHomePromoView({
			channels: baseChannels,
			promotions,
			isOwner: true,
		});

		expect(view.mode).toBe('live');
		expect(view.headline).toBe('Идёт: VK');
		expect(view.detailLine).toBe('Чеклист 2/5');
		expect(view.livePromotionId).toBe('promo-1');
	});

	it('shows paused channel when no live promotion exists', () => {
		const view = buildPoemmaHomePromoView({
			channels: [
				...baseChannels,
				{
					id: 'c4',
					orgId: 'org',
					type: 'yandex',
					status: 'paused',
					lastActivityNote: 'Ждём бюджет',
				},
			],
			promotions: [],
			isOwner: false,
		});

		expect(view.mode).toBe('paused');
		expect(view.headline).toBe('Пауза: Яндекс');
		expect(view.showOwnerCta).toBe(false);
	});
});
