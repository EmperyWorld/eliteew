/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map AI survey draft payloads to admin editor question drafts.
 *
 * Related:
 * - SurveyAdminAiCreatePanel.tsx
 */
import type { SurveyAiDraft } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	choicesTextFromOptions,
	draftToApiQuestions,
	type QuestionDraft,
} from './surveyAdminEditorUtils';

export function surveyAiQuestionsToDrafts(
	questions: SurveyAiDraft['questions']
): QuestionDraft[] {
	return (questions ?? []).map((q, index) => ({
		localId: `ai-${index}-${q.question_key}`,
		question_key: q.question_key,
		question_type: q.question_type,
		prompt: q.prompt,
		required: q.required,
		choicesText: choicesTextFromOptions(q.options_json ?? {}),
	}));
}

export function editorStateToAiDraft(input: {
	title: string;
	descriptionUser: string;
	gafNotifyBody: string;
	rewardUgs: string;
	rewardEw: string;
	rewardCoins: string;
	questions: QuestionDraft[];
}): SurveyAiDraft {
	return {
		title: input.title.trim(),
		description_user: input.descriptionUser,
		description_admin: null,
		gaf_notify_body_template: input.gafNotifyBody.trim() || null,
		reward: {
			ugs_credits: Math.max(0, Number.parseInt(input.rewardUgs, 10) || 0),
			ew_balance: Math.max(0, Number.parseInt(input.rewardEw, 10) || 0),
			web_search_coins: Math.max(
				0,
				Number.parseInt(input.rewardCoins, 10) || 0
			),
		},
		questions: draftToApiQuestions(input.questions),
	};
}
