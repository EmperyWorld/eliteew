/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 24: build `canvasAndInteractions` group for Shell Layout bridge input.
 *
 * Related:
 * - buildDesktopWorkspaceShellLayoutInputBridgeInput.ts
 */

import type { DesktopWorkspaceShellLayoutInputBridgeInput } from '../../hooks/useDesktopWorkspaceShellLayoutInputBridge';
import type { DesktopWorkspaceShellLayoutInputAssemblySources } from './desktopWorkspaceShellLayoutInputAssembly.types';
import { DESKTOP_FLOATING_WIDGET_POSITION_SEED } from '../../constants';

export function buildDesktopWorkspaceShellLayoutBridgeCanvasAndInteractions(
	sources: DesktopWorkspaceShellLayoutInputAssemblySources
): DesktopWorkspaceShellLayoutInputBridgeInput['canvasAndInteractions'] {
	return {
		shellSurface: {
			t: sources.t,
			setSelected: sources.setSelected,
			handleContextMenu: sources.handleContextMenu,
			showWelcome: sources.showWelcome,
			onWelcomeComplete: sources.onWelcomeComplete,
			showDesktopWidget: sources.showDesktopWidget,
			floatingWidgetPerformanceForCanvas:
				sources.floatingWidgetPerformanceForCanvas,
			autoQuietWindowLoad: sources.autoQuietWindowLoad,
			isShellSettingsWindowOpen: sources.isShellSettingsWindowOpen,
			desktopUnreadCount: sources.desktopUnreadCount,
			markAllAsRead: sources.markAllAsRead,
			widgetAvatarUrl: sources.widgetAvatarUrl,
			openSocialHubTab: sources.openSocialHubTab,
			updateDesktopVisualPreferences: sources.updateDesktopVisualPreferences,
			desktopWidgetsStyle:
				sources.desktopVisualPreferences.desktop_widgets_style,
			reduceMotionWorkspace: sources.reduceMotionWorkspace,
			isWindowDragActive: sources.isWindowDragActive,
			openAppStoreAsWindow: sources.openAppStoreAsWindow,
			isItemsHydrating: sources.isItemsHydrating,
		},
		syncPersistence: {
			isOnline: sources.isOnline,
			isSyncing: sources.isSyncing || sources.persistQueueFlushing,
			shellStatePipelinePhase: sources.shellStatePipelinePhase,
			combinedDesktopPersistenceError: sources.canvasSyncPersistenceError,
			tabConflictDetected: sources.tabConflictDetected,
			staleShellStateConflict: sources.staleShellStateConflict,
			syncWorkspaceFromServer: sources.syncWorkspaceFromServer,
			performWorkspaceRefresh: sources.performWorkspaceRefresh,
			clearTabConflict: sources.clearTabConflict,
			onRecoverStaleShellState: sources.recoverStaleShellState,
			loadFailure: sources.loadFailure,
			clearLoadFailure: sources.clearLoadFailure,
			syncToServer: sources.syncToServer,
			onFlushPersistPatches: sources.flushPersistPatches,
			persistQueuedPatches:
				sources.persistPatchStats.total +
				(sources.widgetOutboxPendingCount || 0),
		},
		iconInteractions: {
			isDraggingIcon: sources.isDraggingIcon,
			gridStep: sources.gridStep,
			showEnhancedContextMenu: sources.showEnhancedContextMenu,
			contextMenuPosition: sources.contextMenuPosition,
			setShowEnhancedContextMenu: sources.setShowEnhancedContextMenu,
			items: sources.items,
			selected: sources.selected,
			contextMenuType:
				sources.contextMenuType === 'window'
					? 'desktop'
					: sources.contextMenuType,
			clipboard: sources.clipboard,
			iconSizeConfig: sources.iconSize,
			snapToGridEnabled: sources.snapToGridEnabled,
			desktopUiScale: sources.desktopUiScale,
			ctx: sources.ctx,
			propertiesItem: sources.propertiesItem,
			setPropertiesItem: sources.setPropertiesItem,
			iconSize: sources.iconSize,
			desktopItemBadgeCounts: sources.desktopItemBadgeCounts,
			folderChildCounts: sources.folderChildCounts,
			folderPreviewByFolderId: sources.folderPreviewByFolderId,
			handleDesktopIconSelect: sources.handleDesktopIconSelect,
			handleDragStart: sources.handleDragStart,
			handleDesktopIconDragEnd: sources.handleDesktopIconDragEnd,
			handleDrag: sources.handleDrag,
			handleDropToFolder: sources.handleDropToFolder,
			handleDesktopIconRename: sources.handleDesktopIconRename,
			handleStartIconRename: sources.handleStartIconRename,
			handleCancelIconRename: sources.handleCancelIconRename,
			renamingId: sources.renamingId,
			iconIsCut: sources.iconIsCut,
			activeDropTargetFolderId: sources.activeDropTargetFolderId,
			setActiveDropTargetFolderId: sources.setActiveDropTargetFolderId,
			handleRubberBandSelection: sources.handleRubberBandSelection,
			desktopAreaRef: sources.desktopAreaRef,
		},
		windowSlot: {
			windowContextMenu: sources.windowContextMenu,
			activeDesktopId: sources.activeDesktopId,
			onVdDropHover: sources.onVdDropHover,
			desktops: sources.desktops,
			minimizeWindow: sources.minimizeWindow,
			maximizeWindow: sources.maximizeWindow,
			closeWindow: sources.closeWindow,
			toggleWindowAlwaysOnTop: sources.toggleWindowAlwaysOnTop,
			onToggleAlwaysOnTop: sources.toggleWindowAlwaysOnTop,
			onDuplicateWindow: sources.handleDuplicateWindow,
			activeWindowAlwaysOnTop:
				sources.activeDesktopWindow?.alwaysOnTop === true,
			moveWindowToDesktop: sources.moveWindowToDesktop,
			onOpenShellSettings: sources.openShellSettings,
			snapZone: sources.snapZone,
			moveWindow: sources.moveWindow,
			resizeWindow: sources.resizeWindow,
			handleWindowDrag: sources.handleWindowDrag,
			handleWindowDragCommit: sources.trackedHandleWindowDragCommit,
			updateSnapZone: sources.updateSnapZone,
			getSnapZoneForPosition: sources.getSnapZoneForPosition,
			clearSnapZone: sources.clearSnapZone,
			snapWindow: sources.snapWindow,
			registerBeforeClose: sources.registerBeforeClose,
			unregisterBeforeClose: sources.unregisterBeforeClose,
			updateWindowPayload: sources.updateWindowPayload,
			retargetFolderWindow: sources.retargetFolderWindow,
			installedApps: sources.installedApps,
			onBringWindowIntoWorkArea: sources.bringWindowIntoWorkAreaById,
		},
		widgetsAndDrop: {
			widgetPosition: sources.config?.widget_position ?? {
				...DESKTOP_FLOATING_WIDGET_POSITION_SEED,
			},
			onWidgetPositionCommit: (next) => {
				if (!sources.config) return;
				void sources.updateConfig({ widget_position: next });
			},
			onBackgroundContentDragOver: sources.onBackgroundContentDragOver,
			onBackgroundContentDrop: sources.onBackgroundContentDrop,
			onExternalContentDropToFolder: sources.onExternalContentDropToFolder,
			widgetsPanel: sources.desktopWidgetsPanelProps,
		},
		assistant: {
			assistantWindowContextSummarizeEnabled:
				sources.assistantWindowContextSummarizeEnabled,
			assistantWindowContextGafEnabled:
				sources.assistantWindowContextGafEnabled,
			onWindowContextAssistantSummarize:
				sources.onWindowContextAssistantSummarize,
			onWindowContextAssistantShareGaf:
				sources.onWindowContextAssistantShareGaf,
			assistantPropertiesPanelActions: sources.assistantPropertiesPanelActions,
			onAssistantPropertiesPanelAction:
				sources.onAssistantPropertiesPanelAction,
		},
	};
}
