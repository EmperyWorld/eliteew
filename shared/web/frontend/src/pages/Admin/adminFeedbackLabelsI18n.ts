/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n labels for feedback ticket status and kind in unified admin.
 *
 * Invariants:
 * - API values stay English (open, wish, …); display via desktopUi keys only.
 *
 * Related:
 * - `pages/Desktop/utils/feedbackLabels.ts`
 * - `pages/Admin/FeedbackAdminSection.tsx`
 */

import type { TFunction } from 'i18next';

export function adminFeedbackStatusLabelI18n(
	status: string,
	t: TFunction<'desktopUi'>
): string {
	const key = `adminFeedback.statuses.${status}`;
	const label = t(key);
	return label === key ? status : label;
}

export function adminFeedbackKindLabelI18n(
	kind: string,
	t: TFunction<'desktopUi'>
): string {
	const key = `adminFeedback.kinds.${kind}`;
	const label = t(key);
	return label === key ? kind : label;
}
