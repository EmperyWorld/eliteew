import { describe, expect, it } from 'vitest';
import {
	collectSurveyReviewIssues,
	surveyNpsSemanticLabel,
	surveyNumericBounds,
	surveyScaleEndpointLabels,
	surveySubmitDetailToErrorKey,
	validateAllSurveyAnswers,
	validateSurveyStepAnswer,
	isSurveyReadOnly,
} from '../surveyRunnerValidation';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';

describe('surveyRunnerValidation', () => {
	it('flags missing required answers', () => {
		const q: SurveyQuestion = {
			id: 'q-q1',
			question_key: 'q1',
			question_type: 'text_short',
			prompt: 'Name',
			required: true,
			sort_order: 0,
			options_json: {},
			validation_json: {},
		};
		expect(validateSurveyStepAnswer(q, '')).toBe('required');
	});

	it('accepts required yes_no false (No)', () => {
		const q: SurveyQuestion = {
			id: 'q-agree',
			question_key: 'agree',
			question_type: 'yes_no',
			prompt: 'Agree?',
			required: true,
			sort_order: 0,
			options_json: {},
			validation_json: {},
		};
		expect(validateSurveyStepAnswer(q, false)).toBeNull();
		expect(validateSurveyStepAnswer(q, true)).toBeNull();
		expect(validateSurveyStepAnswer(q, undefined)).toBe('required');
	});

	it('accepts valid nps value', () => {
		const q: SurveyQuestion = {
			id: 'q-nps',
			question_key: 'nps',
			question_type: 'nps',
			prompt: 'Score',
			required: true,
			sort_order: 0,
			options_json: {},
			validation_json: {},
		};
		expect(validateSurveyStepAnswer(q, 9)).toBeNull();
		expect(surveyNumericBounds(q)).toEqual({ min: 0, max: 10 });
	});

	it('rejects scale above server default max (5)', () => {
		const q: SurveyQuestion = {
			id: 'q-3',
			question_key: '3',
			question_type: 'scale',
			prompt: 'Rate',
			required: true,
			sort_order: 0,
			options_json: {},
			validation_json: {},
		};
		expect(validateSurveyStepAnswer(q, 7)).toBe('invalid');
		expect(validateSurveyStepAnswer(q, 5)).toBeNull();
	});

	it('rejects text longer than server max_length default', () => {
		const q: SurveyQuestion = {
			id: 'q-bio',
			question_key: 'bio',
			question_type: 'text_short',
			prompt: 'Bio',
			required: true,
			sort_order: 0,
			options_json: {},
			validation_json: {},
		};
		expect(validateSurveyStepAnswer(q, 'x'.repeat(501))).toBe('tooLong');
	});

	it('validateAllSurveyAnswers returns first failing question', () => {
		const questions: SurveyQuestion[] = [
			{
				id: 'q-ok',
				question_key: 'ok',
				question_type: 'text_short',
				prompt: 'Ok',
				required: true,
				sort_order: 0,
				options_json: {},
				validation_json: {},
			},
			{
				id: 'q-missing',
				question_key: 'missing',
				question_type: 'text_short',
				prompt: 'Need',
				required: true,
				sort_order: 1,
				options_json: {},
				validation_json: {},
			},
		];
		expect(validateAllSurveyAnswers(questions, { ok: 'hello' })).toEqual({
			questionKey: 'missing',
			errorKey: 'required',
		});
	});

	it('maps API 422 detail strings to runner error keys', () => {
		expect(surveySubmitDetailToErrorKey('Missing required answer: q1')).toBe(
			'required'
		);
		expect(surveySubmitDetailToErrorKey('Text too long for bio')).toBe(
			'tooLong'
		);
		expect(surveySubmitDetailToErrorKey('Invalid choice for color')).toBe(
			'invalid'
		);
	});

	it('history is read-only when completed', () => {
		expect(isSurveyReadOnly(true)).toBe(true);
		expect(isSurveyReadOnly(false)).toBe(false);
	});

	it('collectSurveyReviewIssues lists all incomplete questions', () => {
		const questions: SurveyQuestion[] = [
			{
				id: 'q-ok',
				question_key: 'ok',
				question_type: 'text_short',
				prompt: 'Ok',
				required: true,
				sort_order: 0,
				options_json: {},
				validation_json: {},
			},
			{
				id: 'q-missing',
				question_key: 'missing',
				question_type: 'text_short',
				prompt: 'Need',
				required: true,
				sort_order: 1,
				options_json: {},
				validation_json: {},
			},
		];
		expect(collectSurveyReviewIssues(questions, { ok: 'hello' })).toEqual([
			{ questionKey: 'missing', errorKey: 'required' },
		]);
	});

	it('maps NPS value to semantic label bucket', () => {
		expect(surveyNpsSemanticLabel(4, 10)).toBe('detractor');
		expect(surveyNpsSemanticLabel(8, 10)).toBe('passive');
		expect(surveyNpsSemanticLabel(10, 10)).toBe('promoter');
		expect(surveyNpsSemanticLabel(5, 5)).toBeNull();
	});

	it('reads scale endpoint labels from options_json', () => {
		const q: SurveyQuestion = {
			id: 'q-s',
			question_key: 's',
			question_type: 'scale',
			prompt: 'Rate',
			required: true,
			sort_order: 0,
			options_json: { min_label: 'Low', max_label: 'High' },
			validation_json: {},
		};
		expect(surveyScaleEndpointLabels(q)).toEqual({
			minLabel: 'Low',
			maxLabel: 'High',
		});
	});
});
