/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin survey question draft validation and API payload shaping (mirrors server bounds).
 *
 * Invariants:
 * - scale options default min=1 max=5; nps min=0 max=10 (survey_validation.py).
 *
 * Related:
 * - SurveysAdminSection.tsx
 * - features/surveys/desktop/surveyRunnerValidation.ts
 */
import type {
	SurveyQuestion,
	SurveyQuestionIn,
} from '@/pages/Desktop/services/productDesktopSurveysApi';

export type QuestionDraft = {
	localId: string;
	question_key: string;
	question_type: string;
	prompt: string;
	required: boolean;
	choicesText: string;
};

export type QuestionValidationCode =
	| 'key'
	| 'prompt'
	| 'choices'
	| 'duplicateKey';

export type QuestionValidationIssue = {
	index: number;
	code: QuestionValidationCode;
};

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice']);

export function optionsJsonFromDraft(
	row: QuestionDraft
): Record<string, unknown> {
	if (CHOICE_TYPES.has(row.question_type) && row.choicesText.trim()) {
		return {
			choices: row.choicesText
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		};
	}
	if (row.question_type === 'scale') {
		return { min: 1, max: 5 };
	}
	if (row.question_type === 'nps') {
		return { min: 0, max: 10 };
	}
	return {};
}

export function draftToApiQuestions(rows: QuestionDraft[]): SurveyQuestionIn[] {
	return rows.map((row, idx) => ({
		question_key: row.question_key.trim(),
		question_type: row.question_type,
		prompt: row.prompt.trim(),
		required: row.required,
		sort_order: idx,
		options_json: optionsJsonFromDraft(row),
		validation_json: {},
	}));
}

export function validateQuestionDrafts(
	rows: QuestionDraft[]
): QuestionValidationIssue[] {
	const issues: QuestionValidationIssue[] = [];
	const seenKeys = new Set<string>();

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];
		const key = row.question_key.trim();
		if (!key) {
			issues.push({ index, code: 'key' });
		} else if (seenKeys.has(key)) {
			issues.push({ index, code: 'duplicateKey' });
		} else {
			seenKeys.add(key);
		}
		if (!row.prompt.trim()) {
			issues.push({ index, code: 'prompt' });
		}
		if (CHOICE_TYPES.has(row.question_type) && !row.choicesText.trim()) {
			issues.push({ index, code: 'choices' });
		}
	}

	return issues;
}

export function questionHasValidationIssue(
	issues: QuestionValidationIssue[],
	index: number
): boolean {
	return issues.some((issue) => issue.index === index);
}

export function emptyQuestionDraft(localId: string): QuestionDraft {
	return {
		localId,
		question_key: '',
		question_type: 'text_short',
		prompt: '',
		required: true,
		choicesText: '',
	};
}

export function choicesTextFromOptions(
	options: Record<string, unknown>
): string {
	const raw = options.choices;
	if (!Array.isArray(raw)) return '';
	return raw.map(String).join(', ');
}

export function questionToDraft(q: SurveyQuestion, idx: number): QuestionDraft {
	return {
		localId: q.id ?? `q-${idx}`,
		question_key: q.question_key,
		question_type: q.question_type,
		prompt: q.prompt,
		required: q.required,
		choicesText: choicesTextFromOptions(q.options_json ?? {}),
	};
}
