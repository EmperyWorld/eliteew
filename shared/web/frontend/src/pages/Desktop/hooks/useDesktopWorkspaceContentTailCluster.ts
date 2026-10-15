/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave A1.1 tail hook cluster for DesktopWorkspaceContent: launch/lifecycle through
 * layout bridge assembly, modals slots, companion rail. Settings Integration Bundle
 * sources via Wave 21 FromHead; Shell Nav AppProps input via Wave 22
 * `buildDesktopWorkspaceShellNavAppPropsClusterInputFromTailParts`; layout
 * assembly FromTail + deferred runtime builders via Wave 23.
 *
 * Invariants:
 * - Must not statically import useDesktopExpansionSettings, desktopExpansionSettings/*,
 *   or useDesktopWorkspaceContentOrchestration (companion rail defers to runtime).
 * - Widgets panel props come from deferred extras context (null until runtime).
 *
 * Related:
 * - DesktopWorkspaceContent.tsx
 * - hooks/useDesktopWorkspaceContentHeadCluster.ts
 * - utils/desktopWorkspaceSettingsIntegrationBundleSources.ts
 * - utils/desktopWorkspaceShellNavAppPropsClusterInput.ts
 * - utils/desktopWorkspaceShellLayoutInputAssemblyFromTail.ts
 * - utils/desktopWorkspaceDeferredRuntimeInputs.ts
 * - hooks/useDesktopWorkspaceExpansionLaunchActionsFromParts.ts
 * - hooks/useDesktopWorkspaceDeferredRuntimeInputsCluster.ts
 * - runtime/DesktopDeferredShellExtrasRuntime.tsx
 */

import * as React from 'react';
import { useRef } from 'react';
import type { DesktopItem } from '../types/desktop.types';
import { useDesktopAppLifecycle } from './useDesktopAppLifecycle';
import { useDesktopWorkspaceAppStoreLayerState } from './useDesktopWorkspaceAppStoreLayerState';
import { useDesktopWorkspaceShellLaunchCluster } from './useDesktopWorkspaceShellLaunchCluster';
import { useDesktopWorkspaceSettingsIntegrationBundle } from './useDesktopWorkspaceSettingsIntegrationBundle';
import { buildDesktopWorkspaceSettingsIntegrationBundleSourcesFromHead } from '../utils/desktopWorkspaceSettingsIntegrationBundleSources';
import { useDesktopWorkspaceSurfaceChromeBundle } from './useDesktopWorkspaceSurfaceChromeBundle';
import { buildDesktopWorkspaceMainSurfaceStyle } from './useDesktopWorkspaceMainSurfaceEffects';
import { useDesktopWorkspaceItemOperations } from './useDesktopWorkspaceItemOperations';
import { useDesktopShellSettingsScrollBridge } from './useDesktopShellSettingsScrollBridge';
import { useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster } from './useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster';
import { buildDesktopWorkspaceShellNavAppPropsClusterInputFromTailParts } from '../utils/desktopWorkspaceShellNavAppPropsClusterInput';
import { useDesktopWorkspaceContentDropHandlers } from './useDesktopWorkspaceContentDropHandlers';
import { useDesktopWorkspaceShellLayoutInputAssembly } from './useDesktopWorkspaceShellLayoutInputAssembly';
import { buildDesktopWorkspaceShellLayoutInputAssemblySourcesFromTailClusters } from '../utils/desktopWorkspaceShellLayoutInputAssemblyFromTail';
import { useDesktopWorkspaceShellModalsAndLayoutSlotsCluster } from './useDesktopWorkspaceShellModalsAndLayoutSlotsCluster';
import { useDesktopWorkspaceShellLayoutRootCluster } from './useDesktopWorkspaceShellLayoutRootCluster';
import { buildDesktopWorkspaceShellLayoutRootClusterParams } from '../utils/desktopWorkspaceShellLayoutRootClusterParams';
import { useDesktopWorkspaceExpansionLaunchActionsFromParts } from './useDesktopWorkspaceExpansionLaunchActionsFromParts';
import { useDesktopWorkspaceDeferredRuntimeInputsCluster } from './useDesktopWorkspaceDeferredRuntimeInputsCluster';
import type { DesktopWorkspaceContentHeadClusterResult } from './useDesktopWorkspaceContentHeadCluster';

export function useDesktopWorkspaceContentTailCluster(
	head: DesktopWorkspaceContentHeadClusterResult
) {
	const {
		appState,
		config,
		items,
		createFolderAPI,
		updateFolderIcon,
		createMarkdownFile,
		refreshStorage,
		iconSize,
		gridStep,
		t,
		tAppStore,
		workspaceShellCss,
		wallpaper,
		showWP,
		setShowWP,
		showNF,
		setShowNF,
		effectiveTheme,
		desktopThemeVars,
		deleteItem,
		commitItems,
		installedApps,
		storeApps,
		installApp,
		uninstallApp,
		installedAppIds,
		desktopAreaRef,
		appStoreDetailId,
		setAppStoreDetailId,
		closeAppStoreModal,
		openAppStore,
		selected,
		addRecentFile,
		isDraggingIcon,
		groupDragState,
		propertiesItem,
		setPropertiesItem,
		activeDesktopId,
		switchToDesktop,
		updateDesktopWallpaper,
		recordRecentAppOnVirtualDesktop,
		desktopToast,
		desktopVisualPreferences,
		desktopIconStyle,
		desktopWindowStyle,
		desktopUiScale,
		shellMotionPrefs,
		windows,
		closeWindow,
		updateWindowPayload,
		handleOpenWindow,
		openDesktopAppByComponent,
		desktopGafOpenActions,
		currentDesktopWindows,
		hasOpenStudioGUWindow,
		performance,
		activeDesktopWindow,
		expansionSettings,
		layoutPresetApplyPrompt,
		setLayoutPresetApplyPrompt,
		executeApplyWindowLayoutPreset,
		combinedDesktopPersistenceError,
		clearPersistPatchConflict,
		staleShellStateConflict,
	} = head;

	const { expansionLaunchActionsFullInput, expansionLaunch } =
		useDesktopWorkspaceExpansionLaunchActionsFromParts({
			items,
			installedApps,
			selected,
			activeDesktopId,
			activeDesktopWindow,
			windows,
			expansion: {
				workspaceProfiles: expansionSettings.workspaceProfiles,
				appCollections: expansionSettings.appCollections,
				contentShortcuts: expansionSettings.contentShortcuts,
				assistantContextActions: expansionSettings.assistantContextActions,
			},
			handleOpenWindow,
			openDesktopAppByComponent,
			switchToDesktop,
			updateDesktopWallpaper,
			recordRecentAppOnVirtualDesktop,
			addRecentFile,
			propertiesItem,
			setPropertiesItem,
			t,
		});

	const { handleInstallApp, handleUninstallApp, pinAppShortcutToDesktop } =
		useDesktopAppLifecycle({
			items,
			installedApps,
			storeApps,
			installedAppIds,
			gridStep,
			windows,
			installApp,
			uninstallApp,
			commitItems,
			closeWindow,
		});

	const {
		appStoreDetailFromStore,
		clearAppStoreDetail,
		handleAppStoreLayerError,
		handleAppStoreLayerSuccess,
		handleAppStoreLayerOpenInstalled,
	} = useDesktopWorkspaceAppStoreLayerState({
		appStoreDetailId,
		setAppStoreDetailId,
		storeApps,
		tAppStore,
		toast: desktopToast,
		openDesktopAppByComponent,
		closeAppStoreModal,
	});

	const {
		unifiedAdminDesktopItem,
		handlePinAppFromStartMenu,
		handleUnpinAppFromStartMenu,
		openAppStoreAsWindow,
	} = useDesktopWorkspaceShellLaunchCluster({
		items,
		handleOpenWindow,
		openAppStore,
		pinAppShortcutToDesktop,
		deleteItem,
		currentPage: appState.state.currentPage,
		setCurrentPage: appState.actions.setCurrentPage,
	});

	const {
		shellClusterRest,
		surfaceChromeBundleInput,
		mainSurfaceWallpaper,
		activeVirtualDesktopShell,
	} = useDesktopWorkspaceSettingsIntegrationBundle(
		buildDesktopWorkspaceSettingsIntegrationBundleSourcesFromHead(head, {
			handlePinAppFromStartMenu,
			openAppStoreAsWindow,
		})
	);

	const {
		accentRgb,
		openWallpaperFromDesktopSettings,
		handleWallpaperChange,
		handleRemoveUserWallpaper,
		shellSettingsBridge: shellSettingsBridgeBase,
	} = useDesktopWorkspaceSurfaceChromeBundle({
		...surfaceChromeBundleInput,
		shellClusterRest,
	});

	const newFolderDialogRef = useRef<{
		parentId?: string;
		onCreated?: (folder: DesktopItem) => void;
	}>({});

	const onCloseNewFolder = React.useCallback(() => {
		newFolderDialogRef.current = {};
		setShowNF(false);
	}, [setShowNF]);

	const {
		editFolderIconTarget,
		handleCreateFolderForDialog,
		openEditFolderIconDialog,
		openDesktopItemProperties,
		onCloseEditFolderIcon,
		handleSaveFolderIcon,
		openNewFolderDialog,
		createMarkdownFileInFolder,
		liftDesktopItemsToRoot,
		liftDesktopItemsOneLevel,
		moveDesktopNestedItemsToFolder,
		renameDesktopItem,
		deleteDesktopItems,
	} = useDesktopWorkspaceItemOperations({
		commitItems,
		createFolder: createFolderAPI,
		createMarkdownFile,
		desktopToast,
		newFolderDialogRef,
		openDesktopAppByComponent,
		setPropertiesItem,
		setShowNF,
		t,
		updateFolderIcon,
	});

	const shellSettingsBridge = useDesktopShellSettingsScrollBridge(
		shellSettingsBridgeBase,
		{ windows, updateWindowPayload }
	);

	const desktopMainSurfaceStyle = buildDesktopWorkspaceMainSurfaceStyle({
		accentRgb,
		desktopThemeVars,
		effectiveTheme,
		wallpaper: mainSurfaceWallpaper,
		desktopFontBody: desktopVisualPreferences.desktop_font_body,
		desktopFontDisplay: desktopVisualPreferences.desktop_font_display,
		desktopSceneDepth: desktopVisualPreferences.desktop_scene_depth,
		wallpaperCrossfadeEnabled:
			desktopVisualPreferences.desktop_wallpaper_crossfade_enabled !== false,
		styledTooltips: desktopVisualPreferences.desktop_styled_tooltips !== false,
	});

	const { appPropsValue, openVoiceCommandCenter } =
		useDesktopWorkspaceShellNavAppPropsAndSideEffectsCluster(
			buildDesktopWorkspaceShellNavAppPropsClusterInputFromTailParts(head, {
				liftDesktopItemsToRoot,
				liftDesktopItemsOneLevel,
				moveDesktopNestedItemsToFolder,
				renameDesktopItem,
				deleteDesktopItems,
				openNewFolderDialog,
				createMarkdownFileInFolder,
				openEditFolderIconDialog,
				openDesktopItemProperties,
			})
		);

	const appStoreDesktopShortcutIds = React.useMemo(
		() => items.filter((i) => i.type === 'app' && !i.parentId).map((i) => i.id),
		[items]
	);

	const {
		onBackgroundContentDragOver,
		onBackgroundContentDrop,
		onExternalContentDropToFolder,
	} = useDesktopWorkspaceContentDropHandlers({
		items,
		iconSize,
		gridStep,
		commitItems,
		desktopToast,
		t,
		liftDesktopItemsToRoot,
		moveDesktopNestedItemsToFolder,
	});

	const desktopWidgetsPanelProps = null;

	const shellModalsLayoutClusterParams =
		useDesktopWorkspaceShellLayoutInputAssembly(
			buildDesktopWorkspaceShellLayoutInputAssemblySourcesFromTailClusters(
				head,
				{
					desktopWidgetsPanelProps,
					drop: {
						onBackgroundContentDragOver,
						onBackgroundContentDrop,
						onExternalContentDropToFolder,
					},
					expansionLaunch,
					shellLaunch: {
						handlePinAppFromStartMenu,
						handleUnpinAppFromStartMenu,
						openAppStoreAsWindow,
						unifiedAdminDesktopItem,
					},
					appStore: {
						appStoreDetailFromStore,
						clearAppStoreDetail,
						handleAppStoreLayerError,
						handleAppStoreLayerSuccess,
						handleAppStoreLayerOpenInstalled,
						handleInstallApp,
						handleUninstallApp,
						appStoreDesktopShortcutIds,
					},
					chrome: {
						openVoiceCommandCenter,
						openWallpaperFromDesktopSettings,
						handleWallpaperChange,
						handleRemoveUserWallpaper,
						onCloseNewFolder,
						handleCreateFolderForDialog,
						openEditFolderIconDialog,
					},
				}
			)
		);

	const {
		shellModalsProps,
		shellCanvasProps,
		windowContextMenuProps,
		windowLayerProps,
		shellTaskbarProps,
		shellSearchOverlaysProps,
		helpAndSessionProps,
		appStoreLayerProps,
	} = useDesktopWorkspaceShellModalsAndLayoutSlotsCluster(
		shellModalsLayoutClusterParams
	);

	const shellLayoutRootProps = useDesktopWorkspaceShellLayoutRootCluster(
		buildDesktopWorkspaceShellLayoutRootClusterParams({
			openVoiceCommandCenter,
			t,
			workspaceShellCss,
			desktopAreaRef,
			effectiveTheme,
			desktopMainSurfaceStyle,
			isDraggingIcon,
			groupDragState,
			desktopWindowStyle,
			shellSettingsBridge,
			desktopUiScale,
			hasOpenStudioGUWindow,
			activeVirtualDesktopId: activeVirtualDesktopShell.id,
			activeVirtualDesktopName: activeVirtualDesktopShell.name,
		})
	);

	const {
		expansionLaunchActionsInput,
		deferredExpansionInput,
		deferredCompanionInput,
		deferredVoiceCommandsInput,
		deferredShellExtrasInput,
	} = useDesktopWorkspaceDeferredRuntimeInputsCluster({
		head,
		expansionLaunchActionsFullInput,
		expansionLaunch,
	});

	return {
		appPropsValue,
		shellSettingsBridge,
		desktopWindowStyle,
		desktopIconStyle,
		showWP,
		setShowWP,
		wallpaper,
		handleWallpaperChange,
		handleRemoveUserWallpaper,
		layoutPresetApplyPrompt,
		setLayoutPresetApplyPrompt,
		executeApplyWindowLayoutPreset,
		currentDesktopWindows,
		editFolderIconTarget,
		onCloseEditFolderIcon,
		handleSaveFolderIcon,
		shellMotionPrefs,
		desktopGafOpenActions,
		performance,
		shellLayoutRootProps,
		shellCanvasProps,
		windowContextMenuProps,
		windowLayerProps,
		shellTaskbarProps,
		shellSearchOverlaysProps,
		helpAndSessionProps,
		appStoreLayerProps,
		shellModalsProps,
		config,
		showNF,
		deferredShellExtrasInput,
		deferredExpansionInput,
		deferredCompanionInput,
		deferredVoiceCommandsInput,
		expansionLaunchActionsInput,
		canvasSyncChipInput: {
			combinedDesktopPersistenceError,
			staleShellStateConflict,
			refreshStorage,
			clearPersistPatchConflict,
		},
	};
}

export type DesktopWorkspaceContentTailClusterResult = ReturnType<
	typeof useDesktopWorkspaceContentTailCluster
>;
