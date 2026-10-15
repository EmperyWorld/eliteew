import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

import type { MarketingView } from '../constants';

export function useMarketingCabinetOverviewNavigate({
	allowedSidebarViewIds,
	setActiveView,
	setFocusedEntityId,
	contentScrollRef,
	activeView,
	focusedEntityId,
}: {
	allowedSidebarViewIds: ReadonlySet<MarketingView>;
	setActiveView: (view: MarketingView) => void;
	setFocusedEntityId: (id: string | null) => void;
	contentScrollRef: RefObject<HTMLElement | null>;
	activeView: MarketingView;
	focusedEntityId: string | null;
}) {
	const handleOverviewNavigate = useCallback(
		(
			view: MarketingView,
			entityId?: string | null,
			extras?: { urlQuery?: Record<string, string | null | undefined> }
		) => {
			if (typeof window !== 'undefined' && extras?.urlQuery) {
				const url = new URL(window.location.href);
				for (const [k, v] of Object.entries(extras.urlQuery)) {
					if (v != null && String(v).trim() !== '') {
						url.searchParams.set(k, String(v).trim());
					} else {
						url.searchParams.delete(k);
					}
				}
				window.history.replaceState({}, '', url.toString());
			}
			if (!allowedSidebarViewIds.has(view)) {
				setFocusedEntityId(null);
				setActiveView('overview');
				return;
			}
			setFocusedEntityId(entityId ?? null);
			setActiveView(view);
			contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		},
		[
			allowedSidebarViewIds,
			setActiveView,
			setFocusedEntityId,
			contentScrollRef.current?.scrollTo,
		]
	);

	useEffect(() => {
		if (activeView !== 'analysis' || !focusedEntityId) return;
		const timer = window.setTimeout(() => {
			const element = document.querySelector(
				`[data-marketing-entity-id="${focusedEntityId}"]`
			);
			if (element instanceof HTMLElement) {
				element.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}, 120);
		return () => window.clearTimeout(timer);
	}, [activeView, focusedEntityId]);

	return { handleOverviewNavigate };
}
