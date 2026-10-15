/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23: merge Head + Tail cluster bags into Shell Layout Input Assembly
 * sources (keeps TailCluster call site thin; field flatten lives here).
 *
 * Invariants:
 * - Pass-through flatten; no remapping vs prior Tail `…Assembly({ ...head, extras })`.
 *
 * Related:
 * - hooks/useDesktopWorkspaceShellLayoutInputAssembly.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import type { DesktopWorkspaceContentHeadClusterResult } from '../hooks/useDesktopWorkspaceContentHeadCluster';
import type { DesktopWorkspaceShellLayoutInputAssemblySources } from '../hooks/useDesktopWorkspaceShellLayoutInputAssembly';
import type { DesktopWorkspaceExpansionLaunchActions } from '../types/desktopWorkspaceExpansionLaunchActions.types';

export type DesktopWorkspaceShellLayoutInputAssemblyTailExtras = Omit<
	DesktopWorkspaceShellLayoutInputAssemblySources,
	keyof DesktopWorkspaceContentHeadClusterResult
>;

export type DesktopWorkspaceShellLayoutInputAssemblyTailClusters = {
	desktopWidgetsPanelProps: DesktopWorkspaceShellLayoutInputAssemblyTailExtras['desktopWidgetsPanelProps'];
	drop: Pick<
		DesktopWorkspaceShellLayoutInputAssemblyTailExtras,
		| 'onBackgroundContentDragOver'
		| 'onBackgroundContentDrop'
		| 'onExternalContentDropToFolder'
	>;
	expansionLaunch: DesktopWorkspaceExpansionLaunchActions;
	shellLaunch: Pick<
		DesktopWorkspaceShellLayoutInputAssemblyTailExtras,
		| 'handlePinAppFromStartMenu'
		| 'handleUnpinAppFromStartMenu'
		| 'openAppStoreAsWindow'
		| 'unifiedAdminDesktopItem'
	>;
	appStore: Pick<
		DesktopWorkspaceShellLayoutInputAssemblyTailExtras,
		| 'appStoreDetailFromStore'
		| 'clearAppStoreDetail'
		| 'handleAppStoreLayerError'
		| 'handleAppStoreLayerSuccess'
		| 'handleAppStoreLayerOpenInstalled'
		| 'handleInstallApp'
		| 'handleUninstallApp'
		| 'appStoreDesktopShortcutIds'
	>;
	chrome: Pick<
		DesktopWorkspaceShellLayoutInputAssemblyTailExtras,
		| 'openVoiceCommandCenter'
		| 'openWallpaperFromDesktopSettings'
		| 'handleWallpaperChange'
		| 'handleRemoveUserWallpaper'
		| 'onCloseNewFolder'
		| 'handleCreateFolderForDialog'
		| 'openEditFolderIconDialog'
	>;
};

export function buildDesktopWorkspaceShellLayoutInputAssemblyTailExtras(
	clusters: DesktopWorkspaceShellLayoutInputAssemblyTailClusters
): DesktopWorkspaceShellLayoutInputAssemblyTailExtras {
	return {
		desktopWidgetsPanelProps: clusters.desktopWidgetsPanelProps,
		...clusters.drop,
		...clusters.expansionLaunch,
		...clusters.shellLaunch,
		...clusters.appStore,
		...clusters.chrome,
	};
}

export function buildDesktopWorkspaceShellLayoutInputAssemblySourcesFromTail(
	head: DesktopWorkspaceContentHeadClusterResult,
	extras: DesktopWorkspaceShellLayoutInputAssemblyTailExtras
): DesktopWorkspaceShellLayoutInputAssemblySources {
	return {
		...head,
		...extras,
	};
}

export function buildDesktopWorkspaceShellLayoutInputAssemblySourcesFromTailClusters(
	head: DesktopWorkspaceContentHeadClusterResult,
	clusters: DesktopWorkspaceShellLayoutInputAssemblyTailClusters
): DesktopWorkspaceShellLayoutInputAssemblySources {
	return buildDesktopWorkspaceShellLayoutInputAssemblySourcesFromTail(
		head,
		buildDesktopWorkspaceShellLayoutInputAssemblyTailExtras(clusters)
	);
}
