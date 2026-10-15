/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing Survey Hub helpers (duration estimate, reward detection, runner progress).
 *
 * Related:
 * - SurveyHubDesktopApp.tsx, SurveyRunner.tsx
 */
import type { SurveyRewardSpec } from '@/pages/Desktop/services/productDesktopSurveysApi';

export function surveyHasReward(reward: SurveyRewardSpec): boolean {
	return (
		reward.ugs_credits > 0 ||
		reward.ew_balance > 0 ||
		reward.web_search_coins > 0
	);
}

/** Rough minutes for user expectation (~45s per question, min 1). */
export function estimateSurveyMinutes(questionCount: number): number {
	if (questionCount <= 0) return 1;
	return Math.max(1, Math.ceil(questionCount * 0.75));
}

export function computeRunnerProgress(input: {
	step: number;
	questionCount: number;
	review: boolean;
}): number {
	const { step, questionCount, review } = input;
	if (questionCount <= 0) return 0;
	if (review) return 100;
	return Math.round(((step + 1) / questionCount) * 100);
}

export function formatSurveyDateLabel(
	iso: string | null | undefined
): string | null {
	if (!iso) return null;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
}

export function surveyClosesSoon(
	closesAt: string | null | undefined,
	withinDays = 7
): boolean {
	if (!closesAt) return false;
	const end = new Date(closesAt).getTime();
	if (Number.isNaN(end)) return false;
	const now = Date.now();
	if (end <= now) return false;
	return end - now <= withinDays * 24 * 60 * 60 * 1000;
}

export function filterSurveyListByQuery<
	T extends { title: string; description_user: string },
>(items: T[], query: string): T[] {
	const q = query.trim().toLowerCase();
	if (!q) return items;
	return items.filter((item) => {
		const haystack = `${item.title} ${item.description_user}`.toLowerCase();
		return haystack.includes(q);
	});
}

/** Soonest active deadline first; no-deadline surveys last. */
export function surveyDeadlineSortKey(
	closesAt: string | null | undefined,
	nowMs: number = Date.now()
): number {
	if (!closesAt) return Number.MAX_SAFE_INTEGER;
	const end = new Date(closesAt).getTime();
	if (Number.isNaN(end)) return Number.MAX_SAFE_INTEGER;
	if (end <= nowMs) return Number.MAX_SAFE_INTEGER - 1;
	return end;
}

export function sortAvailableSurveysByDeadline<
	T extends { closes_at: string | null },
>(items: T[], nowMs: number = Date.now()): T[] {
	return [...items].sort(
		(a, b) =>
			surveyDeadlineSortKey(a.closes_at, nowMs) -
			surveyDeadlineSortKey(b.closes_at, nowMs)
	);
}

/** Newest completion first by default; missing dates sort last. */
export function surveyCompletedSortKey(
	completedAt: string | null | undefined
): number {
	if (!completedAt) return 0;
	const t = new Date(completedAt).getTime();
	return Number.isNaN(t) ? 0 : t;
}

export function sortCompletedSurveysByDate<
	T extends { completed_at: string | null },
>(items: T[], order: 'newest' | 'oldest' = 'newest'): T[] {
	return [...items].sort((a, b) => {
		const ka = surveyCompletedSortKey(a.completed_at);
		const kb = surveyCompletedSortKey(b.completed_at);
		return order === 'newest' ? kb - ka : ka - kb;
	});
}
