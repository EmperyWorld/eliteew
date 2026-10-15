/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Survey Hub product-desktop API client (user + admin).
 *
 * Invariants:
 * - DTO aliases come from `productDesktopSurveysOpenApi.ts` (OpenAPI SSOT).
 *
 * Related:
 * - api/routers/product_desktop_surveys.py
 * - documentation/product/SURVEY-HUB.md
 */
import { api } from '../../../services/api/client';
import { PRODUCT_DESKTOP_API_V1_BASE } from './productDesktopApi';
import type {
	AudiencePreviewOut,
	SurveyAdmin,
	SurveyAiDraft,
	SurveyAiDraftRequest,
	SurveyAudienceBody,
	SurveyCreateBody,
	SurveyGafNotifyQueuedOut,
	SurveyListAdminOut,
	SurveyPatchBody,
	SurveyQuestionIn,
	SurveyResponseAdminListOut,
	SurveyResponseMe,
	SurveyResultsSummary,
	SurveySubmitBody,
	SurveySubmitResult,
	SurveySummary,
	SurveyUserDetail,
	SurveyUserListOut,
} from './productDesktopSurveysOpenApi';

export type {
	AudiencePreviewOut,
	SurveyAdmin,
	SurveyAiDraft,
	SurveyAiDraftRequest,
	SurveyAudienceBody,
	SurveyCreateBody,
	SurveyGafNotifyQueuedOut,
	SurveyListAdminOut,
	SurveyPatchBody,
	SurveyQuestion,
	SurveyQuestionIn,
	SurveyResponseAdminListOut,
	SurveyResponseMe,
	SurveyResultsSummary,
	SurveyRewardSpec,
	SurveySubmitBody,
	SurveySubmitResult,
	SurveySummary,
	SurveyUserDetail,
	SurveyUserListItem,
	SurveyUserListOut,
} from './productDesktopSurveysOpenApi';

const BASE = PRODUCT_DESKTOP_API_V1_BASE;

export async function fetchSurveySummary(): Promise<SurveySummary> {
	return api.get<SurveySummary>(`${BASE}/surveys/summary`);
}

export async function fetchSurveys(
	filter?: 'available' | 'completed'
): Promise<SurveyUserListOut> {
	return api.get<SurveyUserListOut>(`${BASE}/surveys`, {
		params: filter ? { filter } : undefined,
	});
}

export async function fetchSurveyDetail(
	surveyId: string
): Promise<SurveyUserDetail> {
	return api.get<SurveyUserDetail>(`${BASE}/surveys/${surveyId}`);
}

export async function submitSurveyResponse(
	surveyId: string,
	body: SurveySubmitBody
): Promise<SurveySubmitResult> {
	return api.post<SurveySubmitResult>(
		`${BASE}/surveys/${surveyId}/responses`,
		body
	);
}

export async function fetchMySurveyResponse(
	surveyId: string
): Promise<SurveyResponseMe> {
	return api.get<SurveyResponseMe>(`${BASE}/surveys/${surveyId}/responses/me`);
}

export async function adminListSurveys(
	status?: string
): Promise<SurveyListAdminOut> {
	return api.get<SurveyListAdminOut>(`${BASE}/admin/surveys`, {
		params: status ? { status } : undefined,
	});
}

export async function adminSurveyAiDraft(
	body: SurveyAiDraftRequest
): Promise<SurveyAiDraft> {
	return api.post<SurveyAiDraft>(`${BASE}/admin/surveys/ai/draft`, body);
}

export async function adminCreateSurvey(
	body: SurveyCreateBody
): Promise<SurveyAdmin> {
	return api.post<SurveyAdmin>(`${BASE}/admin/surveys`, body);
}

export async function adminGetSurvey(surveyId: string): Promise<SurveyAdmin> {
	return api.get<SurveyAdmin>(`${BASE}/admin/surveys/${surveyId}`);
}

export async function adminPatchSurvey(
	surveyId: string,
	body: SurveyPatchBody
): Promise<SurveyAdmin> {
	return api.patch<SurveyAdmin>(`${BASE}/admin/surveys/${surveyId}`, body);
}

export async function adminReplaceSurveyQuestions(
	surveyId: string,
	questions: SurveyQuestionIn[]
): Promise<SurveyAdmin> {
	return api.put<SurveyAdmin>(
		`${BASE}/admin/surveys/${surveyId}/questions`,
		questions
	);
}

export async function adminReplaceSurveyAudience(
	surveyId: string,
	body: SurveyAudienceBody
): Promise<SurveyAdmin> {
	return api.put<SurveyAdmin>(
		`${BASE}/admin/surveys/${surveyId}/audience`,
		body
	);
}

export async function adminPreviewSurveyAudience(
	surveyId: string
): Promise<AudiencePreviewOut> {
	return api.post<AudiencePreviewOut>(
		`${BASE}/admin/surveys/${surveyId}/preview-audience`,
		{}
	);
}

export async function adminPublishSurvey(
	surveyId: string
): Promise<SurveyAdmin> {
	return api.post<SurveyAdmin>(`${BASE}/admin/surveys/${surveyId}/publish`, {});
}

export async function adminArchiveSurvey(
	surveyId: string
): Promise<SurveyAdmin> {
	return api.post<SurveyAdmin>(`${BASE}/admin/surveys/${surveyId}/archive`, {});
}

export async function adminSurveyResultsSummary(
	surveyId: string
): Promise<SurveyResultsSummary> {
	return api.get<SurveyResultsSummary>(
		`${BASE}/admin/surveys/${surveyId}/results/summary`
	);
}

export async function adminSurveyResultsResponses(
	surveyId: string,
	params?: {
		limit?: number;
		offset?: number;
		submitted_from?: string;
		submitted_to?: string;
		submitted_sort?: 'asc' | 'desc';
	}
): Promise<SurveyResponseAdminListOut> {
	return api.get<SurveyResponseAdminListOut>(
		`${BASE}/admin/surveys/${surveyId}/results/responses`,
		{ params }
	);
}

export async function adminQueueSurveyGafNotify(
	surveyId: string,
	mode: 'undelivered' | 'incomplete'
): Promise<SurveyGafNotifyQueuedOut> {
	return api.post<SurveyGafNotifyQueuedOut>(
		`${BASE}/admin/surveys/${surveyId}/gaf-notify`,
		{},
		{ params: { mode } }
	);
}
