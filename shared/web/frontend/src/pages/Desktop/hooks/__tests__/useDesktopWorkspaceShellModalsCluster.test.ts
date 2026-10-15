/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Command-palette window layout actions wired through shell modals cluster (plan 02/20 R12).
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import { useDesktopWorkspaceShellModalsCluster } from '../useDesktopWorkspaceShellModalsCluster';

function baseParams(
	overrides: Partial<
		Parameters<typeof useDesktopWorkspaceShellModalsCluster>[0]
	> = {}
) {
	const noop = () => {};
	const activeDesktopWindow: WindowState = {
		id: 'w-active',
		title: 'Active',
		type: 'app',
		position: { x: 0, y: 0 },
		size: { width: 400, height: 300 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 2,
		path: [],
		appComponent: 'UGS',
	};
	return {
		snapToGridEnabled: true,
		snapWindow: vi.fn(),
		ctx: { isOpen: false, x: 0, y: 0, targetType: 'desktop' as const },
		items: [],
		selected: new Set<string>(),
		gridStep: '24',
		setShowNF: noop,
		openAppStoreAsWindow: noop,
		setShowSessionInfoPanel: noop,
		openSocialHubTab: () => undefined,
		openShellSettings: noop,
		handleOpenWindow: noop,
		commitItems: noop,
		setSelected: noop,
		performWorkspaceRefresh: noop,
		setPropertiesItem: noop,
		setRenamingId: noop,
		copyItems: noop,
		cutItems: noop,
		pasteClipboard: noop,
		updateConfig: async () => {},
		activeDesktopWindow,
		minimizeWindow: noop,
		maximizeWindow: vi.fn(),
		closeWindow: noop,
		toggleWindowAlwaysOnTop: noop,
		updateDesktopVisualPreferences: async () => {},
		minimizeAllWindows: noop,
		setShowQuickSearch: noop,
		openDesktopAppByComponent: () => undefined,
		createMarkdownFile: noop,
		createDesktop: noop,
		switchToNextDesktop: noop,
		switchToPreviousDesktop: noop,
		setShowTaskSwitcher: noop,
		setShowShortcutsHelp: noop,
		toggleExplicitTheme: noop,
		closeShellSettingsWindow: noop,
		setShowWP: noop,
		bumpNotificationCenterOpen: noop,
		openVoiceCommandCenter: noop,
		setShowClipboard: noop,
		showWP: false,
		wallpaper: '',
		wallpaperHistory: [],
		handleWallpaperChange: noop,
		handleRemoveUserWallpaper: noop,
		openWallpaperFromDesktopSettings: noop,
		showNF: false,
		onCloseNewFolder: noop,
		handleCreateFolder: noop,
		openEditFolderIconDialog: noop,
		desktopWindowStyle: 'glass' as const,
		showCommandPalette: false,
		setShowCommandPalette: noop,
		showClipboard: false,
		...overrides,
	};
}

describe('useDesktopWorkspaceShellModalsCluster window layout actions', () => {
	it('snaps active window left from command palette handler', () => {
		const snapWindow = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellModalsCluster(
				baseParams({ snapWindow }) as Parameters<
					typeof useDesktopWorkspaceShellModalsCluster
				>[0]
			)
		);
		result.current.handleCommandPaletteAction('snap_window_left');
		expect(snapWindow).toHaveBeenCalledWith('w-active', 'left');
	});

	it('maximizes active window when not already maximized', () => {
		const maximizeWindow = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellModalsCluster(
				baseParams({ maximizeWindow }) as Parameters<
					typeof useDesktopWorkspaceShellModalsCluster
				>[0]
			)
		);
		result.current.handleCommandPaletteAction('maximize_active_window');
		expect(maximizeWindow).toHaveBeenCalledWith('w-active');
	});
});
