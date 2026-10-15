/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin catalog status badge styling for Survey Hub list.
 */
import type { SurveyAdmin } from '@/pages/Desktop/services/productDesktopSurveysApi';

export type SurveyAdminStatusTone =
	| 'draft'
	| 'published'
	| 'archived'
	| 'unknown';

export function surveyAdminStatusTone(status: string): SurveyAdminStatusTone {
	if (status === 'draft' || status === 'published' || status === 'archived') {
		return status;
	}
	return 'unknown';
}

export type SurveyAdminCatalogSummary = {
	total: number;
	draft: number;
	published: number;
	archived: number;
};

export function summarizeAdminCatalog(
	items: SurveyAdmin[]
): SurveyAdminCatalogSummary {
	const summary: SurveyAdminCatalogSummary = {
		total: items.length,
		draft: 0,
		published: 0,
		archived: 0,
	};
	for (const item of items) {
		const tone = surveyAdminStatusTone(item.status);
		if (tone === 'draft') summary.draft += 1;
		else if (tone === 'published') summary.published += 1;
		else if (tone === 'archived') summary.archived += 1;
	}
	return summary;
}

export function filterAdminCatalogSurveys(
	items: SurveyAdmin[],
	input: { query: string; statusFilter: string }
): SurveyAdmin[] {
	const q = input.query.trim().toLowerCase();
	return items.filter((item) => {
		if (input.statusFilter && item.status !== input.statusFilter) {
			return false;
		}
		if (!q) return true;
		const haystack = `${item.title} ${item.description_user}`.toLowerCase();
		return haystack.includes(q);
	});
}

export function surveyAdminCatalogMeta(item: SurveyAdmin): {
	questionCount: number;
	audienceSize: number;
} {
	return {
		questionCount: item.question_count ?? (item.questions ?? []).length,
		audienceSize:
			(item.access_group_ids ?? []).length + (item.user_ids ?? []).length,
	};
}
