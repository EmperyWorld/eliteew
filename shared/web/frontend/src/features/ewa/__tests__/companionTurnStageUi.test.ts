/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import { companionTurnStageHintKey } from '@/features/ewa/companionTurnStageUi';

describe('companionTurnStageHintKey', () => {
	it('maps preparing_context with heavy skip', () => {
		expect(
			companionTurnStageHintKey({
				stage: 'preparing_context',
				heavy_steps_skipped: true,
			})
		).toBe('ewaCompanion.turnStage.preparingContextLight');
	});

	it('maps composing_reply', () => {
		expect(companionTurnStageHintKey({ stage: 'composing_reply' })).toBe(
			'ewaCompanion.turnStage.composingReply'
		);
	});

	it('maps web_search', () => {
		expect(companionTurnStageHintKey({ stage: 'web_search' })).toBe(
			'ewaCompanion.turnStage.webSearch'
		);
	});
});
