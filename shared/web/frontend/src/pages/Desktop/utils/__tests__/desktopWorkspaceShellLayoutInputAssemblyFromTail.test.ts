/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23 lock: layout assembly FromTailClusters flattens named bags.
 *
 * Related:
 * - utils/desktopWorkspaceShellLayoutInputAssemblyFromTail.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildDesktopWorkspaceShellLayoutInputAssemblySourcesFromTailClusters,
	buildDesktopWorkspaceShellLayoutInputAssemblyTailExtras,
} from '../desktopWorkspaceShellLayoutInputAssemblyFromTail';

describe('desktopWorkspaceShellLayoutInputAssemblyFromTail (Wave 23)', () => {
	it('flattens cluster bags into TailExtras keys', () => {
		const openWorkspaceProfile = vi.fn();
		const extras = buildDesktopWorkspaceShellLayoutInputAssemblyTailExtras({
			desktopWidgetsPanelProps: null,
			drop: {
				onBackgroundContentDragOver: vi.fn(),
				onBackgroundContentDrop: vi.fn(),
				onExternalContentDropToFolder: vi.fn(),
			},
			expansionLaunch: {
				openWorkspaceProfile,
				openAppInWorkspaceProfile: vi.fn(),
				openRecentDesktopFile: vi.fn(),
				openAppCollection: vi.fn(),
				openContentShortcut: vi.fn(),
				openAssistantContextAction: vi.fn(),
				assistantPropertiesPanelActions: [],
				onAssistantPropertiesPanelAction: vi.fn(),
				openGafChatBySession: vi.fn(),
				assistantWindowContextSummarizeEnabled: true,
				assistantWindowContextGafEnabled: false,
				onWindowContextAssistantSummarize: vi.fn(),
				onWindowContextAssistantShareGaf: vi.fn(),
			},
			shellLaunch: {
				handlePinAppFromStartMenu: vi.fn(),
				handleUnpinAppFromStartMenu: vi.fn(),
				openAppStoreAsWindow: vi.fn(),
				unifiedAdminDesktopItem: null as never,
			},
			appStore: {
				appStoreDetailFromStore: null,
				clearAppStoreDetail: vi.fn(),
				handleAppStoreLayerError: vi.fn(),
				handleAppStoreLayerSuccess: vi.fn(),
				handleAppStoreLayerOpenInstalled: vi.fn(),
				handleInstallApp: vi.fn(),
				handleUninstallApp: vi.fn(),
				appStoreDesktopShortcutIds: [],
			},
			chrome: {
				openVoiceCommandCenter: vi.fn(),
				openWallpaperFromDesktopSettings: vi.fn(),
				handleWallpaperChange: vi.fn(),
				handleRemoveUserWallpaper: vi.fn(),
				onCloseNewFolder: vi.fn(),
				handleCreateFolderForDialog: vi.fn(),
				openEditFolderIconDialog: vi.fn(),
			},
		});

		expect(extras.openWorkspaceProfile).toBe(openWorkspaceProfile);
		expect(extras.desktopWidgetsPanelProps).toBeNull();
		expect(extras.appStoreDesktopShortcutIds).toEqual([]);
	});

	it('FromTailClusters merges head fields with extras', () => {
		const head = { items: [{ id: 'i1' }], wallpaper: '#000' } as never;
		const sources =
			buildDesktopWorkspaceShellLayoutInputAssemblySourcesFromTailClusters(
				head,
				{
					desktopWidgetsPanelProps: null,
					drop: {
						onBackgroundContentDragOver: vi.fn(),
						onBackgroundContentDrop: vi.fn(),
						onExternalContentDropToFolder: vi.fn(),
					},
					expansionLaunch: {
						openWorkspaceProfile: vi.fn(),
						openAppInWorkspaceProfile: vi.fn(),
						openRecentDesktopFile: vi.fn(),
						openAppCollection: vi.fn(),
						openContentShortcut: vi.fn(),
						openAssistantContextAction: vi.fn(),
						assistantPropertiesPanelActions: [],
						onAssistantPropertiesPanelAction: vi.fn(),
						openGafChatBySession: vi.fn(),
						assistantWindowContextSummarizeEnabled: false,
						assistantWindowContextGafEnabled: false,
						onWindowContextAssistantSummarize: vi.fn(),
						onWindowContextAssistantShareGaf: vi.fn(),
					},
					shellLaunch: {
						handlePinAppFromStartMenu: vi.fn(),
						handleUnpinAppFromStartMenu: vi.fn(),
						openAppStoreAsWindow: vi.fn(),
						unifiedAdminDesktopItem: null as never,
					},
					appStore: {
						appStoreDetailFromStore: null,
						clearAppStoreDetail: vi.fn(),
						handleAppStoreLayerError: vi.fn(),
						handleAppStoreLayerSuccess: vi.fn(),
						handleAppStoreLayerOpenInstalled: vi.fn(),
						handleInstallApp: vi.fn(),
						handleUninstallApp: vi.fn(),
						appStoreDesktopShortcutIds: ['a'],
					},
					chrome: {
						openVoiceCommandCenter: vi.fn(),
						openWallpaperFromDesktopSettings: vi.fn(),
						handleWallpaperChange: vi.fn(),
						handleRemoveUserWallpaper: vi.fn(),
						onCloseNewFolder: vi.fn(),
						handleCreateFolderForDialog: vi.fn(),
						openEditFolderIconDialog: vi.fn(),
					},
				}
			);

		expect(sources.items).toEqual([{ id: 'i1' }]);
		expect(sources.wallpaper).toBe('#000');
		expect(sources.appStoreDesktopShortcutIds).toEqual(['a']);
	});
});
