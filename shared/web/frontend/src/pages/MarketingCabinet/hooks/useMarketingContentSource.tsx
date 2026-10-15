/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React context for shared toolbar document selection across MC sections.
 *
 * Related:
 * - MarketingCabinetPage.tsx, DocumentAutofillAction.tsx
 */
import * as React from 'react';
import { createContext, useContext } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { MarketingContentItem } from '../marketingCabinetApi';

export interface MarketingContentSourceValue {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	selectedContentId: string | null;
	setSelectedContentId: (next: string | null) => void;
	contentItems: MarketingContentItem[];
	selectedContent: MarketingContentItem | null;
	contentQuery: UseQueryResult<
		{ items: MarketingContentItem[]; total?: number },
		Error
	>;
	/** Enables deferred `listProjectContent` (toolbar / autofill). */
	engageToolbarContent?: () => void;
}

const MarketingContentSourceContext =
	createContext<MarketingContentSourceValue | null>(null);

export function MarketingContentSourceProvider({
	value,
	children,
}: {
	value: MarketingContentSourceValue;
	children: React.ReactNode;
}) {
	return (
		<MarketingContentSourceContext.Provider value={value}>
			{children}
		</MarketingContentSourceContext.Provider>
	);
}

export function useMarketingContentSource(): MarketingContentSourceValue | null {
	return useContext(MarketingContentSourceContext);
}
