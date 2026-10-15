/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Home block D — «Каналы» dormant / live promo summary (P-507).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframe-home.md §8
 * - src/features/poemma/promo/poemmaPromoDefaults.ts
 */

import type { PoemmaChannel, PoemmaPromotionAction } from '../poemmaDomain';
import { POEMMA_PROMOTION_CHECKLIST_TOTAL } from '../poemmaDomain';
import { countPoemmaPromotionChecklistDone } from '../promo/poemmaPromoChecklist';
import { labelPoemmaChannel } from '../promo/poemmaPromoDefaults';

export type PoemmaHomePromoMode = 'live' | 'paused' | 'dormant';

export interface PoemmaHomePromoView {
	mode: PoemmaHomePromoMode;
	dormantCount: number;
	livePromotionCount: number;
	headline: string;
	detailLine: string | null;
	note: string;
	showOwnerCta: boolean;
	livePromotionId: string | null;
}

function findPoemmaLivePromotion(
	promotions: PoemmaPromotionAction[]
): PoemmaPromotionAction | null {
	return promotions.find((promotion) => promotion.status === 'live') ?? null;
}

function findPoemmaPausedChannel(
	channels: PoemmaChannel[]
): PoemmaChannel | null {
	return channels.find((channel) => channel.status === 'paused') ?? null;
}

export function buildPoemmaHomePromoView(input: {
	channels: PoemmaChannel[];
	promotions: PoemmaPromotionAction[];
	isOwner: boolean;
}): PoemmaHomePromoView {
	const dormantCount = input.channels.filter(
		(channel) => channel.status === 'dormant'
	).length;
	const livePromotionCount = input.promotions.filter(
		(promotion) => promotion.status === 'live'
	).length;
	const livePromotion = findPoemmaLivePromotion(input.promotions);

	if (livePromotion) {
		const channel =
			input.channels.find((item) => item.id === livePromotion.channelId) ??
			null;
		const channelLabel = channel
			? labelPoemmaChannel(channel)
			: livePromotion.name;
		const checklistDone = countPoemmaPromotionChecklistDone(
			livePromotion.checklist
		);

		return {
			mode: 'live',
			dormantCount,
			livePromotionCount,
			headline: `Идёт: ${channelLabel}`,
			detailLine: `Чеклист ${checklistDone}/${POEMMA_PROMOTION_CHECKLIST_TOTAL}`,
			note: livePromotion.name,
			showOwnerCta: input.isOwner,
			livePromotionId: livePromotion.id,
		};
	}

	const pausedChannel = findPoemmaPausedChannel(input.channels);
	if (pausedChannel) {
		return {
			mode: 'paused',
			dormantCount,
			livePromotionCount,
			headline: `Пауза: ${labelPoemmaChannel(pausedChannel)}`,
			detailLine: null,
			note: pausedChannel.lastActivityNote ?? 'Нет бюджета на рекламу',
			showOwnerCta: input.isOwner,
			livePromotionId: null,
		};
	}

	return {
		mode: 'dormant',
		dormantCount,
		livePromotionCount,
		headline: `Спят: ${dormantCount}`,
		detailLine: `Акция: ${livePromotionCount}`,
		note: 'Нет бюджета на рекламу',
		showOwnerCta: input.isOwner,
		livePromotionId: null,
	};
}
