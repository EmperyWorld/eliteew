/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for the T29+ canvas/interactions layout bridge input assembler.
 *
 * Invariants:
 * - All six typed prop groups flatten into the canvas slice without field loss.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STATIC_DESKTOP_SETTINGS_PERFORMANCE } from '../../utils/desktopWorkspacePerformanceConstants';
import { useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput } from '../useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput';
import type { DesktopWorkspaceShellLayoutCanvasAndInteractionsBridgeInput } from '../../types/desktopWorkspaceShellLayoutCanvasBridge.types';
import type { ContextMenuState } from '../../types/desktop.types';

function buildMinimalGroups(): DesktopWorkspaceShellLayoutCanvasAndInteractionsBridgeInput {
	const syncWorkspaceFromServer = vi.fn();
	const handleDropToFolder = vi.fn();
	const onRecoverStaleShellState = vi.fn();

	return {
		shellSurface: {
			t: ((key: string) => key) as never,
			setSelected: vi.fn(),
			handleContextMenu: vi.fn(),
			showWelcome: false,
			onWelcomeComplete: vi.fn(),
			showDesktopWidget: true,
			floatingWidgetPerformanceForCanvas: STATIC_DESKTOP_SETTINGS_PERFORMANCE,
			autoQuietWindowLoad: false,
			isShellSettingsWindowOpen: false,
			desktopUnreadCount: 0,
			markAllAsRead: vi.fn(),
			widgetAvatarUrl: null,
			openSocialHubTab: vi.fn(),
			updateDesktopVisualPreferences: vi.fn(),
			desktopWidgetsStyle: 'glass',
			reduceMotionWorkspace: false,
			isWindowDragActive: false,
			openAppStoreAsWindow: vi.fn(),
			isItemsHydrating: false,
		},
		syncPersistence: {
			isOnline: true,
			isSyncing: false,
			combinedDesktopPersistenceError: null,
			tabConflictDetected: false,
			staleShellStateConflict: true,
			syncWorkspaceFromServer,
			performWorkspaceRefresh: vi.fn(),
			clearTabConflict: vi.fn(),
			onRecoverStaleShellState,
			loadFailure: null,
			clearLoadFailure: vi.fn(),
			syncToServer: vi.fn(),
			onFlushPersistPatches: vi.fn(),
			persistQueuedPatches: 2,
		},
		iconInteractions: {
			isDraggingIcon: false,
			gridStep: 'medium',
			showEnhancedContextMenu: false,
			contextMenuPosition: { x: 0, y: 0 },
			setShowEnhancedContextMenu: vi.fn(),
			items: [],
			selected: new Set<string>(),
			contextMenuType: 'desktop',
			clipboard: [],
			iconSizeConfig: 'medium',
			snapToGridEnabled: true,
			desktopUiScale: 1,
			ctx: {
				isOpen: false,
				x: 0,
				y: 0,
				targetType: 'desktop',
			} satisfies ContextMenuState,
			propertiesItem: null,
			setPropertiesItem: vi.fn(),
			iconSize: 'medium',
			desktopItemBadgeCounts: {},
			folderChildCounts: {},
			folderPreviewByFolderId: {},
			handleDesktopIconSelect: vi.fn(),
			handleDragStart: vi.fn(),
			handleDesktopIconDragEnd: vi.fn(),
			handleDrag: vi.fn(),
			handleDropToFolder,
			handleDesktopIconRename: vi.fn(),
			handleStartIconRename: vi.fn(),
			handleCancelIconRename: vi.fn(),
			renamingId: null,
			iconIsCut: vi.fn(),
			activeDropTargetFolderId: null,
			setActiveDropTargetFolderId: vi.fn(),
			handleRubberBandSelection: vi.fn(),
			desktopAreaRef: { current: null },
		},
		windowSlot: {
			windowContextMenu: null,
			activeDesktopId: 'desktop-a',
			onVdDropHover: vi.fn(),
			desktops: [],
			minimizeWindow: vi.fn(),
			maximizeWindow: vi.fn(),
			closeWindow: vi.fn(),
			toggleWindowAlwaysOnTop: vi.fn(),
			onToggleAlwaysOnTop: vi.fn(),
			onDuplicateWindow: vi.fn(),
			activeWindowAlwaysOnTop: false,
			moveWindowToDesktop: vi.fn(),
			onOpenShellSettings: vi.fn(),
			snapZone: null,
			moveWindow: vi.fn(),
			resizeWindow: vi.fn(),
			handleWindowDrag: vi.fn(),
			handleWindowDragCommit: vi.fn(),
			updateSnapZone: vi.fn(),
			getSnapZoneForPosition: vi.fn(),
			clearSnapZone: vi.fn(),
			snapWindow: vi.fn(),
			registerBeforeClose: vi.fn(),
			unregisterBeforeClose: vi.fn(),
			updateWindowPayload: vi.fn(),
			retargetFolderWindow: vi.fn(),
			installedApps: [],
			onBringWindowIntoWorkArea: vi.fn(),
		},
		widgetsAndDrop: {
			widgetPosition: { x: 0, y: 0 },
			onWidgetPositionCommit: vi.fn(),
			onBackgroundContentDragOver: vi.fn(),
			onBackgroundContentDrop: vi.fn(),
			onExternalContentDropToFolder: vi.fn(),
			widgetsPanel: null,
		},
		assistant: {
			assistantWindowContextSummarizeEnabled: true,
			assistantWindowContextGafEnabled: false,
			onWindowContextAssistantSummarize: vi.fn(),
			onWindowContextAssistantShareGaf: vi.fn(),
			assistantPropertiesPanelActions: [],
			onAssistantPropertiesPanelAction: vi.fn(),
		},
	};
}

describe('useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput', () => {
	it('flattens all six prop groups into the canvas slice contract', () => {
		const groups = buildMinimalGroups();

		const { result } = renderHook(() =>
			useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput(groups)
		);

		expect(result.current.syncWorkspaceFromServer).toBe(
			groups.syncPersistence.syncWorkspaceFromServer
		);
		expect(result.current.performWorkspaceRefresh).toBe(
			groups.syncPersistence.performWorkspaceRefresh
		);
		expect(typeof result.current.performWorkspaceRefresh).toBe('function');
		expect(result.current.onRecoverStaleShellState).toBe(
			groups.syncPersistence.onRecoverStaleShellState
		);
		expect(result.current.staleShellStateConflict).toBe(true);
		expect(result.current.persistQueuedPatches).toBe(2);
		expect(result.current.handleDropToFolder).toBe(
			groups.iconInteractions.handleDropToFolder
		);
		expect(result.current.activeDesktopId).toBe('desktop-a');
		expect(result.current.widgetsPanel).toBeNull();
		expect(result.current.assistantWindowContextSummarizeEnabled).toBe(true);
		expect(result.current.openAppStoreAsWindow).toBe(
			groups.shellSurface.openAppStoreAsWindow
		);
	});
});
