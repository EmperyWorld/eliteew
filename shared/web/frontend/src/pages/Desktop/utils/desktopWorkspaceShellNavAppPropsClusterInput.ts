/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 22: build Shell Nav / AppProps cluster input from TailCluster parts
 * (moves nested launchHost/navigation/appProps/postNav/openAppInput out of Tail).
 * `FromTailParts` maps Head + item-ops extras so TailCluster stays a thin call site.
 *
 * Invariants:
 * - Output shape = `DesktopWorkspaceShellNavAppPropsClusterInput`.
 * - `storageError` nullish → `null`; openDesktopItem wraps handleOpenWindow;
 *   openAppInput.openNewFolderDialog closes over raw openNewFolderDialog(undefined).
 *
 * Related:
 * - types/desktopWorkspaceShellNavAppPropsCluster.types.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 * - hooks/useDesktopWorkspaceContentHeadCluster.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import type { DesktopWorkspaceShellNavAppPropsClusterInput } from '../types/desktopWorkspaceShellNavAppPropsCluster.types';
import type { DesktopItem } from '../types/desktop.types';
import type { OpenWindowOptions } from '../hooks/useWindowManager';
import type { DesktopWorkspaceContentHeadClusterResult } from '../hooks/useDesktopWorkspaceContentHeadCluster';

export type DesktopWorkspaceShellNavAppPropsClusterInputParts = {
	launchHost: DesktopWorkspaceShellNavAppPropsClusterInput['launchHost'];
	navigation: DesktopWorkspaceShellNavAppPropsClusterInput['navigation'];
	appProps: Omit<
		DesktopWorkspaceShellNavAppPropsClusterInput['appProps'],
		'openDesktopItem'
	> & {
		handleOpenWindow: (item: DesktopItem, options?: OpenWindowOptions) => void;
	};
	postNav: Omit<
		DesktopWorkspaceShellNavAppPropsClusterInput['postNav'],
		'storageError'
	> & {
		storageError: string | null | undefined;
	};
	openAppInput: Omit<
		DesktopWorkspaceShellNavAppPropsClusterInput['openAppInput'],
		'openNewFolderDialog'
	> & {
		openNewFolderDialog: (
			parentFolderId?: string,
			onCreated?: (folder: DesktopItem) => void
		) => void;
	};
};

/** Item-ops + folder/properties handlers TailCluster owns after Head. */
export type DesktopWorkspaceShellNavAppPropsClusterItemOpsExtras = {
	liftDesktopItemsToRoot: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['liftDesktopItemsToRoot'];
	liftDesktopItemsOneLevel: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['liftDesktopItemsOneLevel'];
	moveDesktopNestedItemsToFolder: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['moveDesktopNestedItemsToFolder'];
	renameDesktopItem: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['renameDesktopItem'];
	deleteDesktopItems: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['deleteDesktopItems'];
	openNewFolderDialog: (
		parentFolderId?: string,
		onCreated?: (folder: DesktopItem) => void
	) => void;
	createMarkdownFileInFolder: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['createMarkdownFileInFolder'];
	openEditFolderIconDialog: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['openEditFolderIconDialog'];
	openDesktopItemProperties: DesktopWorkspaceShellNavAppPropsClusterInput['appProps']['openDesktopItemProperties'];
};

export function buildDesktopWorkspaceShellNavAppPropsClusterInput(
	parts: DesktopWorkspaceShellNavAppPropsClusterInputParts
): DesktopWorkspaceShellNavAppPropsClusterInput {
	const { handleOpenWindow } = parts.appProps;
	const openNewFolderDialog = parts.openAppInput.openNewFolderDialog;

	return {
		launchHost: parts.launchHost,
		navigation: parts.navigation,
		appProps: {
			appPropsValueBase: parts.appProps.appPropsValueBase,
			desktopEmbeddedAppTheme: parts.appProps.desktopEmbeddedAppTheme,
			refreshDesktopConfigFromServer:
				parts.appProps.refreshDesktopConfigFromServer,
			desktopItems: parts.appProps.desktopItems,
			openDesktopItem: (item, options) => handleOpenWindow(item, options),
			liftDesktopItemsToRoot: parts.appProps.liftDesktopItemsToRoot,
			liftDesktopItemsOneLevel: parts.appProps.liftDesktopItemsOneLevel,
			moveDesktopNestedItemsToFolder:
				parts.appProps.moveDesktopNestedItemsToFolder,
			renameDesktopItem: parts.appProps.renameDesktopItem,
			deleteDesktopItems: parts.appProps.deleteDesktopItems,
			openNewFolderDialog: parts.appProps.openNewFolderDialog,
			createMarkdownFileInFolder: parts.appProps.createMarkdownFileInFolder,
			openEditFolderIconDialog: parts.appProps.openEditFolderIconDialog,
			openDesktopItemProperties: parts.appProps.openDesktopItemProperties,
		},
		postNav: {
			...parts.postNav,
			storageError: parts.postNav.storageError ?? null,
		},
		openAppInput: {
			...parts.openAppInput,
			openNewFolderDialog: () => openNewFolderDialog(undefined),
		},
	};
}

/**
 * Wave 22 Tail call site: Head fields + item-ops extras → cluster input.
 * Keeps nested group assembly out of `useDesktopWorkspaceContentTailCluster`.
 */
export function buildDesktopWorkspaceShellNavAppPropsClusterInputFromTailParts(
	head: DesktopWorkspaceContentHeadClusterResult,
	itemOps: DesktopWorkspaceShellNavAppPropsClusterItemOpsExtras
): DesktopWorkspaceShellNavAppPropsClusterInput {
	const {
		appState,
		appPropsValueBase,
		canOpenUnifiedAdmin,
		items,
		itemsRef,
		refreshStorage,
		isSyncing,
		storageError,
		desktopEmbeddedAppTheme,
		toggleExplicitTheme,
		installedApps,
		storeApps,
		installedAppsLoading,
		installedAppIds,
		setShowTaskSwitcher,
		setShowQuickSearch,
		setShowShortcutsHelp,
		showCommandPalette,
		setShowCommandPalette,
		setShowClipboard,
		setWindowContextMenu,
		activeDesktopId,
		desktops,
		createDesktop,
		switchToDesktop,
		switchToNextDesktop,
		switchToPreviousDesktop,
		notifyDesktop,
		windows,
		closeWindow,
		minimizeWindow,
		maximizeWindow,
		focusWindow,
		snapWindow,
		minimizeAllWindows,
		updateWindowPayload,
		performWorkspaceRefresh,
		windowsRef,
		handleOpenWindow,
		openDesktopAppByComponent,
		openSocialHubTab,
		currentDesktopWindows,
		openShellSettings,
		activeDesktopWindow,
		activeDesktopWindowId,
		closeActiveDesktopWindow,
	} = head;

	return buildDesktopWorkspaceShellNavAppPropsClusterInput({
		launchHost: {
			setWindowContextMenu,
			minimizeAllWindows,
			closeActiveDesktopWindow,
			openShellSettings,
			items,
			windows,
			installedApps,
			installedAppsLoading,
			storeApps,
			installedAppIds,
			handleOpenWindow,
		},
		navigation: {
			handleOpenWindow,
			itemsRef,
			canOpenUnifiedAdmin,
			setCurrentPage: appState.actions.setCurrentPage,
		},
		appProps: {
			appPropsValueBase,
			desktopEmbeddedAppTheme,
			refreshDesktopConfigFromServer: refreshStorage,
			desktopItems: items,
			handleOpenWindow,
			liftDesktopItemsToRoot: itemOps.liftDesktopItemsToRoot,
			liftDesktopItemsOneLevel: itemOps.liftDesktopItemsOneLevel,
			moveDesktopNestedItemsToFolder: itemOps.moveDesktopNestedItemsToFolder,
			renameDesktopItem: itemOps.renameDesktopItem,
			deleteDesktopItems: itemOps.deleteDesktopItems,
			openNewFolderDialog: itemOps.openNewFolderDialog,
			createMarkdownFileInFolder: itemOps.createMarkdownFileInFolder,
			openEditFolderIconDialog: itemOps.openEditFolderIconDialog,
			openDesktopItemProperties: itemOps.openDesktopItemProperties,
		},
		postNav: {
			items,
			installedApps,
			installedAppIds,
			installedAppsLoading,
			handleOpenWindow,
			currentPage: appState.state.currentPage,
			setCurrentPage: appState.actions.setCurrentPage,
			isSyncing,
			storageError,
			notifyDesktop,
			windows,
			closeWindow,
		},
		openAppInput: {
			activeDesktopWindow,
			currentDesktopWindows,
			activeDesktopWindowId,
			snapWindow,
			maximizeWindow,
			minimizeWindow,
			closeWindow,
			minimizeAllWindows,
			setShowQuickSearch,
			setShowTaskSwitcher,
			toggleExplicitTheme,
			showCommandPalette,
			setShowCommandPalette,
			setShowShortcutsHelp,
			openShellSettings,
			openSocialHubTab,
			openDesktopAppByComponent,
			setShowClipboard,
			installedApps,
			handleOpenWindow,
			switchToNextDesktop,
			switchToPreviousDesktop,
			createDesktop,
			desktops,
			switchToDesktop,
			focusWindow,
			onWorkspaceRefresh: performWorkspaceRefresh,
			openNewFolderDialog: itemOps.openNewFolderDialog,
			items,
			windowsRef,
			activeDesktopId,
			updateWindowPayload,
		},
	});
}
