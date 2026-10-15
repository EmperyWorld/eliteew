/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Human-readable survey answer labels for review and history views.
 *
 * Related:
 * - SurveyRunner.tsx
 * - surveyRunnerValidation.ts
 */
import type { TFunction } from 'i18next';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { surveyNumericBounds } from './surveyRunnerValidation';

function isYes(value: unknown): boolean {
	return value === true || value === 'yes' || value === 'true' || value === 1;
}

export function formatSurveyAnswerDisplay(
	question: SurveyQuestion,
	value: unknown,
	t: TFunction<'surveys'>
): string {
	if (value === null || value === undefined || value === '') {
		return t('runner.answerEmpty');
	}
	if (question.question_type === 'yes_no') {
		return isYes(value) ? t('runner.yes') : t('runner.no');
	}
	if (question.question_type === 'multi_choice' && Array.isArray(value)) {
		if (!value.length) return t('runner.answerEmpty');
		return value.map(String).join(', ');
	}
	if (question.question_type === 'scale' || question.question_type === 'nps') {
		const bounds = surveyNumericBounds(question);
		const num = Number(value);
		if (Number.isNaN(num)) return String(value);
		if (bounds) {
			return t('runner.answerScale', { value: num, max: bounds.max });
		}
		return String(num);
	}
	return String(value);
}
