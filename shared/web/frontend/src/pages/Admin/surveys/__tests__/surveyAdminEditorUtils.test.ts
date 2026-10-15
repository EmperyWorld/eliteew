/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	draftToApiQuestions,
	emptyQuestionDraft,
	validateQuestionDrafts,
} from '../surveyAdminEditorUtils';

describe('surveyAdminEditorUtils', () => {
	it('embeds scale and nps bounds in options_json', () => {
		const rows = [
			{
				...emptyQuestionDraft('a'),
				question_key: 's',
				question_type: 'scale',
				prompt: 'Rate',
			},
			{
				...emptyQuestionDraft('b'),
				question_key: 'n',
				question_type: 'nps',
				prompt: 'NPS',
			},
		];
		const api = draftToApiQuestions(rows);
		expect(api[0]?.options_json).toEqual({ min: 1, max: 5 });
		expect(api[1]?.options_json).toEqual({ min: 0, max: 10 });
	});

	it('flags empty prompt and duplicate keys', () => {
		const rows = [
			{ ...emptyQuestionDraft('1'), question_key: 'dup', prompt: '' },
			{ ...emptyQuestionDraft('2'), question_key: 'dup', prompt: 'Ok' },
		];
		const issues = validateQuestionDrafts(rows);
		expect(issues).toContainEqual({ index: 0, code: 'prompt' });
		expect(issues).toContainEqual({ index: 1, code: 'duplicateKey' });
	});

	it('requires choices for choice types', () => {
		const row = {
			...emptyQuestionDraft('c'),
			question_key: 'pick',
			question_type: 'single_choice',
			prompt: 'Pick one',
			choicesText: '',
		};
		expect(validateQuestionDrafts([row])).toContainEqual({
			index: 0,
			code: 'choices',
		});
	});
});
