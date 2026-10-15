/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ split layout ref, session-persisted mobile panel open state, compact-width collapse.
 *
 * Invariants:
 * - Mobile embedded handbook starts collapsed; suggested FAQ chips show when panel closed.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - readInitialAssistantFaqOpen.ts
 * - assistantChatConstants.ts ASSISTANT_COMPACT_SPLIT_WIDTH_PX
 */
import * as React from 'react';
import { ASSISTANT_COMPACT_SPLIT_WIDTH_PX } from './assistantChatConstants';
import {
	persistAssistantFaqOpen,
	readInitialAssistantFaqOpen,
} from './readInitialAssistantFaqOpen';

export type UseAssistantResponsiveFaqLayoutInput = {
	embeddedMobileLayout: boolean;
};

export function useAssistantResponsiveFaqLayout({
	embeddedMobileLayout,
}: UseAssistantResponsiveFaqLayoutInput) {
	const layoutRootRef = React.useRef<HTMLDivElement | null>(null);
	const [faqMobileOpen, setFaqMobileOpenState] = React.useState(() =>
		readInitialAssistantFaqOpen(embeddedMobileLayout)
	);

	const setFaqMobileOpen = React.useCallback(
		(value: boolean | ((prev: boolean) => boolean)) => {
			setFaqMobileOpenState((prev) => {
				const next = typeof value === 'function' ? value(prev) : value;
				persistAssistantFaqOpen(next);
				return next;
			});
		},
		[]
	);

	React.useEffect(() => {
		if (embeddedMobileLayout) return;
		const el = layoutRootRef.current;
		if (!el) return;
		const ro = new ResizeObserver(([entry]) => {
			if (entry.contentRect.width < ASSISTANT_COMPACT_SPLIT_WIDTH_PX) {
				setFaqMobileOpen(false);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [embeddedMobileLayout, setFaqMobileOpen]);

	const showSuggestedFaqChips = embeddedMobileLayout ? !faqMobileOpen : false;

	return {
		layoutRootRef,
		faqMobileOpen,
		setFaqMobileOpen,
		showSuggestedFaqChips,
	};
}
