/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 24: Sources type for Shell Layout Input Assembly / bridge builder.
 *
 * Related:
 * - hooks/useDesktopWorkspaceShellLayoutInputAssembly.ts
 * - utils/desktopWorkspaceShellLayoutBridgeInput/buildDesktopWorkspaceShellLayoutInputBridgeInput.ts
 */

import type { DesktopWorkspaceShellLayoutInputBridgeInput } from '../../hooks/useDesktopWorkspaceShellLayoutInputBridge';
import type { DesktopWorkspaceContentHeadClusterResult } from '../../hooks/useDesktopWorkspaceContentHeadCluster';

/** Head cluster output plus tail-only deps for the layout bridge builder. */
export type DesktopWorkspaceShellLayoutInputAssemblySources =
	DesktopWorkspaceContentHeadClusterResult & {
		desktopWidgetsPanelProps: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['widgetsAndDrop']['widgetsPanel'];
		onBackgroundContentDragOver: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['widgetsAndDrop']['onBackgroundContentDragOver'];
		onBackgroundContentDrop: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['widgetsAndDrop']['onBackgroundContentDrop'];
		onExternalContentDropToFolder: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['widgetsAndDrop']['onExternalContentDropToFolder'];
		openWorkspaceProfile: NonNullable<
			DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['expansionAndLaunch']['expansionLaunchActions']
		>['onOpenWorkspaceProfile'];
		openAppInWorkspaceProfile: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['taskbarViewport']['onOpenAppInWorkspace'];
		openRecentDesktopFile: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['taskbarViewport']['onStartMenuOpenRecentFile'];
		openAppCollection: NonNullable<
			DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['expansionAndLaunch']['expansionLaunchActions']
		>['onOpenAppCollection'];
		openContentShortcut: NonNullable<
			DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['expansionAndLaunch']['expansionLaunchActions']
		>['onOpenContentShortcut'];
		openAssistantContextAction: NonNullable<
			DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['expansionAndLaunch']['expansionLaunchActions']
		>['onOpenAssistantAction'];
		openGafChatBySession: NonNullable<
			DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['expansionAndLaunch']['expansionLaunchActions']
		>['onOpenGafChatById'];
		assistantPropertiesPanelActions: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['assistant']['assistantPropertiesPanelActions'];
		onAssistantPropertiesPanelAction: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['assistant']['onAssistantPropertiesPanelAction'];
		assistantWindowContextSummarizeEnabled: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['assistant']['assistantWindowContextSummarizeEnabled'];
		assistantWindowContextGafEnabled: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['assistant']['assistantWindowContextGafEnabled'];
		onWindowContextAssistantSummarize: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['assistant']['onWindowContextAssistantSummarize'];
		onWindowContextAssistantShareGaf: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['assistant']['onWindowContextAssistantShareGaf'];
		handlePinAppFromStartMenu: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['taskbarViewport']['handlePinAppFromStartMenu'];
		handleUnpinAppFromStartMenu: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['taskbarViewport']['onUnpinAppFromDesktop'];
		openAppStoreAsWindow: DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions']['shellSurface']['openAppStoreAsWindow'];
		unifiedAdminDesktopItem: DesktopWorkspaceShellLayoutInputBridgeInput['derived']['shellSettingsAndAdmin']['unifiedAdminDesktopItem'];
		appStoreDetailFromStore: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['appStoreDetailFromStore'];
		clearAppStoreDetail: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['onBackFromDetail'];
		handleAppStoreLayerError: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['onAppStoreError'];
		handleAppStoreLayerSuccess: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['onAppStoreSuccess'];
		handleAppStoreLayerOpenInstalled: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['onOpenInstalledApp'];
		handleInstallApp: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['onInstall'];
		handleUninstallApp: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['onUninstall'];
		appStoreDesktopShortcutIds: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['appStore']['appStoreDesktopShortcutIds'];
		openVoiceCommandCenter: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['overlayState']['openVoiceCommandCenter'];
		openWallpaperFromDesktopSettings: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['shellSettingsAndWallpaper']['openWallpaperFromDesktopSettings'];
		handleWallpaperChange: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['shellSettingsAndWallpaper']['handleWallpaperChange'];
		handleRemoveUserWallpaper: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['shellSettingsAndWallpaper']['handleRemoveUserWallpaper'];
		onCloseNewFolder: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['clipboardAndFolderActions']['onCloseNewFolder'];
		handleCreateFolderForDialog: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['clipboardAndFolderActions']['handleCreateFolder'];
		openEditFolderIconDialog: DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest']['clipboardAndFolderActions']['openEditFolderIconDialog'];
	};
