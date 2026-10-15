/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP web search quality levels and API payload helpers (persisted per app).
 */
export type EwrpWebSearchQuality = 'off' | 'light' | 'standard' | 'deep';

export const EWRP_WEB_SEARCH_QUALITY_STORAGE_KEY =
	'eliteew.ewrp.webSearchQuality.v1';

export const EWRP_WEB_SEARCH_QUALITY_OPTIONS: EwrpWebSearchQuality[] = [
	'off',
	'light',
	'standard',
	'deep',
];

export function isEwrpWebSearchQuality(
	value: string | null | undefined
): value is EwrpWebSearchQuality {
	return (
		value === 'off' ||
		value === 'light' ||
		value === 'standard' ||
		value === 'deep'
	);
}

export function readStoredEwrpWebSearchQuality(): EwrpWebSearchQuality {
	try {
		const raw = localStorage.getItem(EWRP_WEB_SEARCH_QUALITY_STORAGE_KEY);
		return isEwrpWebSearchQuality(raw) ? raw : 'off';
	} catch {
		return 'off';
	}
}

export function writeStoredEwrpWebSearchQuality(
	quality: EwrpWebSearchQuality
): void {
	try {
		localStorage.setItem(EWRP_WEB_SEARCH_QUALITY_STORAGE_KEY, quality);
	} catch {
		/* ignore */
	}
}

export function ewrpWebSearchApiFields(quality: EwrpWebSearchQuality): {
	web_search_quality: EwrpWebSearchQuality;
	use_web_search?: boolean;
} {
	if (quality === 'off') {
		return { web_search_quality: 'off' };
	}
	return { web_search_quality: quality, use_web_search: true };
}
