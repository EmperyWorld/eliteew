/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side answer validation mirror for survey runner (UX guard before submit).
 *
 * Related:
 * - api/services/surveys/survey_validation.py
 */
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';

export type SurveyAnswerErrorKey = 'required' | 'invalid' | 'tooLong';

export function isSurveyAnswerProvided(value: unknown, qtype: string): boolean {
	return !isSurveyAnswerEmpty(value, qtype);
}

export function countSurveyAnsweredQuestions(
	questions: SurveyQuestion[],
	answers: Record<string, unknown>
): number {
	return questions.filter((question) =>
		isSurveyAnswerProvided(
			answers[question.question_key],
			question.question_type
		)
	).length;
}

function isSurveyAnswerEmpty(value: unknown, qtype: string): boolean {
	if (qtype === 'yes_no') {
		return value === null || value === undefined;
	}
	if (
		value === null ||
		value === undefined ||
		value === '' ||
		value === false
	) {
		return true;
	}
	return Array.isArray(value) && value.length === 0;
}

export function textMaxLength(question: SurveyQuestion): number {
	const validation = question.validation_json ?? {};
	if (question.question_type === 'text_long') {
		return Number(validation.max_length ?? 5000);
	}
	if (question.question_type === 'text_short') {
		return Number(validation.max_length ?? 500);
	}
	return 0;
}

/** Mirrors api/services/surveys/survey_validation.py scale/nps defaults. */
export function surveyNumericBounds(
	question: SurveyQuestion
): { min: number; max: number } | null {
	const qtype = question.question_type;
	if (qtype !== 'scale' && qtype !== 'nps') return null;
	const options = question.options_json ?? {};
	const validation = question.validation_json ?? {};
	if (qtype === 'nps') {
		return {
			min: Number(options.min ?? validation.min ?? 0),
			max: Number(options.max ?? validation.max ?? 10),
		};
	}
	return {
		min: Number(options.min ?? validation.min ?? 1),
		max: Number(options.max ?? validation.max ?? 5),
	};
}

export function validateSurveyStepAnswer(
	question: SurveyQuestion,
	value: unknown
): SurveyAnswerErrorKey | null {
	const qtype = question.question_type;
	if (isSurveyAnswerEmpty(value, qtype)) {
		if (question.required) return 'required';
		return null;
	}
	const options = question.options_json ?? {};
	if (qtype === 'yes_no') {
		if (
			value === true ||
			value === false ||
			value === 'yes' ||
			value === 'no' ||
			value === 'true' ||
			value === 'false' ||
			value === 1 ||
			value === 0
		) {
			return null;
		}
		return 'invalid';
	}
	if (qtype === 'single_choice') {
		const choices = (options.choices as string[] | undefined) ?? [];
		if (choices.length && !choices.includes(String(value))) return 'invalid';
		return null;
	}
	if (qtype === 'multi_choice') {
		if (!Array.isArray(value) || value.length === 0) {
			return question.required ? 'required' : null;
		}
		const choices = (options.choices as string[] | undefined) ?? [];
		if (choices.length && value.some((v) => !choices.includes(String(v)))) {
			return 'invalid';
		}
		return null;
	}
	if (qtype === 'scale' || qtype === 'nps') {
		const bounds = surveyNumericBounds(question);
		if (!bounds) return 'invalid';
		const num = Number(value);
		if (Number.isNaN(num)) return 'invalid';
		if (num < bounds.min || num > bounds.max) return 'invalid';
		return null;
	}
	if (qtype === 'text_short' || qtype === 'text_long') {
		const text = String(value).trim();
		if (!text && question.required) return 'required';
		const maxLen = textMaxLength(question);
		if (text.length > maxLen) return 'tooLong';
		return null;
	}
	return null;
}

export function collectSurveyReviewIssues(
	questions: SurveyQuestion[],
	answers: Record<string, unknown>
): { questionKey: string; errorKey: SurveyAnswerErrorKey }[] {
	const ordered = [...questions].sort((a, b) => a.sort_order - b.sort_order);
	const issues: { questionKey: string; errorKey: SurveyAnswerErrorKey }[] = [];
	for (const question of ordered) {
		const errorKey = validateSurveyStepAnswer(
			question,
			answers[question.question_key]
		);
		if (errorKey) {
			issues.push({ questionKey: question.question_key, errorKey });
		}
	}
	return issues;
}

export function validateAllSurveyAnswers(
	questions: SurveyQuestion[],
	answers: Record<string, unknown>
): { questionKey: string; errorKey: SurveyAnswerErrorKey } | null {
	const ordered = [...questions].sort((a, b) => a.sort_order - b.sort_order);
	for (const question of ordered) {
		const errorKey = validateSurveyStepAnswer(
			question,
			answers[question.question_key]
		);
		if (errorKey) {
			return { questionKey: question.question_key, errorKey };
		}
	}
	return null;
}

/** Map FastAPI 422 detail from survey_validation.py to runner error keys. */
export function surveySubmitDetailToErrorKey(
	detail: string
): SurveyAnswerErrorKey {
	if (detail.includes('Missing required')) return 'required';
	if (detail.includes('Text too long')) return 'tooLong';
	return 'invalid';
}

export function surveyNpsSemanticLabel(
	value: number,
	max: number
): 'detractor' | 'passive' | 'promoter' | null {
	if (max !== 10) return null;
	if (value <= 6) return 'detractor';
	if (value <= 8) return 'passive';
	return 'promoter';
}

export function surveyScaleEndpointLabels(question: SurveyQuestion): {
	minLabel: string | null;
	maxLabel: string | null;
} {
	const options = question.options_json ?? {};
	const minLabel =
		typeof options.min_label === 'string' && options.min_label.trim()
			? options.min_label.trim()
			: null;
	const maxLabel =
		typeof options.max_label === 'string' && options.max_label.trim()
			? options.max_label.trim()
			: null;
	return { minLabel, maxLabel };
}

export function isSurveyReadOnly(completed: boolean): boolean {
	return completed;
}
