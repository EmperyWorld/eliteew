/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve GAF survey announcement body for admin preview (mirrors Celery default).
 *
 * Related:
 * - api/tasks/survey_gaf_notify.py
 * - SurveyAdminGafNotifyPreview.tsx
 */

/** Matches `survey_gaf_notify.py` default_body when template is empty. */
export function buildDefaultSurveyGafNotifyBody(title: string): string {
	const trimmed = title.trim() || 'опрос';
	return `Доступен новый опрос «${trimmed}». Откройте приложение «Опросы» на рабочем столе, чтобы пройти его.`;
}

export function resolveSurveyGafNotifyBody(
	template: string | null | undefined,
	surveyTitle: string
): { body: string; usesDefault: boolean } {
	const custom = (template ?? '').trim();
	if (custom) {
		return { body: custom, usesDefault: false };
	}
	return {
		body: buildDefaultSurveyGafNotifyBody(surveyTitle),
		usesDefault: true,
	};
}
