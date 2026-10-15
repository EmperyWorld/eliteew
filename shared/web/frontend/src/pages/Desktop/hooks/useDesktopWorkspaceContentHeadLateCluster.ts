/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave A1.1 late head cluster: clipboard through layout presets, sync chip, stale auto-recover.
 *
 * Invariants:
 * - Must not statically import useDesktopExpansionSettings or desktopExpansionSettings/*.
 *   Expansion stays on EMPTY defaults here; deferred runtime overlays live settings.
 *
 * Related:
 * - hooks/useDesktopWorkspaceContentHeadEarlyCluster.ts
 * - hooks/useDesktopWorkspaceContentHeadCluster.ts
 */

import * as React from 'react';
import { useDesktopClipboard } from './useDesktopClipboard';
import { useDesktopIconSelectionDismiss } from './useDesktopIconSelectionDismiss';
import { useDesktopWorkspaceAppLaunch } from './useDesktopWorkspaceAppLaunch';
import { useDesktopWorkspaceSettingsPerformanceForPanel } from './useDesktopWorkspaceSettingsPerformanceForPanel';
import { useDesktopStaleShellStateAutoRecover } from './useDesktopStaleShellStateAutoRecover';
import { useDesktopWorkspaceLayoutPresetActions } from './useDesktopWorkspaceLayoutPresetActions';
import { useDesktopWorkspaceShellCanvasSyncChip } from './useDesktopWorkspaceContentOrchestration';
import { useDesktopWorkspaceActiveSessionAndPerformance } from './useDesktopWorkspaceActiveSessionAndPerformance';
import { useMinimizedPersistentSurfaceApps } from './useDesktopWorkspaceVisualProfileBridge';
import { useDesktopWorkspaceShellPerformanceTrackingClusterInput } from './useDesktopWorkspaceShellPerformanceTrackingClusterInput';
import { useDesktopShellStatePipelineSync } from './useDesktopShellStatePipelineSync';
import {
	EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS,
	deferredExpansionPersistRefreshRef,
} from '../runtime/desktopDeferredExpansionSettings';
import type { WindowInitialPayload } from '../types/desktop.types';
import {
	buildDuplicateWindowOpenOptions,
	resolveDesktopItemForWindow,
} from '../utils/desktopWindowDuplicate';
import type { DesktopWorkspaceContentHeadEarlyClusterResult } from './useDesktopWorkspaceContentHeadEarlyCluster';

export function useDesktopWorkspaceContentHeadLateCluster(
	early: DesktopWorkspaceContentHeadEarlyClusterResult
) {
	const {
		appState,
		persistSubjectForQueue,
		items,
		installedAppIds,
		preferencesApp,
		refreshStorage,
		clearPersistPatchConflict,
		deferVisualPersistRef,
		setShowNF,
		commitItems,
		installedApps,
		storeApps,
		installedAppsLoading,
		showTaskSwitcher,
		showQuickSearch,
		setShowShortcutsHelp,
		showAppStore,
		selected,
		setSelected,
		setCtx,
		combinedDesktopPersistenceError,
		clipboard,
		clipboardAction,
		setClipboard,
		renamingId,
		setRenamingId,
		setShowCommandPalette,
		desktopSettingsActiveTab,
		setDesktopSettingsActiveTab,
		activeDesktopId,
		desktops,
		getWindowsOnDesktop,
		switchToDesktop,
		desktopToast,
		desktopVisualPreferences,
		withProfileUiSaveIndicator,
		updateDesktopVisualPreferences,
		windows,
		openWindow,
		closeWindow,
		minimizeWindow,
		focusWindow,
		snapWindow,
		minimizeAllWindows,
		resizeWindow,
		moveWindow,
		restoreWindows,
		updateWindowPayload,
		bringWindowsIntoWorkArea,
		handleWindowDragCommit,
		showDesktopWidget,
		reconcileWindowMembership,
		setMembershipPersistReady,
	} = early;
	const minimizedPersistentSurfaceApps =
		useMinimizedPersistentSurfaceApps(windows);

	const { copyItems, cutItems, pasteClipboard } = useDesktopClipboard({
		items,
		selected,
		clipboard,
		clipboardAction,
		commitItems,
		setSelected,
		setClipboard,
		setCtx,
		setRenamingId,
		setShowCommandPalette,
		setShowNF,
		setShowShortcutsHelp,
		minimizeAllWindows,
		renamingId,
	});

	useDesktopIconSelectionDismiss({
		selected,
		setSelected,
		renamingId,
	});

	const {
		handleOpenWindow,
		openDesktopAppByComponent,
		openSocialHubTab,
		desktopGafOpenActions,
	} = useDesktopWorkspaceAppLaunch({
		items,
		installedApps,
		installedAppIds,
		openWindow,
		storeApps,
		launchShellPage: appState.actions.setCurrentPage,
	});

	const mergeShellSettingsWindowPayload = React.useCallback(
		(patch: WindowInitialPayload) => {
			const w = windows.find((x) => x.appComponent === 'DesktopShellSettings');
			if (w) {
				updateWindowPayload(w.id, patch);
			}
		},
		[windows, updateWindowPayload]
	);

	const {
		currentDesktopWindows,
		isShellSettingsWindowOpen,
		openShellSettings,
		closeShellSettingsWindow,
		hasOpenStudioGUWindow,
		performance,
		activeDesktopWindow,
		activeDesktopWindowId,
		handleTaskbarWinClick,
		closeActiveDesktopWindow,
		settingsPerformanceForPanel,
		floatingWidgetPerformanceForCanvas,
		autoQuietWindowLoad,
	} = useDesktopWorkspaceActiveSessionAndPerformance({
		windows,
		activeDesktopId,
		getWindowsOnDesktop,
		focusWindow,
		closeWindow,
		minimizeWindow,
		setDesktopSettingsActiveTab,
		openDesktopAppByComponent,
		desktopSettingsActiveTab,
		mergeShellSettingsWindowPayload,
		showDesktopWidget,
	});
	const { trackedHandleWindowDragCommit } =
		useDesktopWorkspaceShellPerformanceTrackingClusterInput({
			recordShellAction: performance.recordShellAction,
			windowOps: {
				restoreWindows,
				handleWindowDragCommit,
			},
			overlayBurst: {
				showQuickSearch,
				showTaskSwitcher,
				showAppStore,
				currentDesktopWindowCount: currentDesktopWindows.length,
			},
			windowPersistence: {
				windows,
				desktops,
				activeDesktopId,
				installedApps,
				installedAppsLoading,
				storeApps,
				items,
				switchToDesktop,
				desktopToast,
				persistSubjectKey: persistSubjectForQueue,
				reconcileWindowMembership,
				onMembershipPersistReady: setMembershipPersistReady,
			},
		});

	const handleDuplicateWindow = React.useCallback(
		(windowId: string) => {
			const win = currentDesktopWindows.find(
				(candidate) => candidate.id === windowId
			);
			if (!win) return;
			const item = resolveDesktopItemForWindow(win, items);
			if (!item) return;
			handleOpenWindow(item, buildDuplicateWindowOpenOptions(win));
		},
		[currentDesktopWindows, handleOpenWindow, items]
	);

	const mergedSettingsPerformanceForPanel =
		useDesktopWorkspaceSettingsPerformanceForPanel({
			settingsPerformanceForPanel,
			preferencesApp,
			desktopReduceBackdropBlur:
				desktopVisualPreferences.desktop_reduce_backdrop_blur === true,
			deferVisualPersistRef,
			updateDesktopVisualPreferences,
			withProfileUiSaveIndicator,
		});

	const {
		layoutPresetApplyPrompt,
		setLayoutPresetApplyPrompt,
		executeApplyWindowLayoutPreset,
		applyWindowLayoutPreset,
		collectCurrentWorkspaceWindows,
		bringWindowIntoWorkAreaById,
		applyCuratedWorkspaceLayout,
	} = useDesktopWorkspaceLayoutPresetActions({
		currentDesktopWindows,
		windows,
		items,
		installedApps,
		activeDesktopId,
		handleOpenWindow,
		closeWindow,
		moveWindow,
		resizeWindow,
		bringWindowsIntoWorkArea,
		getWindowsOnDesktop,
		snapWindow,
	});

	const expansionSettings = EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS;

	const { phase: shellStatePipelinePhase, staleShellStateConflict } =
		useDesktopShellStatePipelineSync();

	const { canvasSyncPersistenceError, recoverStaleShellState } =
		useDesktopWorkspaceShellCanvasSyncChip({
			combinedDesktopPersistenceError,
			expansionError: null,
			staleShellStateConflict,
			refreshStorage,
			expansionRefresh: () => deferredExpansionPersistRefreshRef.current(),
			clearPersistPatchConflict,
		});

	useDesktopStaleShellStateAutoRecover();
	return {
		...early,
		minimizedPersistentSurfaceApps,
		copyItems,
		cutItems,
		pasteClipboard,
		handleOpenWindow,
		openDesktopAppByComponent,
		openSocialHubTab,
		desktopGafOpenActions,
		mergeShellSettingsWindowPayload,
		currentDesktopWindows,
		isShellSettingsWindowOpen,
		openShellSettings,
		closeShellSettingsWindow,
		hasOpenStudioGUWindow,
		performance,
		activeDesktopWindow,
		activeDesktopWindowId,
		handleTaskbarWinClick,
		closeActiveDesktopWindow,
		settingsPerformanceForPanel,
		floatingWidgetPerformanceForCanvas,
		autoQuietWindowLoad,
		trackedHandleWindowDragCommit,
		handleDuplicateWindow,
		mergedSettingsPerformanceForPanel,
		layoutPresetApplyPrompt,
		setLayoutPresetApplyPrompt,
		executeApplyWindowLayoutPreset,
		applyWindowLayoutPreset,
		collectCurrentWorkspaceWindows,
		bringWindowIntoWorkAreaById,
		applyCuratedWorkspaceLayout,
		expansionSettings,
		shellStatePipelinePhase,
		staleShellStateConflict,
		canvasSyncPersistenceError,
		recoverStaleShellState,
	};
}
