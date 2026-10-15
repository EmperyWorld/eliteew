/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 22 lock: Shell Nav AppProps cluster input builder applies openDesktopItem /
 * storageError / openNewFolderDialog wrappers; FromTailParts maps Head + itemOps.
 *
 * Related:
 * - utils/desktopWorkspaceShellNavAppPropsClusterInput.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildDesktopWorkspaceShellNavAppPropsClusterInput,
	buildDesktopWorkspaceShellNavAppPropsClusterInputFromTailParts,
} from '../desktopWorkspaceShellNavAppPropsClusterInput';

describe('buildDesktopWorkspaceShellNavAppPropsClusterInput (Wave 22)', () => {
	it('wraps openDesktopItem via handleOpenWindow and nullishes storageError', () => {
		const handleOpenWindow = vi.fn();
		const openNewFolderDialog = vi.fn();
		const item = { id: 'a', type: 'app' } as never;

		const input = buildDesktopWorkspaceShellNavAppPropsClusterInput({
			launchHost: { handleOpenWindow } as never,
			navigation: {
				handleOpenWindow,
				itemsRef: { current: [] },
				canOpenUnifiedAdmin: false,
				setCurrentPage: vi.fn(),
			},
			appProps: {
				appPropsValueBase: {} as never,
				desktopEmbeddedAppTheme: 'dark' as never,
				refreshDesktopConfigFromServer: vi.fn(),
				desktopItems: [],
				handleOpenWindow,
				liftDesktopItemsToRoot: vi.fn(),
				liftDesktopItemsOneLevel: vi.fn(),
				moveDesktopNestedItemsToFolder: vi.fn(),
				renameDesktopItem: vi.fn(),
				deleteDesktopItems: vi.fn(),
				openNewFolderDialog,
			},
			postNav: {
				items: [],
				installedApps: [],
				installedAppIds: new Set<string>(),
				installedAppsLoading: false,
				handleOpenWindow,
				currentPage: 'desktop' as never,
				setCurrentPage: vi.fn(),
				isSyncing: false,
				storageError: undefined,
				notifyDesktop: vi.fn() as never,
				windows: [],
				closeWindow: vi.fn(),
			},
			openAppInput: {
				openNewFolderDialog,
				handleOpenWindow,
				items: [],
			} as never,
		});

		input.appProps.openDesktopItem(item, { folderPathPrefix: ['x'] });
		expect(handleOpenWindow).toHaveBeenCalledWith(item, {
			folderPathPrefix: ['x'],
		});
		expect(input.postNav.storageError).toBeNull();

		input.openAppInput.openNewFolderDialog?.();
		expect(openNewFolderDialog).toHaveBeenCalledWith(undefined);
	});

	it('exposes five cluster groups', () => {
		const input = buildDesktopWorkspaceShellNavAppPropsClusterInput({
			launchHost: {} as never,
			navigation: {} as never,
			appProps: {
				appPropsValueBase: {} as never,
				desktopEmbeddedAppTheme: 'dark' as never,
				refreshDesktopConfigFromServer: vi.fn(),
				desktopItems: [],
				handleOpenWindow: vi.fn(),
				liftDesktopItemsToRoot: vi.fn(),
				liftDesktopItemsOneLevel: vi.fn(),
				moveDesktopNestedItemsToFolder: vi.fn(),
				renameDesktopItem: vi.fn(),
				deleteDesktopItems: vi.fn(),
			},
			postNav: { storageError: 'x' } as never,
			openAppInput: { openNewFolderDialog: vi.fn() } as never,
		});

		expect(Object.keys(input).sort()).toEqual(
			['appProps', 'launchHost', 'navigation', 'openAppInput', 'postNav'].sort()
		);
		expect(input.postNav.storageError).toBe('x');
	});

	it('FromTailParts wires Head + itemOps into five groups', () => {
		const handleOpenWindow = vi.fn();
		const openNewFolderDialog = vi.fn();
		const head = {
			appState: {
				state: { currentPage: 'desktop' },
				actions: { setCurrentPage: vi.fn() },
			},
			appPropsValueBase: {},
			canOpenUnifiedAdmin: true,
			items: [],
			itemsRef: { current: [] },
			refreshStorage: vi.fn(),
			isSyncing: false,
			storageError: null,
			desktopEmbeddedAppTheme: 'dark',
			toggleExplicitTheme: vi.fn(),
			installedApps: [],
			storeApps: [],
			installedAppsLoading: false,
			installedAppIds: new Set<string>(),
			setShowTaskSwitcher: vi.fn(),
			setShowQuickSearch: vi.fn(),
			setShowShortcutsHelp: vi.fn(),
			showCommandPalette: false,
			setShowCommandPalette: vi.fn(),
			setShowClipboard: vi.fn(),
			setWindowContextMenu: vi.fn(),
			activeDesktopId: 'd1',
			desktops: [],
			createDesktop: vi.fn(),
			switchToDesktop: vi.fn(),
			switchToNextDesktop: vi.fn(),
			switchToPreviousDesktop: vi.fn(),
			notifyDesktop: vi.fn(),
			windows: [],
			closeWindow: vi.fn(),
			minimizeWindow: vi.fn(),
			maximizeWindow: vi.fn(),
			focusWindow: vi.fn(),
			snapWindow: vi.fn(),
			minimizeAllWindows: vi.fn(),
			updateWindowPayload: vi.fn(),
			performWorkspaceRefresh: vi.fn(),
			windowsRef: { current: [] },
			handleOpenWindow,
			openDesktopAppByComponent: vi.fn(),
			openSocialHubTab: vi.fn(),
			currentDesktopWindows: [],
			openShellSettings: vi.fn(),
			activeDesktopWindow: null,
			activeDesktopWindowId: null,
			closeActiveDesktopWindow: vi.fn(),
		} as never;

		const input =
			buildDesktopWorkspaceShellNavAppPropsClusterInputFromTailParts(head, {
				liftDesktopItemsToRoot: vi.fn(),
				liftDesktopItemsOneLevel: vi.fn(),
				moveDesktopNestedItemsToFolder: vi.fn(),
				renameDesktopItem: vi.fn(),
				deleteDesktopItems: vi.fn(),
				openNewFolderDialog,
				createMarkdownFileInFolder: vi.fn(),
				openEditFolderIconDialog: vi.fn(),
				openDesktopItemProperties: vi.fn(),
			});

		expect(Object.keys(input).sort()).toEqual(
			['appProps', 'launchHost', 'navigation', 'openAppInput', 'postNav'].sort()
		);
		expect(input.navigation.canOpenUnifiedAdmin).toBe(true);
		expect(input.launchHost.handleOpenWindow).toBe(handleOpenWindow);
		input.openAppInput.openNewFolderDialog?.();
		expect(openNewFolderDialog).toHaveBeenCalledWith(undefined);
	});
});
