/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Docked desktop widgets panel with composition slots (plan/agenda/notes/etc).
 *
 * Invariants:
 * - Panel mirrors shell/widget state, not separate domain stores.
 * - Enabled slots show live Kernel/Assistant projection, not placeholder launchers.
 *
 * Related:
 * - DesktopWorkspaceFloatingWidget.tsx
 * - NowPlayingContext.tsx
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

import { useLayoutEffect, useMemo } from 'react';
import type { DesktopWidgetsSlotPlacement } from '../../types/desktopExpansion.types';
import { useDesktopAssistantPlanProjection } from '../../hooks/useDesktopAssistantPlanProjection';
import { readDesktopWorkArea } from '../../utils/desktopSnapGeometry';
import {
	computeInitialFreeSlotPositions,
	filterDesktopWidgetSlots,
} from '../../utils/desktopWidgetLayoutUtils';
import { FreeWidgetsPanelLayout } from './FreeWidgetsPanelLayout';
import { StackedWidgetsPanelLayout } from './StackedWidgetsPanelLayout';
import type { DesktopWidgetsPanelProps } from './types';
import { useDesktopWidgetsPanelDrag } from './useDesktopWidgetsPanelDrag';
import { useWidgetWorkAreaVersion } from './useWidgetWorkAreaVersion';
import { resolveWidgetPanelChrome } from './widgetPanelChrome';

export function DesktopWidgetsPanel(props: DesktopWidgetsPanelProps) {
	const {
		widgetsLayout,
		workspaceProfiles,
		activeDesktopId,
		panelPosition,
		compactWidgetsGlobal,
		widgetsStyle,
		panelOffset,
		onPanelOffsetCommit,
		onSlotPositionCommit,
		onAllWidgetSlotsOffsetCommit,
		onEnsureFreeSlotPositions,
	} = props;

	const slotPlacement: DesktopWidgetsSlotPlacement =
		props.tourPreview === true
			? 'stacked'
			: widgetsLayout.slotPlacement === 'free'
				? 'free'
				: 'stacked';
	const workAreaVersion = useWidgetWorkAreaVersion();

	const drag = useDesktopWidgetsPanelDrag({
		panelOffset,
		onPanelOffsetCommit,
		onSlotPositionCommit,
		onAllWidgetSlotsOffsetCommit,
	});

	const fallbackPos = useMemo(() => {
		void workAreaVersion;
		const work = readDesktopWorkArea();
		return computeInitialFreeSlotPositions(
			widgetsLayout.slots,
			panelPosition,
			work.width,
			work.height,
			panelOffset,
			compactWidgetsGlobal
		);
	}, [
		widgetsLayout.slots,
		panelPosition,
		panelOffset,
		compactWidgetsGlobal,
		workAreaVersion,
	]);

	const slots = useMemo(
		() =>
			filterDesktopWidgetSlots(
				widgetsLayout,
				activeDesktopId,
				workspaceProfiles
			),
		[widgetsLayout, activeDesktopId, workspaceProfiles]
	);

	useLayoutEffect(() => {
		if (slotPlacement !== 'free' || !onEnsureFreeSlotPositions) return;
		if (!widgetsLayout.slots.some((s) => s.enabled && s.position == null)) {
			return;
		}
		void onEnsureFreeSlotPositions();
	}, [slotPlacement, widgetsLayout.slots, onEnsureFreeSlotPositions]);

	const chrome = resolveWidgetPanelChrome(widgetsStyle);
	const needsAssistantPlan = slots.some(
		(slot) => slot.type === 'assistant-plan' || slot.type === 'agenda'
	);
	const assistantPlan = useDesktopAssistantPlanProjection({
		enabled: needsAssistantPlan,
	});

	if (slots.length === 0) return null;

	const layoutSlots =
		assistantPlan.visibility === 'hide-disabled'
			? slots.filter(
					(slot) => slot.type !== 'assistant-plan' && slot.type !== 'agenda'
				)
			: slots;
	if (layoutSlots.length === 0) return null;

	const layoutScale = readDesktopWorkArea().layoutScale;

	const slotBodyProps = {
		compactWidgetsGlobal: props.compactWidgetsGlobal,
		appCollections: props.appCollections,
		contentShortcuts: props.contentShortcuts,
		recentOpened: props.recentOpened,
		desktopUnreadCount: props.desktopUnreadCount,
		markAllAsRead: props.markAllAsRead,
		onOpenNotificationCenter: props.onOpenNotificationCenter,
		onOpenEwDesk: props.onOpenEwDesk,
		onOpenMusicPlayer: props.onOpenMusicPlayer,
		onOpenContentShortcut: props.onOpenContentShortcut,
		onOpenAppCollection: props.onOpenAppCollection,
		onOpenRecentFile: props.onOpenRecentFile,
		onOpenWidgetSlotExpanded: props.onOpenWidgetSlotExpanded,
		assistantPlan,
	};

	if (slotPlacement === 'free') {
		return (
			<FreeWidgetsPanelLayout
				slots={layoutSlots}
				fallbackPos={fallbackPos}
				layoutScale={layoutScale}
				chrome={chrome}
				onAllWidgetSlotsOffsetCommit={onAllWidgetSlotsOffsetCommit}
				onSlotPositionCommit={onSlotPositionCommit}
				onOpenEwDesk={props.onOpenEwDesk}
				onOpenMusicPlayer={props.onOpenMusicPlayer}
				freeStripDrag={drag.freeStripDrag}
				slotDragLive={drag.slotDragLive}
				handleFreeStripPointerDown={drag.handleFreeStripPointerDown}
				handleFreeStripPointerMove={drag.handleFreeStripPointerMove}
				handleFreeStripPointerUp={drag.handleFreeStripPointerUp}
				handleFreeStripPointerCancel={drag.handleFreeStripPointerCancel}
				handleSlotDragPointerDown={drag.handleSlotDragPointerDown}
				handleSlotDragPointerMove={drag.handleSlotDragPointerMove}
				handleSlotDragPointerUp={drag.handleSlotDragPointerUp}
				handleSlotDragPointerCancel={drag.handleSlotDragPointerCancel}
				slotBodyProps={slotBodyProps}
			/>
		);
	}

	return (
		<StackedWidgetsPanelLayout
			slots={layoutSlots}
			panelPosition={panelPosition}
			onPanelOffsetCommit={onPanelOffsetCommit}
			onOpenEwDesk={props.onOpenEwDesk}
			onOpenMusicPlayer={props.onOpenMusicPlayer}
			rootRef={drag.rootRef}
			panelTranslate={drag.panelTranslate}
			handlePanelDragPointerDown={drag.handlePanelDragPointerDown}
			handlePanelDragPointerMove={drag.handlePanelDragPointerMove}
			handlePanelDragPointerUp={drag.handlePanelDragPointerUp}
			handlePanelDragPointerCancel={drag.handlePanelDragPointerCancel}
			chrome={chrome}
			slotBodyProps={slotBodyProps}
		/>
	);
}
