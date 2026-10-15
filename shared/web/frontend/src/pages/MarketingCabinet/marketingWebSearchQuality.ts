/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global marketing-cabinet web search quality levels and API payload helpers.
 *
 * Invariants:
 * - Default quality is off; persisted in localStorage for the cabinet session.
 *
 * Related:
 * - MarketingWebSearchQualityContext.tsx
 */

export type MarketingWebSearchQuality = 'off' | 'light' | 'standard' | 'deep';

export const MARKETING_WEB_SEARCH_QUALITY_STORAGE_KEY =
	'eliteew.marketing-cabinet.webSearchQuality.v1';

export const MARKETING_WEB_SEARCH_QUALITY_OPTIONS: MarketingWebSearchQuality[] =
	['off', 'light', 'standard', 'deep'];

export function isMarketingWebSearchQuality(
	value: string | null | undefined
): value is MarketingWebSearchQuality {
	return (
		value === 'off' ||
		value === 'light' ||
		value === 'standard' ||
		value === 'deep'
	);
}

export function readStoredMarketingWebSearchQuality(): MarketingWebSearchQuality {
	try {
		const raw = localStorage.getItem(MARKETING_WEB_SEARCH_QUALITY_STORAGE_KEY);
		return isMarketingWebSearchQuality(raw) ? raw : 'off';
	} catch {
		return 'off';
	}
}

export function writeStoredMarketingWebSearchQuality(
	quality: MarketingWebSearchQuality
): void {
	try {
		localStorage.setItem(MARKETING_WEB_SEARCH_QUALITY_STORAGE_KEY, quality);
	} catch {
		/* ignore quota / private mode */
	}
}

/** Fields for marketing-cabinet API bodies (IMC, chat, AMKA, evidence, AI studio). */
export function marketingWebSearchApiFields(
	quality: MarketingWebSearchQuality
): {
	web_search_quality: MarketingWebSearchQuality;
	use_web_search: boolean;
	max_tokens: number;
} {
	const max_tokens = 2500;
	if (quality === 'off') {
		return {
			web_search_quality: 'off',
			use_web_search: false,
			max_tokens,
		};
	}
	return {
		web_search_quality: quality,
		use_web_search: true,
		max_tokens,
	};
}
