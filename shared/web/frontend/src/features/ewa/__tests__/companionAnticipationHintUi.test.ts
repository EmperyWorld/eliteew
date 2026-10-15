/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for observation anticipation `suggested_action` coercion and chip expansion.
 *
 * Related:
 * - src/features/ewa/companionAnticipationHintUi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	anticipationSuggestedActionChips,
	coerceCompanionAnticipationSuggestedAction,
	normalizeAnticipationEpisodeLine,
} from '@/features/ewa/companionAnticipationHintUi';

describe('companionAnticipationHintUi', () => {
	describe('normalizeAnticipationEpisodeLine', () => {
		it('strips HCM tags', () => {
			expect(
				normalizeAnticipationEpisodeLine(
					'[episode/turn_user] Мы вместе писали манифест.'
				)
			).toBe('Мы вместе писали манифест.');
		});

		it('drops observation telemetry tails', () => {
			expect(
				normalizeAnticipationEpisodeLine('observation:idle app=EwaApp title=x')
			).toBeNull();
		});
	});

	describe('coerceCompanionAnticipationSuggestedAction', () => {
		it('accepts suggest_chat_prompt with prompt_text', () => {
			expect(
				coerceCompanionAnticipationSuggestedAction({
					type: 'suggest_chat_prompt',
					prompt_text: 'Отметь выполненным: зарядка',
				})
			).toEqual({
				type: 'suggest_chat_prompt',
				prompt_text: 'Отметь выполненным: зарядка',
			});
		});

		it('accepts proactive_review quick_replies', () => {
			expect(
				coerceCompanionAnticipationSuggestedAction({
					kind: 'proactive_review',
					quick_replies: ['продолжай', 'позже'],
				})
			).toEqual({
				type: 'proactive_review',
				quick_replies: ['продолжай', 'позже'],
			});
		});

		it('returns null for unknown payloads', () => {
			expect(coerceCompanionAnticipationSuggestedAction(null)).toBeNull();
			expect(
				coerceCompanionAnticipationSuggestedAction({ type: 'anticipate' })
			).toBeNull();
		});
	});

	describe('anticipationSuggestedActionChips', () => {
		it('maps suggest_chat_prompt to a single chip', () => {
			expect(
				anticipationSuggestedActionChips({
					type: 'suggest_chat_prompt',
					prompt_text: 'Покажи связанное',
				})
			).toEqual(['Покажи связанное']);
		});
	});
});
