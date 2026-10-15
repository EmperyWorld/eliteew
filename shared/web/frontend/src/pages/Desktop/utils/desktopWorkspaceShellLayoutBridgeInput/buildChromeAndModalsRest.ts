/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 24: build `chromeAndModalsRest` group for Shell Layout bridge input.
 *
 * Related:
 * - buildDesktopWorkspaceShellLayoutInputBridgeInput.ts
 */

import type { DesktopWorkspaceShellLayoutInputBridgeInput } from '../../hooks/useDesktopWorkspaceShellLayoutInputBridge';
import type { DesktopWorkspaceShellLayoutInputAssemblySources } from './desktopWorkspaceShellLayoutInputAssembly.types';
import { DESKTOP_SETTINGS_SHELL_ANCHORS } from '../../constants/desktopSettingsShellAnchors';

export function buildDesktopWorkspaceShellLayoutBridgeChromeAndModalsRest(
	sources: DesktopWorkspaceShellLayoutInputAssemblySources
): DesktopWorkspaceShellLayoutInputBridgeInput['chromeAndModalsRest'] {
	return {
		taskbarViewport: {
			isMobile: sources.isMobile,
			handleTaskbarWinClick: sources.handleTaskbarWinClick,
			handlePinAppFromStartMenu: sources.handlePinAppFromStartMenu,
			onUnpinAppFromDesktop: sources.handleUnpinAppFromStartMenu,
			onOpenAppInWorkspace: sources.openAppInWorkspaceProfile,
			onStartMenuOpenRecentFile: sources.openRecentDesktopFile,
			onStartMenuRemoveRecentFile: sources.removeRecentFile,
			startMenuWorkspaceContextWindows: sources.windows,
			getWindowsOnDesktop: sources.getWindowsOnDesktop,
			openAppStoreAsWindow: sources.openAppStoreAsWindow,
			desktopTaskbarStyle: sources.desktopTaskbarStyle,
			desktopPanelOpacity:
				sources.desktopVisualPreferences.desktop_panel_opacity,
			taskbarAppBadgeCounts: sources.taskbarAppBadgeCounts,
			apps: sources.installedApps,
			notificationCenterOpenNonce: sources.notificationCenterOpenNonce,
			minimizedPersistentSurfaceApps: sources.minimizedPersistentSurfaceApps,
			bumpNotificationCenterOpen: sources.bumpNotificationCenterOpen,
		},
		expansionAndLaunch: {
			expansionState: sources.expansionSettings,
			expansionLaunchActions: {
				onOpenWorkspaceProfile: sources.openWorkspaceProfile,
				onAddWorkspaceProfileFromTemplate: (templateId) => {
					void sources.expansionSettings.addWorkspaceProfileFromTemplate(
						templateId
					);
				},
				onAddAppCollectionFromTemplate: (templateId) => {
					void sources.expansionSettings.addAppCollectionFromTemplate(
						templateId
					);
				},
				onOpenAppCollection: sources.openAppCollection,
				onOpenContentShortcut: sources.openContentShortcut,
				onOpenAssistantAction: sources.openAssistantContextAction,
				onOpenGafChatById: sources.openGafChatBySession,
			},
		},
		windowsAndSession: {
			displayItems: sources.displayItems,
			handleOpenWindow: sources.handleOpenWindow,
			activeDesktopWindowId: sources.activeDesktopWindowId,
			currentDesktopWindows: sources.currentDesktopWindows,
			desktopIconStyle: sources.desktopIconStyle,
			focusWindow: sources.focusWindow,
			desktopWindowStyle: sources.desktopWindowStyle,
			activeDesktopWindow: sources.activeDesktopWindow,
			createDesktop: sources.createDesktop,
			switchToNextDesktop: sources.switchToNextDesktop,
			switchToPreviousDesktop: sources.switchToPreviousDesktop,
			minimizeAllWindows: sources.minimizeAllWindows,
			openDesktopAppByComponent: sources.openDesktopAppByComponent,
			openSocialHubTab: sources.openSocialHubTab,
		},
		overlayState: {
			showTaskSwitcher: sources.showTaskSwitcher,
			setShowTaskSwitcher: sources.setShowTaskSwitcher,
			showQuickSearch: sources.showQuickSearch,
			setShowQuickSearch: sources.setShowQuickSearch,
			showShortcutsHelp: sources.showShortcutsHelp,
			showSessionInfoPanel: sources.showSessionInfoPanel,
			setShowShortcutsHelp: sources.setShowShortcutsHelp,
			setShowSessionInfoPanel: sources.setShowSessionInfoPanel,
			setShowWelcome: sources.setShowWelcome,
			showCommandPalette: sources.showCommandPalette,
			setShowCommandPalette: sources.setShowCommandPalette,
			showClipboard: sources.showClipboard,
			setShowClipboard: sources.setShowClipboard,
			showWP: sources.showWP,
			setShowWP: sources.setShowWP,
			showNF: sources.showNF,
			setShowNF: sources.setShowNF,
			openVoiceCommandCenter: sources.openVoiceCommandCenter,
		},
		appStore: {
			showAppStore: sources.showAppStore,
			appStoreDetailId: sources.appStoreDetailId,
			appStoreDetailFromStore: sources.appStoreDetailFromStore,
			storeApps: sources.storeApps,
			installedAppsLoading: sources.installedAppsLoading,
			onCloseModal: sources.closeAppStoreModal,
			onBackFromDetail: sources.clearAppStoreDetail,
			onSetAppStoreDetailId: sources.setAppStoreDetailId,
			onInstall: sources.handleInstallApp,
			onUninstall: sources.handleUninstallApp,
			onAppStoreError: sources.handleAppStoreLayerError,
			onAppStoreSuccess: sources.handleAppStoreLayerSuccess,
			onOpenInstalledApp: sources.handleAppStoreLayerOpenInstalled,
			appStoreDesktopShortcutIds: sources.appStoreDesktopShortcutIds,
		},
		searchAndRecents: {
			recordRecentApp: sources.recordRecentApp,
			recentItemsForSearch: sources.recentItemsForSearch,
			recentFiles: sources.recentFiles,
			recentLibraryOpened: sources.recentLibraryOpened,
			recentLibraryAdded: sources.recentLibraryAdded,
			recentLibraryGenerated: sources.recentLibraryGenerated,
			recentLibraryUploaded: sources.recentLibraryUploaded,
			recentLibraryProjects: sources.recentLibraryProjects,
			recentContentFeedLoading: sources.recentContentFeedLoading,
			recentContentFeedError: sources.recentContentFeedError,
			recentContentFeedLoadedAt: sources.recentContentFeedLoadedAt,
			hasRecentContentFeedItems: sources.hasRecentContentFeedItems,
			onRefetchRecentContentFeed: sources.refetchRecentContentFeed,
			addRecentFile: sources.addRecentFile,
			removeRecentFile: sources.removeRecentFile,
		},
		clipboardAndFolderActions: {
			commitItems: sources.commitItems,
			setRenamingId: sources.setRenamingId,
			copyItems: sources.copyItems,
			cutItems: sources.cutItems,
			pasteClipboard: sources.pasteClipboard,
			openEditFolderIconDialog: sources.openEditFolderIconDialog,
			onCloseNewFolder: sources.onCloseNewFolder,
			handleCreateFolder: sources.handleCreateFolderForDialog,
			createMarkdownFile: sources.createMarkdownFile,
		},
		shellSettingsAndWallpaper: {
			updateConfig: sources.updateConfig,
			toggleExplicitTheme: sources.toggleExplicitTheme,
			closeShellSettingsWindow: sources.closeShellSettingsWindow,
			openShellSettings: sources.openShellSettings,
			onOpenShellWorkspacesSettings: () =>
				sources.openShellSettings('shell', {
					scrollToElementId: DESKTOP_SETTINGS_SHELL_ANCHORS.workspaces,
				}),
			wallpaper: sources.wallpaper,
			wallpaperHistory: sources.config?.wallpaper_history,
			handleWallpaperChange: sources.handleWallpaperChange,
			handleRemoveUserWallpaper: sources.handleRemoveUserWallpaper,
			openWallpaperFromDesktopSettings:
				sources.openWallpaperFromDesktopSettings,
		},
	};
}
