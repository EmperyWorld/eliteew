/**
 * Default CHANNEL rows for owner promo map (wireframes §11).
 */

import type { PoemmaChannel, PoemmaOrgId } from '../poemmaDomain';

function createPoemmaChannelId(): string {
	return `channel-${globalThis.crypto.randomUUID()}`;
}

export function buildDefaultPoemmaChannels(
	orgId: PoemmaOrgId
): PoemmaChannel[] {
	return [
		{
			id: createPoemmaChannelId(),
			orgId,
			type: 'yandex',
			status: 'dormant',
		},
		{
			id: createPoemmaChannelId(),
			orgId,
			type: 'vk',
			status: 'dormant',
		},
		{
			id: createPoemmaChannelId(),
			orgId,
			type: 'marketplace',
			status: 'active',
			lastActivityNote: 'нет прибыли',
		},
		{
			id: createPoemmaChannelId(),
			orgId,
			type: 'site',
			status: 'dormant',
		},
		{
			id: createPoemmaChannelId(),
			orgId,
			type: 'partner',
			status: 'dormant',
		},
	];
}

const POEMMA_CHANNEL_LABELS: Record<PoemmaChannel['type'], string> = {
	yandex: 'Яндекс',
	vk: 'VK',
	marketplace: 'Маркетплейс',
	site: 'Сайт',
	partner: 'Сети / B2B',
};

export function labelPoemmaChannel(channel: PoemmaChannel): string {
	return POEMMA_CHANNEL_LABELS[channel.type];
}

const POEMMA_CHANNEL_STATUS_LABELS: Record<PoemmaChannel['status'], string> = {
	dormant: 'Спят',
	active: 'Идёт',
	paused: 'Пауза',
};

export function labelPoemmaChannelStatus(channel: PoemmaChannel): string {
	if (channel.type === 'partner' && channel.status === 'dormant') {
		return 'Партнёр';
	}
	return POEMMA_CHANNEL_STATUS_LABELS[channel.status];
}

export function createPoemmaPromotionId(): string {
	return `promo-${globalThis.crypto.randomUUID()}`;
}

export function createPoemmaUtmLinkId(): string {
	return `utm-${globalThis.crypto.randomUUID()}`;
}
