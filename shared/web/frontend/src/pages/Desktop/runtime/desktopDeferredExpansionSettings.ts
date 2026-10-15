/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable empty expansion settings for critical Desktop shell first paint.
 *
 * Invariants:
 * - Real expansion loads in DesktopDeferredExpansionRuntime after deferredRuntimeReady.
 * - Action methods are no-ops so pre-deferred launch handlers cannot mutate shell_state.
 *
 * Related:
 * - DesktopDeferredExpansionRuntime.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { DEFAULT_ASSISTANT_ACTIONS } from '../hooks/desktopExpansionSettings/constants';
import type { DesktopExpansionSettings } from '../types/desktopExpansion.types';
import { DEFAULT_WIDGET_SLOTS } from '../utils/desktopWidgetLayoutUtils';

const asyncNoop = async (): Promise<void> => {};

export const deferredExpansionPersistRefreshRef: {
	current: () => Promise<void>;
} = {
	current: asyncNoop,
};

export const EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS: DesktopExpansionSettings =
	{
		storageMap: [],
		workspaceProfiles: [],
		savedSessionSnapshotWindowCount: 0,
		windowLayoutPresets: [],
		widgetsLayout: {
			slots: DEFAULT_WIDGET_SLOTS,
			perWorkspace: false,
		},
		appCollections: [],
		contentShortcuts: [],
		assistantContextActions: DEFAULT_ASSISTANT_ACTIONS,
		visualStylePresets: [],
		isLoading: false,
		isSaving: false,
		error: null,
		addWorkspaceProfile: asyncNoop,
		addWorkspaceProfileFromOpenWindows: asyncNoop,
		addWorkspaceProfileFromTemplate: asyncNoop,
		addWorkspaceProfileFromSessionSnapshot: asyncNoop,
		patchWorkspaceProfile: asyncNoop,
		removeWorkspaceProfile: asyncNoop,
		addWindowLayoutPreset: asyncNoop,
		addWindowLayoutPresetFromCuratedTemplate: asyncNoop,
		addWindowLayoutPresetFromScenario: asyncNoop,
		removeWindowLayoutPreset: asyncNoop,
		applyWindowLayoutPreset: () => {},
		applyCuratedWorkspaceLayout: () => {},
		applyScenarioWorkspaceLayout: () => {},
		collectCurrentWorkspaceWindows: () => {},
		toggleWidgetSlot: asyncNoop,
		toggleWidgetSlotMode: asyncNoop,
		toggleWidgetsPerWorkspace: asyncNoop,
		reorderWidgetSlots: asyncNoop,
		moveWidgetSlotStep: asyncNoop,
		setWidgetSlotWorkspaceProfile: asyncNoop,
		setWidgetsPanelOffset: asyncNoop,
		setWidgetsSlotPlacement: asyncNoop,
		setWidgetSlotPosition: asyncNoop,
		nudgeAllWidgetSlotPositions: asyncNoop,
		ensureFreeWidgetSlotPositions: asyncNoop,
		addAppCollection: asyncNoop,
		addAppCollectionFromTemplate: asyncNoop,
		removeAppCollection: asyncNoop,
		addContentShortcut: asyncNoop,
		addSavedFilterContentShortcut: asyncNoop,
		removeContentShortcut: asyncNoop,
		addVisualStylePreset: asyncNoop,
		removeVisualStylePreset: asyncNoop,
		toggleAssistantAction: asyncNoop,
		refresh: asyncNoop,
	};

export function desktopDeferredExpansionEqual(
	left: DesktopExpansionSettings,
	right: DesktopExpansionSettings
): boolean {
	if (left === right) return true;
	return (
		left.isLoading === right.isLoading &&
		left.isSaving === right.isSaving &&
		left.error === right.error &&
		left.savedSessionSnapshotWindowCount ===
			right.savedSessionSnapshotWindowCount &&
		left.storageMap === right.storageMap &&
		left.workspaceProfiles === right.workspaceProfiles &&
		left.windowLayoutPresets === right.windowLayoutPresets &&
		left.widgetsLayout === right.widgetsLayout &&
		left.appCollections === right.appCollections &&
		left.contentShortcuts === right.contentShortcuts &&
		left.assistantContextActions === right.assistantContextActions &&
		left.visualStylePresets === right.visualStylePresets
	);
}
