/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock AI draft → editor draft mapping.
 */
import { describe, expect, it } from 'vitest';
import { surveyAiQuestionsToDrafts } from '../surveyAdminAiUtils';

describe('surveyAiQuestionsToDrafts', () => {
	it('maps choice options to comma-separated text', () => {
		const rows = surveyAiQuestionsToDrafts([
			{
				question_key: 'channel',
				question_type: 'single_choice',
				prompt: 'How did you hear about us?',
				required: true,
				sort_order: 0,
				options_json: { choices: ['Web', 'Friend'] },
				validation_json: {},
			},
		]);
		expect(rows[0]?.choicesText).toBe('Web, Friend');
	});
});
