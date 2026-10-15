import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopWindowStyle } from '@/types/profile';
import { useDesktopWorkspaceRefreshBootstrap } from '../useDesktopWorkspaceRefreshBootstrap';
import { useDesktopWorkspaceRefreshController } from '../useDesktopWorkspaceRefreshController';
import { useDesktopWorkspaceShellModalsChain } from '../useDesktopWorkspaceShellModalsChain';
import type { UseDesktopWorkspaceCommandActionParams } from '../useDesktopWorkspaceCommandAction';
import type { UseDesktopWorkspaceHandleActionParams } from '../useDesktopWorkspaceHandleAction';
import type { ContextMenuState, WindowState } from '../../types/desktop.types';
import { collectLegacyVoiceWindowIds } from '../../utils/desktopWorkspaceRefresh';

vi.mock('@/utils/staleBundleReload', () => ({
	performManualHardPageReload: vi.fn(),
}));

import { performManualHardPageReload } from '@/utils/staleBundleReload';

const desktopWindowStyle: DesktopWindowStyle = 'glass';

function minimalCtx(): ContextMenuState {
	return { isOpen: false, x: 0, y: 0, targetType: 'desktop' };
}

function minimalHandleActionParams(): UseDesktopWorkspaceHandleActionParams {
	const noop = () => {};
	return {
		ctx: minimalCtx(),
		items: [],
		selected: new Set(),
		gridStep: '24',
		snapToGridEffective: true,
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
		activeDesktopWindow: null,
		minimizeWindow: noop,
		maximizeWindow: noop,
		closeWindow: noop,
		toggleWindowAlwaysOnTop: noop,
		updateDesktopVisualPreferences: async () => {},
		openDesktopAppByComponent: () => undefined,
		createMarkdownFile: async () => null,
	};
}

function minimalCommandActionParams(): UseDesktopWorkspaceCommandActionParams {
	const noop = () => {};
	return {
		setShowNF: noop,
		performWorkspaceRefresh: noop,
		minimizeAllWindows: noop,
		setShowQuickSearch: noop,
		openSocialHubTab: () => undefined,
		openDesktopAppByComponent: () => undefined,
		createDesktop: noop,
		switchToNextDesktop: noop,
		switchToPreviousDesktop: noop,
		setShowTaskSwitcher: noop,
		setShowShortcutsHelp: noop,
		toggleExplicitTheme: noop,
		closeShellSettingsWindow: noop,
		setShowWP: noop,
		openShellSettings: noop,
		bumpNotificationCenterOpen: noop,
		openVoiceCommandCenter: noop,
		setShowClipboard: noop,
	};
}

describe('collectLegacyVoiceWindowIds', () => {
	it('returns ids for legacy hidden voice-related components', () => {
		const windows: WindowState[] = [
			{
				id: 'w-voice',
				title: '',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 1, height: 1 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
				appComponent: 'VoiceCommand',
			},
			{
				id: 'w-normal',
				title: '',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 1, height: 1 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 2,
				path: [],
				appComponent: 'GAFChatApp',
			},
		];
		expect(collectLegacyVoiceWindowIds(windows)).toEqual(['w-voice']);
	});
});

describe('useDesktopWorkspaceRefreshBootstrap', () => {
	it('calls workspace impl when ref is set', () => {
		const refreshStorage = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceRefreshBootstrap(refreshStorage)
		);
		const impl = vi.fn();
		result.current.workspaceRefreshImplRef.current = impl;
		result.current.refreshForPersistenceShell();
		expect(impl).toHaveBeenCalledTimes(1);
		expect(refreshStorage).not.toHaveBeenCalled();
	});

	it('falls back to refreshStorage when impl ref is empty', () => {
		const refreshStorage = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceRefreshBootstrap(refreshStorage)
		);
		result.current.workspaceRefreshImplRef.current = null;
		result.current.refreshForPersistenceShell();
		expect(refreshStorage).toHaveBeenCalledTimes(1);
	});
});

describe('useDesktopWorkspaceRefreshController', () => {
	it('syncWorkspaceFromServer refreshes storage and closes legacy voice windows', () => {
		const refreshStorage = vi.fn();
		const closeWindow = vi.fn();
		const workspaceRefreshImplRef: MutableRefObject<(() => void) | null> = {
			current: null,
		};

		const windows: WindowState[] = [
			{
				id: 'legacy-1',
				title: '',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 1, height: 1 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
				appComponent: 'VoiceStudio',
			},
		];

		const { result } = renderHook(() =>
			useDesktopWorkspaceRefreshController({
				workspaceRefreshImplRef,
				refreshStorage,
				windows,
				closeWindow,
			})
		);

		result.current.syncWorkspaceFromServer();

		expect(refreshStorage).toHaveBeenCalledTimes(1);
		expect(closeWindow).toHaveBeenCalledWith('legacy-1');
		expect(typeof workspaceRefreshImplRef.current).toBe('function');
	});

	it('performWorkspaceRefresh triggers hard page reload', () => {
		const refreshStorage = vi.fn();
		const closeWindow = vi.fn();
		const workspaceRefreshImplRef: MutableRefObject<(() => void) | null> = {
			current: null,
		};

		const { result } = renderHook(() =>
			useDesktopWorkspaceRefreshController({
				workspaceRefreshImplRef,
				refreshStorage,
				windows: [],
				closeWindow,
			})
		);

		result.current.performWorkspaceRefresh();

		expect(performManualHardPageReload).toHaveBeenCalledWith('manual_user');
		expect(refreshStorage).not.toHaveBeenCalled();
	});
});

describe('useDesktopWorkspaceShellModalsChain', () => {
	it('wires command palette action into shell modals', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellModalsChain({
				handleAction: minimalHandleActionParams(),
				commandAction: minimalCommandActionParams(),
				modals: {
					showWP: false,
					setShowWP: vi.fn(),
					wallpaper: '',
					wallpaperHistory: undefined,
					handleWallpaperChange: vi.fn(),
					handleRemoveUserWallpaper: vi.fn(),
					openWallpaperFromDesktopSettings: vi.fn(),
					showNF: false,
					setShowNF: vi.fn(),
					handleCreateFolder: vi.fn(),
					desktopWindowStyle,
					showCommandPalette: false,
					setShowCommandPalette: vi.fn(),
					showClipboard: false,
					setShowClipboard: vi.fn(),
				},
			})
		);

		expect(result.current.shellModalsProps.onCommandAction).toBe(
			result.current.handleCommandPaletteAction
		);
		expect(result.current.shellModalsProps.showCommandPalette).toBe(false);
	});
});
