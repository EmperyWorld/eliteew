/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React context for global marketing-cabinet web search quality (toolbar → all AI surfaces).
 *
 * Invariants:
 * - Quality persists in localStorage; default off.
 *
 * Related:
 * - marketingWebSearchQuality.ts
 * - MarketingWebSearchQualitySelect.tsx
 */
import * as React from 'react';
import {
	type MarketingWebSearchQuality,
	readStoredMarketingWebSearchQuality,
	writeStoredMarketingWebSearchQuality,
} from '../marketingWebSearchQuality';

const MarketingWebSearchQualityContext = React.createContext<{
	quality: MarketingWebSearchQuality;
	setQuality: (value: MarketingWebSearchQuality) => void;
} | null>(null);

export function MarketingWebSearchQualityProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [quality, setQualityState] = React.useState<MarketingWebSearchQuality>(
		readStoredMarketingWebSearchQuality
	);
	const setQuality = React.useCallback((value: MarketingWebSearchQuality) => {
		setQualityState(value);
		writeStoredMarketingWebSearchQuality(value);
	}, []);
	const value = React.useMemo(
		() => ({ quality, setQuality }),
		[quality, setQuality]
	);
	return (
		<MarketingWebSearchQualityContext.Provider value={value}>
			{children}
		</MarketingWebSearchQualityContext.Provider>
	);
}

export function useMarketingWebSearchQuality(): {
	quality: MarketingWebSearchQuality;
	setQuality: (value: MarketingWebSearchQuality) => void;
} {
	const ctx = React.useContext(MarketingWebSearchQualityContext);
	if (!ctx) {
		throw new Error(
			'useMarketingWebSearchQuality must be used within MarketingWebSearchQualityProvider'
		);
	}
	return ctx;
}
