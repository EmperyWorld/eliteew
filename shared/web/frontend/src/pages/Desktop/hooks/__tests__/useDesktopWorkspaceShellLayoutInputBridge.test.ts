/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for the T29 shell layout input bridge.
 *
 * Invariants:
 * - Critical sync, taskbar, overlay and folder/app action fields remain forwarded to the slot cluster contract.
 * - Grouped slice inputs flatten before the modals/layout cluster facade.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceShellLayoutInputBridge.ts
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopWorkspaceShellLayoutDerivedBridgeInput } from '../../types/desktopWorkspaceShellLayoutDerivedBridge.types';
import type { DesktopWorkspaceShellLayoutInputBridgeInput } from '../useDesktopWorkspaceShellLayoutInputBridge';

const flattenCanvas = vi.hoisted(() =>
	vi.fn((groups: Record<string, Record<string, unknown>>) => ({
		...groups.shellSurface,
		...groups.syncPersistence,
		...groups.iconInteractions,
		...groups.windowSlot,
		...groups.widgetsAndDrop,
		...groups.assistant,
		flattenedCanvas: true,
	}))
);
const flattenChrome = vi.hoisted(() =>
	vi.fn((groups: Record<string, Record<string, unknown>>) => ({
		...groups.taskbarViewport,
		...groups.expansionAndLaunch,
		...groups.windowsAndSession,
		...groups.overlayState,
		...groups.appStore,
		...groups.searchAndRecents,
		...groups.clipboardAndFolderActions,
		...groups.shellSettingsAndWallpaper,
		flattenedChrome: true,
	}))
);
const flattenDerived = vi.hoisted(() =>
	vi.fn((groups: DesktopWorkspaceShellLayoutDerivedBridgeInput) => ({
		...groups.contextMenuAndOverlays,
		...groups.shellSettingsAndAdmin,
		...groups.virtualDesktopsState,
		flattenedDerived: true,
	}))
);

const useDesktopWorkspaceShellModalsLayoutClusterInput = vi.hoisted(() =>
	vi.fn(
		(input: {
			canvasAndInteractions: Record<string, unknown>;
			chromeAndModalsRest: Record<string, unknown>;
			derived: Record<string, unknown>;
		}) => ({
			...input.canvasAndInteractions,
			...input.chromeAndModalsRest,
			...input.derived,
		})
	)
);

vi.mock('../useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput', () => ({
	useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput: flattenCanvas,
}));
vi.mock('../useDesktopWorkspaceShellLayoutChromeAndModalsInput', () => ({
	useDesktopWorkspaceShellLayoutChromeAndModalsInput: flattenChrome,
}));
vi.mock('../useDesktopWorkspaceShellLayoutDerivedInput', () => ({
	useDesktopWorkspaceShellLayoutDerivedInput: flattenDerived,
}));
vi.mock('../useDesktopWorkspaceShellModalsLayoutClusterInput', () => ({
	useDesktopWorkspaceShellModalsLayoutClusterInput,
}));

import { useDesktopWorkspaceShellLayoutInputBridge } from '../useDesktopWorkspaceShellLayoutInputBridge';

type BridgeFlattenProbe = {
	flattenedDerived?: boolean;
	handleTaskbarWinClick?: ReturnType<typeof vi.fn>;
	setShowQuickSearch?: ReturnType<typeof vi.fn>;
	handleDropToFolder?: ReturnType<typeof vi.fn>;
	openAppStoreAsWindow?: ReturnType<typeof vi.fn>;
	handleCreateFolder?: ReturnType<typeof vi.fn>;
};

describe('useDesktopWorkspaceShellLayoutInputBridge', () => {
	beforeEach(() => {
		flattenCanvas.mockClear();
		flattenChrome.mockClear();
		flattenDerived.mockClear();
		useDesktopWorkspaceShellModalsLayoutClusterInput.mockClear();
	});

	it('flattens grouped slices then keeps critical layout fields in the bridge contract', () => {
		const syncWorkspaceFromServer = vi.fn();
		const onRecoverStaleShellState = vi.fn();
		const handleTaskbarWinClick = vi.fn();
		const setShowQuickSearch = vi.fn();
		const handleDropToFolder = vi.fn();
		const openAppStoreAsWindow = vi.fn();
		const handleCreateFolder = vi.fn();

		const input = {
			derived: {
				contextMenuAndOverlays: {
					setWindowContextMenu: vi.fn(),
					setShowShortcutsHelp: vi.fn(),
					setShowSessionInfoPanel: vi.fn(),
				},
				shellSettingsAndAdmin: {
					openShellSettings: vi.fn(),
					canOpenUnifiedAdmin: false,
					handleOpenWindow: vi.fn(),
					unifiedAdminDesktopItem: { id: 'admin' },
				},
				virtualDesktopsState: {
					desktops: [],
					activeDesktopId: 'd1',
					createDesktop: vi.fn(),
					deleteDesktop: vi.fn(),
					switchToDesktop: vi.fn(),
					updateDesktopName: vi.fn(),
					workspaceProfiles: [],
					onOpenWorkspaceProfile: vi.fn(),
					vdDropHoverId: null,
				},
			},
			chromeAndModalsRest: {
				taskbarViewport: {
					handleTaskbarWinClick,
					setShowQuickSearch,
					openAppStoreAsWindow,
				},
				clipboardAndFolderActions: {
					handleCreateFolder,
				},
			},
			canvasAndInteractions: {
				syncPersistence: {
					isOnline: true,
					isSyncing: false,
					tabConflictDetected: false,
					staleShellStateConflict: true,
					syncWorkspaceFromServer,
					onRecoverStaleShellState,
				},
				iconInteractions: {
					handleDropToFolder,
				},
				windowSlot: {
					currentDesktopWindows: [
						{ id: 'win-1', appId: 'app-1', desktopId: 'desktop-a', zIndex: 42 },
					],
				},
			},
		} as unknown as DesktopWorkspaceShellLayoutInputBridgeInput;

		const { result } = renderHook(() =>
			useDesktopWorkspaceShellLayoutInputBridge(input)
		);
		const bridge = result.current as typeof result.current & BridgeFlattenProbe;

		expect(flattenCanvas).toHaveBeenCalledWith(input.canvasAndInteractions);
		expect(flattenChrome).toHaveBeenCalledWith(input.chromeAndModalsRest);
		expect(flattenDerived).toHaveBeenCalledWith(input.derived);
		expect(useDesktopWorkspaceShellModalsLayoutClusterInput).toHaveBeenCalled();
		expect(result.current.syncWorkspaceFromServer).toBe(
			syncWorkspaceFromServer
		);
		expect(result.current.onRecoverStaleShellState).toBe(
			onRecoverStaleShellState
		);
		expect(result.current.currentDesktopWindows).toHaveLength(1);
		expect(bridge.handleTaskbarWinClick).toBe(handleTaskbarWinClick);
		expect(bridge.setShowQuickSearch).toBe(setShowQuickSearch);
		expect(bridge.handleDropToFolder).toBe(handleDropToFolder);
		expect(bridge.openAppStoreAsWindow).toBe(openAppStoreAsWindow);
		expect(bridge.handleCreateFolder).toBe(handleCreateFolder);
		expect(bridge.flattenedDerived).toBe(true);
	});
});
