/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * IntersectionObserver anchors for EWRP presentations tab — status panel and slide editor visibility.
 *
 * Invariants:
 * - When observation is disabled, visibility defaults to true (CTAs stay hidden by other gates).
 *
 * Related:
 * - `useEwrpAnchorVisibility.ts`, `EWRPGeneratorMain.tsx`
 */

import { useRef } from 'react';
import { useEwrpAnchorVisibility } from './useEwrpAnchorVisibility';

export type UseEwrpPresentationsScrollTargetsArgs = {
	statusObserverEnabled: boolean;
	editorObserverEnabled: boolean;
};

/** Refs and viewport visibility for presentations scroll-to-status/editor affordances. */
export function useEwrpPresentationsScrollTargets(
	args: UseEwrpPresentationsScrollTargetsArgs
) {
	const statusPanelAnchorRef = useRef<HTMLDivElement | null>(null);
	const slideEditorAnchorRef = useRef<HTMLDivElement | null>(null);

	const statusPanelVisible = useEwrpAnchorVisibility(statusPanelAnchorRef, {
		enabled: args.statusObserverEnabled,
	});

	const slideEditorPanelVisible = useEwrpAnchorVisibility(
		slideEditorAnchorRef,
		{
			enabled: args.editorObserverEnabled,
		}
	);

	return {
		statusPanelAnchorRef,
		slideEditorAnchorRef,
		statusPanelVisible,
		slideEditorPanelVisible,
	};
}
