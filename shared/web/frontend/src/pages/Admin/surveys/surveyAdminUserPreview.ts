/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build a user-facing SurveyUserDetail snapshot from admin editor draft state.
 *
 * Invariants:
 * - Preview uses draft-local question keys; submit is disabled in preview mode.
 *
 * Related:
 * - surveyAdminEditorUtils.ts
 * - SurveyAdminUserPreviewDialog.tsx
 */
import type { SurveyUserDetail } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	draftToApiQuestions,
	type QuestionDraft,
} from './surveyAdminEditorUtils';

export type AdminUserPreviewInput = {
	surveyId: string;
	title: string;
	descriptionUser: string;
	rewardUgs: string;
	rewardEw: string;
	rewardCoins: string;
	questions: QuestionDraft[];
};

function parseReward(value: string): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function buildAdminUserPreviewDetail(
	input: AdminUserPreviewInput
): SurveyUserDetail | null {
	const apiQuestions = draftToApiQuestions(input.questions).filter(
		(q) => q.prompt.trim() && q.question_key.trim()
	);
	if (!apiQuestions.length) return null;

	return {
		id: input.surveyId,
		title: input.title.trim() || input.surveyId,
		description_user: input.descriptionUser.trim(),
		reward: {
			ugs_credits: parseReward(input.rewardUgs),
			ew_balance: parseReward(input.rewardEw),
			web_search_coins: parseReward(input.rewardCoins),
		},
		closes_at: null,
		questions: apiQuestions.map((q, index) => ({
			...q,
			id: `preview-${index}-${q.question_key}`,
		})),
		completed: false,
		completed_at: null,
	};
}
