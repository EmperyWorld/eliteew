/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ accordion open ids with auto-expand first match when search is active.
 *
 * Invariants:
 * - Empty search clears all open ids; non-empty search opens at most the first match.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - AssistantFaqPanel.tsx
 */
import * as React from 'react';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';

export type UseAssistantFaqSearchAccordionInput = {
	faqSearch: string;
	filteredFaq: AssistantFaqEntry[];
};

export function useAssistantFaqSearchAccordion({
	faqSearch,
	filteredFaq,
}: UseAssistantFaqSearchAccordionInput) {
	const [openFaqIds, setOpenFaqIds] = React.useState<Set<string>>(new Set());

	React.useEffect(() => {
		const q = faqSearch.trim();
		if (!q) {
			setOpenFaqIds(new Set());
			return;
		}
		const first = filteredFaq[0];
		setOpenFaqIds(first ? new Set([first.id]) : new Set());
	}, [faqSearch, filteredFaq]);

	return { openFaqIds, setOpenFaqIds };
}
