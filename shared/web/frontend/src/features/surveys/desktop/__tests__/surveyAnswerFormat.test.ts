import { describe, expect, it } from 'vitest';
import { formatSurveyAnswerDisplay } from '../surveyAnswerFormat';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';

const t = ((key: string, opts?: Record<string, unknown>) => {
	if (key === 'runner.yes') return 'Yes';
	if (key === 'runner.no') return 'No';
	if (key === 'runner.answerScale') return `${opts?.value} of ${opts?.max}`;
	if (key === 'runner.answerEmpty') return '—';
	return key;
}) as never;

describe('formatSurveyAnswerDisplay', () => {
	it('formats yes/no and scale answers', () => {
		const yesNo: SurveyQuestion = {
			id: 'q-yn',
			question_key: 'yn',
			question_type: 'yes_no',
			prompt: 'Ok?',
			required: true,
			sort_order: 0,
			options_json: {},
			validation_json: {},
		};
		expect(formatSurveyAnswerDisplay(yesNo, true, t)).toBe('Yes');

		const scale: SurveyQuestion = {
			id: 'q-s',
			question_key: 's',
			question_type: 'scale',
			prompt: 'Rate',
			required: true,
			sort_order: 0,
			options_json: {},
			validation_json: {},
		};
		expect(formatSurveyAnswerDisplay(scale, 4, t)).toBe('4 of 5');
	});
});
