/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse GAF metadata for published survey announcements.
 */
export type GafSurveyAnnouncementMeta = {
	kind: 'survey_announcement';
	survey_id: string;
	title?: string;
	open_app_component: string;
	deep_link?: { surveyId?: string };
};

export function getGafSurveyAnnouncementMeta(
	raw: unknown
): GafSurveyAnnouncementMeta | null {
	if (!raw || typeof raw !== 'object') return null;
	const m = raw as Record<string, unknown>;
	if (m.kind !== 'survey_announcement') return null;
	const surveyId = String(m.survey_id ?? '').trim();
	const component = String(m.open_app_component ?? 'SurveyHubApp').trim();
	if (!surveyId) return null;
	return {
		kind: 'survey_announcement',
		survey_id: surveyId,
		title: typeof m.title === 'string' ? m.title : undefined,
		open_app_component: component,
		deep_link:
			m.deep_link && typeof m.deep_link === 'object'
				? (m.deep_link as { surveyId?: string })
				: undefined,
	};
}
