/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23: memoized deferred runtime inputs bundle for TailCluster.
 *
 * Related:
 * - utils/desktopWorkspaceDeferredRuntimeInputs.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 */

import * as React from 'react';
import type { DesktopWorkspaceExpansionLaunchActions } from '../types/desktopWorkspaceExpansionLaunchActions.types';
import type { DesktopWorkspaceExpansionLaunchActionsInput } from '../types/desktopWorkspaceExpansionLaunchActions.types';
import type { DesktopWorkspaceContentHeadClusterResult } from './useDesktopWorkspaceContentHeadCluster';
import {
	buildDesktopWorkspaceDeferredRuntimeInputsBundle,
	type DesktopWorkspaceDeferredRuntimeInputsBundle,
} from '../utils/desktopWorkspaceDeferredRuntimeInputs';

export type DesktopWorkspaceDeferredRuntimeInputsClusterParts = {
	head: Pick<
		DesktopWorkspaceContentHeadClusterResult,
		| 'items'
		| 'installedApps'
		| 'currentDesktopWindows'
		| 'activeDesktopId'
		| 'applyWindowLayoutPreset'
		| 'collectCurrentWorkspaceWindows'
		| 'applyCuratedWorkspaceLayout'
		| 'config'
		| 'isOnline'
		| 'authUser'
		| 'isMobile'
		| 'selected'
		| 'activeDesktopWindow'
		| 'windowsRef'
		| 'desktops'
		| 'activeDesktopWindowId'
		| 'windows'
		| 'focusWindow'
		| 'handleOpenWindow'
		| 'setShowNF'
		| 'minimizeAllWindows'
		| 'closeWindow'
		| 'closeActiveDesktopWindow'
		| 'setShowCommandPalette'
		| 'displayItems'
		| 'desktopVisualPreferences'
		| 'bumpNotificationCenterOpen'
		| 'openDesktopAppByComponent'
	>;
	expansionLaunchActionsFullInput: DesktopWorkspaceExpansionLaunchActionsInput;
	expansionLaunch: Pick<
		DesktopWorkspaceExpansionLaunchActions,
		'openContentShortcut' | 'openAppCollection' | 'openRecentDesktopFile'
	>;
};

export function useDesktopWorkspaceDeferredRuntimeInputsCluster(
	parts: DesktopWorkspaceDeferredRuntimeInputsClusterParts
): DesktopWorkspaceDeferredRuntimeInputsBundle {
	const { head, expansionLaunchActionsFullInput, expansionLaunch } = parts;

	return React.useMemo(
		() =>
			buildDesktopWorkspaceDeferredRuntimeInputsBundle({
				expansionLaunchActionsInput: expansionLaunchActionsFullInput,
				expansion: {
					items: head.items,
					installedApps: head.installedApps,
					currentDesktopWindows: head.currentDesktopWindows,
					activeDesktopId: head.activeDesktopId,
					onApplyWindowLayoutPreset: head.applyWindowLayoutPreset,
					onCollectCurrentWorkspaceWindows: head.collectCurrentWorkspaceWindows,
					onApplyCuratedWorkspaceLayout: head.applyCuratedWorkspaceLayout,
					widgetsPanelPositionRaw: head.config?.widgets_panel_position,
					compactWidgetsGlobal: head.config?.compact_widgets,
					isOnline: head.isOnline,
					persistSubjectKey: head.authUser?.id ?? null,
				},
				companion: {
					isMobile: head.isMobile,
					items: head.items,
					selected: head.selected,
					activeDesktopWindow: head.activeDesktopWindow,
					windowsRef: head.windowsRef,
					desktops: head.desktops,
					activeDesktopId: head.activeDesktopId,
					activeDesktopWindowId: head.activeDesktopWindowId,
				},
				voice: {
					items: head.items,
					windows: head.windows,
					currentDesktopWindows: head.currentDesktopWindows,
					activeWindowId: head.activeDesktopWindowId,
					focusWindow: head.focusWindow,
					handleOpenWindow: head.handleOpenWindow,
					setShowNF: head.setShowNF,
					minimizeAllWindows: head.minimizeAllWindows,
					closeWindow: head.closeWindow,
					closeActiveWindow: head.closeActiveDesktopWindow,
					setShowCommandPalette: head.setShowCommandPalette,
				},
				shellExtras: {
					displayItems: head.displayItems,
					allDesktopItems: head.items,
					installedApps: head.installedApps,
					authUserId: head.authUser?.id,
					isMobile: head.isMobile,
					config: head.config,
					activeDesktopId: head.activeDesktopId,
					desktopWidgetsStyle:
						head.desktopVisualPreferences.desktop_widgets_style,
					bumpNotificationCenterOpen: head.bumpNotificationCenterOpen,
					openDesktopAppByComponent: head.openDesktopAppByComponent,
					openContentShortcut: expansionLaunch.openContentShortcut,
					openAppCollection: expansionLaunch.openAppCollection,
					openRecentDesktopFile: expansionLaunch.openRecentDesktopFile,
				},
			}),
		[
			expansionLaunch.openAppCollection,
			expansionLaunch.openContentShortcut,
			expansionLaunch.openRecentDesktopFile,
			expansionLaunchActionsFullInput,
			head.activeDesktopId,
			head.activeDesktopWindow,
			head.activeDesktopWindowId,
			head.applyCuratedWorkspaceLayout,
			head.applyWindowLayoutPreset,
			head.authUser?.id,
			head.bumpNotificationCenterOpen,
			head.closeActiveDesktopWindow,
			head.closeWindow,
			head.collectCurrentWorkspaceWindows,
			head.config,
			head.currentDesktopWindows,
			head.desktops,
			head.desktopVisualPreferences.desktop_widgets_style,
			head.displayItems,
			head.focusWindow,
			head.handleOpenWindow,
			head.installedApps,
			head.isMobile,
			head.isOnline,
			head.items,
			head.minimizeAllWindows,
			head.openDesktopAppByComponent,
			head.selected,
			head.setShowCommandPalette,
			head.setShowNF,
			head.windows,
			head.windowsRef,
		]
	);
}
