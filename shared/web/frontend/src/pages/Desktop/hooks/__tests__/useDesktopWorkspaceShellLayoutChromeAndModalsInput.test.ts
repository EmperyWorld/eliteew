/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for the T31 chrome/modals layout bridge input assembler.
 *
 * Invariants:
 * - All eight typed prop groups flatten into the chrome slice input without field loss.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceShellLayoutChromeAndModalsInput.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopWorkspaceShellLayoutChromeAndModalsBridgeInput } from '../../types/desktopWorkspaceShellLayoutChromeBridge.types';
import { useDesktopWorkspaceShellLayoutChromeAndModalsInput } from '../useDesktopWorkspaceShellLayoutChromeAndModalsInput';

function buildMinimalGroups(): DesktopWorkspaceShellLayoutChromeAndModalsBridgeInput {
	const handleTaskbarWinClick = vi.fn();
	const setShowQuickSearch = vi.fn();
	const handleCreateFolder = vi.fn();
	const onRefetchRecentContentFeed = vi.fn();

	return {
		taskbarViewport: {
			isMobile: false,
			handleTaskbarWinClick,
			handlePinAppFromStartMenu: vi.fn(),
			openAppStoreAsWindow: vi.fn(),
			desktopTaskbarStyle: 'glass',
			desktopPanelOpacity: 0.9,
			taskbarAppBadgeCounts: {},
			onUnpinAppFromDesktop: vi.fn(),
			onOpenAppInWorkspace: vi.fn(),
			onStartMenuOpenRecentFile: vi.fn(),
			onStartMenuRemoveRecentFile: vi.fn(),
			startMenuWorkspaceContextWindows: [],
			getWindowsOnDesktop: vi.fn(),
			apps: [],
			notificationCenterOpenNonce: 0,
			minimizedPersistentSurfaceApps: new Set<string>(),
			bumpNotificationCenterOpen: vi.fn(),
		},
		expansionAndLaunch: {
			expansionState: {} as never,
			expansionLaunchActions: {
				onOpenWorkspaceProfile: vi.fn(),
				onAddWorkspaceProfileFromTemplate: vi.fn(),
				onAddAppCollectionFromTemplate: vi.fn(),
				onOpenAppCollection: vi.fn(),
				onOpenContentShortcut: vi.fn(),
				onOpenAssistantAction: vi.fn(),
				onOpenGafChatById: vi.fn(),
			},
		},
		windowsAndSession: {
			displayItems: [],
			handleOpenWindow: vi.fn(),
			activeDesktopWindowId: 'win-1',
			currentDesktopWindows: [],
			desktopIconStyle: 'glass',
			focusWindow: vi.fn(),
			desktopWindowStyle: 'glass',
			activeDesktopWindow: null,
			createDesktop: vi.fn(),
			switchToNextDesktop: vi.fn(),
			switchToPreviousDesktop: vi.fn(),
			minimizeAllWindows: vi.fn(),
			openDesktopAppByComponent: vi.fn(),
			openSocialHubTab: vi.fn(),
		},
		overlayState: {
			showTaskSwitcher: false,
			setShowTaskSwitcher: vi.fn(),
			showQuickSearch: false,
			setShowQuickSearch,
			showShortcutsHelp: false,
			showSessionInfoPanel: false,
			setShowShortcutsHelp: vi.fn(),
			setShowSessionInfoPanel: vi.fn(),
			setShowWelcome: vi.fn(),
			showCommandPalette: false,
			setShowCommandPalette: vi.fn(),
			showClipboard: false,
			setShowClipboard: vi.fn(),
			showWP: false,
			setShowWP: vi.fn(),
			showNF: false,
			setShowNF: vi.fn(),
			openVoiceCommandCenter: vi.fn(),
		},
		appStore: {
			showAppStore: false,
			appStoreDetailId: null,
			appStoreDetailFromStore: null,
			storeApps: [],
			installedAppsLoading: false,
			onCloseModal: vi.fn(),
			onBackFromDetail: vi.fn(),
			onSetAppStoreDetailId: vi.fn(),
			onInstall: vi.fn(),
			onUninstall: vi.fn(),
			onAppStoreError: vi.fn(),
			onAppStoreSuccess: vi.fn(),
			onOpenInstalledApp: vi.fn(),
			appStoreDesktopShortcutIds: [],
		},
		searchAndRecents: {
			recordRecentApp: vi.fn(),
			recentItemsForSearch: [],
			recentFiles: [],
			recentLibraryOpened: [],
			recentLibraryAdded: [],
			recentLibraryGenerated: [],
			recentLibraryUploaded: [],
			recentLibraryProjects: [],
			recentContentFeedLoading: false,
			recentContentFeedError: null,
			recentContentFeedLoadedAt: null,
			hasRecentContentFeedItems: false,
			onRefetchRecentContentFeed,
			addRecentFile: vi.fn(),
			removeRecentFile: vi.fn(),
		},
		clipboardAndFolderActions: {
			commitItems: vi.fn(),
			setRenamingId: vi.fn(),
			copyItems: vi.fn(),
			cutItems: vi.fn(),
			pasteClipboard: vi.fn(),
			openEditFolderIconDialog: vi.fn(),
			onCloseNewFolder: vi.fn(),
			handleCreateFolder,
			createMarkdownFile: vi.fn(),
		},
		shellSettingsAndWallpaper: {
			updateConfig: vi.fn(),
			toggleExplicitTheme: vi.fn(),
			closeShellSettingsWindow: vi.fn(),
			openShellSettings: vi.fn(),
			onOpenShellWorkspacesSettings: vi.fn(),
			wallpaper: '',
			wallpaperHistory: [],
			handleWallpaperChange: vi.fn(),
			handleRemoveUserWallpaper: vi.fn(),
			openWallpaperFromDesktopSettings: vi.fn(),
		},
	};
}

describe('useDesktopWorkspaceShellLayoutChromeAndModalsInput', () => {
	it('flattens all eight prop groups into the chrome slice input contract', () => {
		const groups = buildMinimalGroups();

		const { result } = renderHook(() =>
			useDesktopWorkspaceShellLayoutChromeAndModalsInput(groups)
		);

		expect(result.current.handleTaskbarWinClick).toBe(
			groups.taskbarViewport.handleTaskbarWinClick
		);
		expect(result.current.setShowQuickSearch).toBe(
			groups.overlayState.setShowQuickSearch
		);
		expect(result.current.handleCreateFolder).toBe(
			groups.clipboardAndFolderActions.handleCreateFolder
		);
		expect(result.current.onRefetchRecentContentFeed).toBe(
			groups.searchAndRecents.onRefetchRecentContentFeed
		);
		expect(result.current.activeDesktopWindowId).toBe('win-1');
		expect(result.current.isMobile).toBe(false);
		expect(result.current.expansionLaunchActions?.onOpenGafChatById).toBe(
			groups.expansionAndLaunch.expansionLaunchActions?.onOpenGafChatById
		);
		expect(result.current.wallpaper).toBe('');
	});
});
