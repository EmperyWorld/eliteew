/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock assistant speaker attribution helpers (joint chip overflow, labels).
 *
 * Related:
 * - utils/desktopAiChatExport.ts
 * - components/DesktopAiChatMessagesPane.tsx
 */
import { describe, expect, it } from 'vitest';
import type { DesktopAiMessage } from '../api/desktopChatClient';
import {
	ASSISTANT_SPEAKER_CHIPS_MAX,
	assistantSpeakerChips,
	assistantSpeakerLabel,
} from '../utils/desktopAiChatExport';

function assistantMessage(
	contributors: string[],
	heroId?: string
): DesktopAiMessage {
	return {
		id: 'm1',
		role: 'assistant',
		content: 'body',
		created_at: '2026-08-05T00:00:00Z',
		metadata: {
			desktop_ensemble_contributors: contributors,
			...(heroId ? { desktop_hero_id: heroId } : {}),
		},
	};
}

describe('assistantSpeakerLabel / chips', () => {
	it('joins hero shortLabels for export', () => {
		expect(
			assistantSpeakerLabel(
				assistantMessage([
					'kristian_romanovich',
					'elena_valeryevna',
					'viktor_lvovich',
				])
			)
		).toBe('Кристиан Романович · Елена Валерьевна · Виктор Львович');
	});

	it('caps visible chips and reports overflow', () => {
		const chips = assistantSpeakerChips(
			assistantMessage([
				'kristian_romanovich',
				'elena_valeryevna',
				'viktor_lvovich',
				'max_safin',
			])
		);
		expect(chips.visible).toHaveLength(ASSISTANT_SPEAKER_CHIPS_MAX);
		expect(chips.overflow).toBe(1);
		expect(chips.fullLabel?.includes('Макс')).toBe(true);
		expect(chips.visible.map((p) => p.label)).toEqual([
			'Кристиан Романович',
			'Елена Валерьевна',
			'Виктор Львович',
		]);
	});

	it('returns null fullLabel when no contributors', () => {
		expect(
			assistantSpeakerChips({
				id: 'm2',
				role: 'assistant',
				content: 'x',
				created_at: '2026-08-05T00:00:00Z',
				metadata: {},
			}).fullLabel
		).toBeNull();
	});
});
