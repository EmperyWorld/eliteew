/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session-scoped persistence for in-progress survey runner state (tab-local).
 *
 * Invariants:
 * - Invalid JSON falls back to null; never throws into UI.
 * - Cleared on successful submit or explicit exit confirm.
 *
 * Related:
 * - SurveyRunner.tsx · SURVEY-HUB.md wave 25
 */
export const SURVEY_RUNNER_INTRO_SESSION_PREFIX =
	'eliteew-survey-runner-intro-dismissed:';

export type SurveyRunnerSessionPayload = {
	step: number;
	review: boolean;
	answers: Record<string, unknown>;
	updatedAt: string;
};

function storageKey(surveyId: string): string {
	return `eliteew-survey-runner:${surveyId}`;
}

function introKey(surveyId: string): string {
	return `${SURVEY_RUNNER_INTRO_SESSION_PREFIX}${surveyId}`;
}

export function readSurveyRunnerSession(
	surveyId: string
): SurveyRunnerSessionPayload | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(storageKey(surveyId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<SurveyRunnerSessionPayload>;
		if (
			typeof parsed.step !== 'number' ||
			typeof parsed.review !== 'boolean' ||
			typeof parsed.answers !== 'object' ||
			parsed.answers === null
		) {
			return null;
		}
		return {
			step: Math.max(0, Math.floor(parsed.step)),
			review: parsed.review,
			answers: parsed.answers as Record<string, unknown>,
			updatedAt:
				typeof parsed.updatedAt === 'string'
					? parsed.updatedAt
					: new Date().toISOString(),
		};
	} catch {
		return null;
	}
}

export function persistSurveyRunnerSession(
	surveyId: string,
	payload: Omit<SurveyRunnerSessionPayload, 'updatedAt'>
): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		const next: SurveyRunnerSessionPayload = {
			...payload,
			updatedAt: new Date().toISOString(),
		};
		sessionStorage.setItem(storageKey(surveyId), JSON.stringify(next));
	} catch {
		// sessionStorage full or private mode — degrade silently
	}
}

export function clearSurveyRunnerSession(surveyId: string): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(storageKey(surveyId));
	} catch {
		// ignore
	}
}

export function readSurveyRunnerIntroDismissed(surveyId: string): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		return sessionStorage.getItem(introKey(surveyId)) === '1';
	} catch {
		return false;
	}
}

export function persistSurveyRunnerIntroDismissed(surveyId: string): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(introKey(surveyId), '1');
	} catch {
		// ignore
	}
}

export function clearSurveyRunnerIntroDismissed(surveyId: string): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(introKey(surveyId));
	} catch {
		// ignore
	}
}

export function hasRestorableSurveyRunnerSession(
	session: SurveyRunnerSessionPayload | null
): boolean {
	if (!session) return false;
	return (
		session.review ||
		session.step > 0 ||
		Object.keys(session.answers).length > 0
	);
}
