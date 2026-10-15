/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session-scoped persistence for Survey Hub history list preferences (sort + search).
 *
 * Invariants:
 * - Invalid or missing session data falls back to newest-first and empty search.
 * - Partial writes merge with existing prefs so sort and search do not clobber each other.
 *
 * Related:
 * - SurveyHubDesktopApp.tsx
 */
export const SURVEY_HUB_HISTORY_SESSION_KEY =
	'eliteew-survey-hub-history-prefs';

const MAX_HISTORY_SEARCH_LENGTH = 200;

export type SurveyHubHistoryPrefs = {
	newestFirst: boolean;
	searchQuery: string;
};

export const DEFAULT_SURVEY_HUB_HISTORY_PREFS: SurveyHubHistoryPrefs = {
	newestFirst: true,
	searchQuery: '',
};

function readStoredPrefs(): SurveyHubHistoryPrefs {
	if (typeof sessionStorage === 'undefined') {
		return { ...DEFAULT_SURVEY_HUB_HISTORY_PREFS };
	}
	try {
		const raw = sessionStorage.getItem(SURVEY_HUB_HISTORY_SESSION_KEY);
		if (!raw) return { ...DEFAULT_SURVEY_HUB_HISTORY_PREFS };
		const parsed = JSON.parse(raw) as {
			newestFirst?: unknown;
			searchQuery?: unknown;
		};
		return {
			newestFirst: parsed.newestFirst !== false,
			searchQuery:
				typeof parsed.searchQuery === 'string'
					? parsed.searchQuery.slice(0, MAX_HISTORY_SEARCH_LENGTH)
					: '',
		};
	} catch {
		return { ...DEFAULT_SURVEY_HUB_HISTORY_PREFS };
	}
}

function persistPrefs(patch: Partial<SurveyHubHistoryPrefs>): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		const current = readStoredPrefs();
		sessionStorage.setItem(
			SURVEY_HUB_HISTORY_SESSION_KEY,
			JSON.stringify({
				...current,
				...patch,
				searchQuery:
					patch.searchQuery !== undefined
						? patch.searchQuery.slice(0, MAX_HISTORY_SEARCH_LENGTH)
						: current.searchQuery,
			})
		);
	} catch {
		// ignore quota / private mode
	}
}

export function readHistoryNewestFirst(): boolean {
	return readStoredPrefs().newestFirst;
}

export function readHistorySearchQuery(): string {
	return readStoredPrefs().searchQuery;
}

export function persistHistoryNewestFirst(newestFirst: boolean): void {
	persistPrefs({ newestFirst });
}

export function persistHistorySearchQuery(searchQuery: string): void {
	persistPrefs({ searchQuery });
}

export function isSurveyHubHistoryFiltersActive(
	prefs: SurveyHubHistoryPrefs
): boolean {
	return (
		prefs.searchQuery.trim().length > 0 ||
		prefs.newestFirst !== DEFAULT_SURVEY_HUB_HISTORY_PREFS.newestFirst
	);
}

export function clearSurveyHubHistoryPrefs(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(SURVEY_HUB_HISTORY_SESSION_KEY);
	} catch {
		// ignore private mode
	}
}
