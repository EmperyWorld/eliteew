/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Clone an existing survey into a new draft via admin CRUD (any source status).
 *
 * Invariants:
 * - New survey is always draft; questions and audience are copied verbatim.
 *
 * Related:
 * - SurveysAdminSection.tsx
 * - productDesktopSurveysApi.ts
 */
import {
	adminCreateSurvey,
	adminGetSurvey,
	adminReplaceSurveyAudience,
	adminReplaceSurveyQuestions,
	type SurveyAdmin,
	type SurveyQuestion,
	type SurveyQuestionIn,
} from '../../Desktop/services/productDesktopSurveysApi';

export function duplicateSurveyTitle(
	sourceTitle: string,
	suffix: string
): string {
	const base = sourceTitle.trim() || 'Survey';
	const trimmedSuffix = suffix.trim();
	if (!trimmedSuffix) return `${base} (copy)`;
	return `${base} ${trimmedSuffix}`;
}

function stripQuestionIds(questions: SurveyQuestion[]): SurveyQuestionIn[] {
	return questions.map((question, index) => ({
		question_key: question.question_key,
		question_type: question.question_type,
		prompt: question.prompt,
		help_text: question.help_text ?? null,
		required: question.required,
		sort_order: index,
		options_json: question.options_json,
		validation_json: question.validation_json,
	}));
}

export async function duplicateSurveyAsDraft(
	sourceId: string,
	titleSuffix: string
): Promise<SurveyAdmin> {
	const source = await adminGetSurvey(sourceId);
	const created = await adminCreateSurvey({
		title: duplicateSurveyTitle(source.title, titleSuffix),
		description_user: source.description_user,
		description_admin: source.description_admin,
		audience_mode: source.audience_mode,
		reward: source.reward,
		gaf_notify_body_template: source.gaf_notify_body_template,
		closes_at: source.closes_at,
		sort_order: source.sort_order,
	});
	await adminReplaceSurveyQuestions(
		created.id,
		stripQuestionIds(source.questions ?? [])
	);
	return adminReplaceSurveyAudience(created.id, {
		audience_mode: source.audience_mode,
		access_group_ids: source.access_group_ids ?? [],
		user_ids: source.user_ids ?? [],
	});
}
