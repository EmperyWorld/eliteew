/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JTBD context menu positioning, sidebar layout callbacks, and modal close helpers.
 *
 * Related:
 * - useMarketingCabinetPageCompose.ts
 */

import { getFloatingMenuPosition } from '@/pages/Desktop/utils/desktopUi';
import {
	useCallback,
	useEffect,
	useMemo,
	type FocusEvent,
	type MutableRefObject,
} from 'react';
import type { MarketingJobStory } from '@/pages/MarketingCabinet/marketingCabinetApi';
import type { MarketingCabinetSidebarNavLayoutMode } from '@/pages/MarketingCabinet/shell/MarketingCabinetSidebar';

type UiCallbacksInput = {
	jtbdContextMenu: { x: number; y: number; job: MarketingJobStory } | null;
	setJtbdContextMenu: (v: null) => void;
	jtbdMenuRef: MutableRefObject<HTMLDivElement | null>;
	orgMutations: {
		deleteCompanyMutation: { isPending: boolean };
		deleteProjectMutation: { isPending: boolean };
	};
	contentMutations: {
		deleteJobStoryMutation: { isPending: boolean };
		deleteValuePropMutation: { isPending: boolean };
		deleteCompetitorMutation: { isPending: boolean };
		deleteResearchMutation: { isPending: boolean };
		deleteSwotMutation: { isPending: boolean };
	};
	setEditingJobStory: (v: null) => void;
	setEditingSwot: (v: null) => void;
	setEditingCompetitor: (v: null) => void;
	setDeleteModal: (v: null) => void;
	setSidebarNavLayoutMode: (
		updater: (
			prev: MarketingCabinetSidebarNavLayoutMode
		) => MarketingCabinetSidebarNavLayoutMode
	) => void;
	setIsSidebarHovered: (v: boolean) => void;
	setIsSidebarFocusWithin: (v: boolean) => void;
};

export function useMarketingCabinetPageUiCallbacks(input: UiCallbacksInput) {
	const {
		jtbdContextMenu,
		setJtbdContextMenu,
		jtbdMenuRef,
		orgMutations,
		contentMutations,
		setEditingJobStory,
		setEditingSwot,
		setEditingCompetitor,
		setDeleteModal,
		setSidebarNavLayoutMode,
		setIsSidebarHovered,
		setIsSidebarFocusWithin,
	} = input;

	const jtbdMenuPosition = useMemo(
		() =>
			jtbdContextMenu
				? getFloatingMenuPosition(
						{ x: jtbdContextMenu.x, y: jtbdContextMenu.y },
						{ menuWidth: 240, menuHeight: 268, padding: 12 }
					)
				: null,
		[jtbdContextMenu]
	);

	useEffect(() => {
		if (!jtbdContextMenu) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setJtbdContextMenu(null);
		};
		const onDown = (e: MouseEvent) => {
			if (jtbdMenuRef.current?.contains(e.target as Node)) return;
			setJtbdContextMenu(null);
		};
		document.addEventListener('keydown', onKey);
		document.addEventListener('mousedown', onDown, true);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('mousedown', onDown, true);
		};
	}, [jtbdContextMenu, jtbdMenuRef, setJtbdContextMenu]);

	const isDeletePending =
		orgMutations.deleteCompanyMutation.isPending ||
		orgMutations.deleteProjectMutation.isPending ||
		contentMutations.deleteJobStoryMutation.isPending ||
		contentMutations.deleteValuePropMutation.isPending ||
		contentMutations.deleteCompetitorMutation.isPending ||
		contentMutations.deleteResearchMutation.isPending ||
		contentMutations.deleteSwotMutation.isPending;

	const closeEditJobStory = useCallback(
		() => setEditingJobStory(null),
		[setEditingJobStory]
	);
	const closeEditSwot = useCallback(
		() => setEditingSwot(null),
		[setEditingSwot]
	);
	const closeEditCompetitor = useCallback(
		() => setEditingCompetitor(null),
		[setEditingCompetitor]
	);
	const closeDeleteModal = useCallback(
		() => setDeleteModal(null),
		[setDeleteModal]
	);

	const cycleSidebarNavLayout = useCallback(() => {
		setSidebarNavLayoutMode((prev) => {
			if (prev === 'floating') return 'pinned_expanded';
			if (prev === 'pinned_expanded') return 'icon_rail';
			setIsSidebarHovered(true);
			return 'floating';
		});
	}, [setIsSidebarHovered, setSidebarNavLayoutMode]);

	const handleSidebarBlurCapture = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			const nextTarget = event.relatedTarget;
			if (
				nextTarget instanceof Node &&
				event.currentTarget.contains(nextTarget)
			) {
				return;
			}
			setIsSidebarFocusWithin(false);
		},
		[setIsSidebarFocusWithin]
	);

	return {
		jtbdMenuPosition,
		isDeletePending,
		closeEditJobStory,
		closeEditSwot,
		closeEditCompetitor,
		closeDeleteModal,
		cycleSidebarNavLayout,
		handleSidebarBlurCapture,
	};
}
