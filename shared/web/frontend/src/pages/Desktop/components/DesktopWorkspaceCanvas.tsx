/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layers on the desktop canvas: scene decor, welcome, floating widget, sync, grid,
 * context menus, icons, empty state, rubber-band selection. No window layer / taskbar.
 *
 * Invariants:
 * - Floating widget placement hints (`iconReservedViewportBounds`) apply only to free viewport coords.
 * - Icon layer props are passed through unchanged; motion policy lives in `DesktopIconLayer`.
 * - Widgets, floating widget, welcome/tour chrome, and context/properties overlays are
 *   dynamic imports; they must not sit in the DesktopWorkspaceContent static graph.
 *
 * Related:
 * - `hooks/useDesktopWorkspaceShellCanvasProps.ts`
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */
import { AnimatePresence } from 'framer-motion';
import * as React from 'react';
import { lazy } from 'react';
import type { DesktopWidgetsStyle } from '../../../types/profile';
import {
	DESKTOP_GRID,
	DESKTOP_GRID_STEPS,
	type GridStepPreference,
	type IconSizePreference,
} from '../constants';
import type { ViewportRect } from '../utils/desktopFloatingWidgetPlacement';
import type { DesktopItem } from '../types/desktop.types';
import type { DesktopAssistantContextAction } from '../types/desktopExpansion.types';
import type { DesktopIconLayerProps } from './DesktopIconLayer';
import { DesktopIconLayer } from './DesktopIconLayer';
import {
	DesktopSyncStatus,
	type DesktopSyncStatusProps,
} from './DesktopSyncStatus';
import type { DesktopWelcomeCompleteOptions } from './DesktopWelcomeScreen';
import type { DesktopWorkspaceFloatingWidgetProps } from './DesktopWorkspaceFloatingWidget';
import { DesktopWorkspaceEmptyState } from './DesktopWorkspaceEmptyState';
import { DesktopWorkspaceOfflineBanner } from './DesktopWorkspaceOfflineBanner';
import {
	DesktopWorkspaceSceneDecor,
	type DesktopWorkspaceSceneDecorProps,
} from './DesktopWorkspaceSceneDecor';
import type { EnhancedContextMenuProps } from './enhancedContextMenu/types';
import { GridOverlay } from './GridOverlay';
import { SelectionBox } from './SelectionBox';
import type { DesktopWidgetsPanelProps } from './DesktopWidgetsPanel';
import { DesktopDeferredMount } from './DesktopDeferredMount';

const DesktopWelcomeScreen = lazy(() =>
	import('./DesktopWelcomeScreen').then((m) => ({
		default: m.DesktopWelcomeScreen,
	}))
);
const DesktopWorkspaceFloatingWidget = lazy(() =>
	import('./DesktopWorkspaceFloatingWidget').then((m) => ({
		default: m.DesktopWorkspaceFloatingWidget,
	}))
);
const EnhancedContextMenu = lazy(() =>
	import('./EnhancedContextMenu').then((m) => ({
		default: m.EnhancedContextMenu,
	}))
);
const ItemPropertiesModal = lazy(() =>
	import('./ItemPropertiesModal').then((m) => ({
		default: m.ItemPropertiesModal,
	}))
);
const DesktopWidgetsPanel = lazy(() =>
	import('./DesktopWidgetsPanel').then((m) => ({
		default: m.DesktopWidgetsPanel,
	}))
);
const WelcomeTourWorkspaceExample = lazy(() =>
	import('./welcomeTour/WelcomeTourWorkspaceExample').then((m) => ({
		default: m.WelcomeTourWorkspaceExample,
	}))
);
const WelcomeTourIconsExample = lazy(() =>
	import('./welcomeTour/WelcomeTourIconsExample').then((m) => ({
		default: m.WelcomeTourIconsExample,
	}))
);

export interface DesktopWorkspaceCanvasProps {
	sceneDecor: DesktopWorkspaceSceneDecorProps;
	welcome: {
		show: boolean;
		onComplete: (options: DesktopWelcomeCompleteOptions) => void;
	};
	showFloatingWidget: boolean;
	floatingWidget: {
		performance: DesktopWorkspaceFloatingWidgetProps['performance'];
		suspendTelemetry?: boolean;
		deferRealtimeUpdates?: boolean;
		windowCount: number;
		notifications: DesktopWorkspaceFloatingWidgetProps['notifications'];
		avatarUrl: string | null;
		onOpenProfile: () => void;
		onHide: () => void;
		onOpenPerformanceSettings?: () => void;
		onOpenNotificationCenter?: () => void;
		widgetsStyle: DesktopWidgetsStyle;
		widgetPosition: { x: number; y: number };
		onWidgetPositionCommit?: (next: { x: number; y: number }) => void;
		/** Viewport bounds of the desktop icon grid; used to nudge free-positioned widget. */
		iconReservedViewportBounds?: ViewportRect | null;
	};
	sync: Pick<
		DesktopSyncStatusProps,
		| 'isOnline'
		| 'isSyncing'
		| 'error'
		| 'tabConflictDetected'
		| 'staleShellStateConflict'
		| 'shellStatePipelinePhase'
		| 'onRefresh'
		| 'onDismissConflict'
		| 'onRecoverStaleShellState'
		| 'onRetry'
		| 'pendingQueuedPatches'
		| 'onPersistQueueRetry'
	>;
	isDraggingIcon: boolean;
	gridStep: GridStepPreference;
	enhancedContextMenu: EnhancedContextMenuProps;
	properties: {
		item: DesktopItem | null;
		pathLabel: string;
		onClose: () => void;
		assistantActions: DesktopAssistantContextAction[];
		onAssistantAction: (actionId: string) => void;
	};
	iconLayer: DesktopIconLayerProps;
	showEmptyState: boolean;
	emptyState: {
		title: string;
		description: string;
		appStoreLabel: string;
		onOpenAppStore: () => void;
	};
	selectionBox: {
		items: DesktopItem[];
		onSelectionChange: (ids: Set<string> | null) => void;
		containerRef: React.RefObject<HTMLElement | null>;
		selectedIds: Set<string>;
		iconSize: IconSizePreference;
	};
	/** Закреплённая панель слотов виджетов; `null` — не показывать. */
	widgetsPanel: DesktopWidgetsPanelProps | null;
	/** Widgets / floating widget / tour chrome wait for deferred Desktop runtime. */
	mountDeferredLayers?: boolean;
}

export const DesktopWorkspaceCanvas: React.FC<DesktopWorkspaceCanvasProps> = ({
	sceneDecor,
	welcome,
	showFloatingWidget,
	floatingWidget,
	sync,
	isDraggingIcon,
	gridStep,
	enhancedContextMenu,
	properties,
	iconLayer,
	showEmptyState,
	emptyState,
	selectionBox,
	widgetsPanel,
	mountDeferredLayers = false,
}) => (
	<>
		<DesktopWorkspaceSceneDecor {...sceneDecor} />
		<DesktopDeferredMount active={mountDeferredLayers}>
			<WelcomeTourWorkspaceExample />
		</DesktopDeferredMount>
		<DesktopDeferredMount active={mountDeferredLayers && welcome.show}>
			<AnimatePresence>
				{welcome.show ? (
					<DesktopWelcomeScreen onComplete={welcome.onComplete} />
				) : null}
			</AnimatePresence>
		</DesktopDeferredMount>

		<DesktopDeferredMount active={mountDeferredLayers && showFloatingWidget}>
			<DesktopWorkspaceFloatingWidget
				performance={floatingWidget.performance}
				suspendTelemetry={floatingWidget.suspendTelemetry}
				deferRealtimeUpdates={floatingWidget.deferRealtimeUpdates}
				windowCount={floatingWidget.windowCount}
				notifications={floatingWidget.notifications}
				avatarUrl={floatingWidget.avatarUrl}
				onOpenProfile={floatingWidget.onOpenProfile}
				onHide={floatingWidget.onHide}
				onOpenPerformanceSettings={floatingWidget.onOpenPerformanceSettings}
				onOpenNotificationCenter={floatingWidget.onOpenNotificationCenter}
				widgetsStyle={floatingWidget.widgetsStyle}
				widgetPosition={floatingWidget.widgetPosition}
				onWidgetPositionCommit={floatingWidget.onWidgetPositionCommit}
				iconReservedViewportBounds={floatingWidget.iconReservedViewportBounds}
			/>
		</DesktopDeferredMount>

		{!sync.isOnline ? (
			<DesktopWorkspaceOfflineBanner onRetry={sync.onRetry} />
		) : null}

		<DesktopSyncStatus
			isOnline={sync.isOnline}
			isSyncing={sync.isSyncing}
			shellStatePipelinePhase={sync.shellStatePipelinePhase}
			error={sync.error}
			tabConflictDetected={sync.tabConflictDetected}
			staleShellStateConflict={sync.staleShellStateConflict}
			onRefresh={sync.onRefresh}
			onDismissConflict={sync.onDismissConflict}
			onRecoverStaleShellState={sync.onRecoverStaleShellState}
			onRetry={sync.onRetry}
			pendingQueuedPatches={sync.pendingQueuedPatches}
			onPersistQueueRetry={sync.onPersistQueueRetry}
		/>

		<GridOverlay
			visible={isDraggingIcon}
			gridSize={DESKTOP_GRID_STEPS[gridStep]}
			offset={DESKTOP_GRID.OFFSET}
		/>

		<DesktopDeferredMount active={enhancedContextMenu.isVisible}>
			<EnhancedContextMenu
				key={`${enhancedContextMenu.position.x}-${enhancedContextMenu.position.y}-${enhancedContextMenu.contextType}`}
				{...enhancedContextMenu}
			/>
		</DesktopDeferredMount>

		<DesktopDeferredMount active={properties.item != null}>
			{properties.item ? (
				<ItemPropertiesModal
					item={properties.item}
					pathLabel={properties.pathLabel}
					onClose={properties.onClose}
					assistantActions={properties.assistantActions}
					onAssistantAction={properties.onAssistantAction}
				/>
			) : null}
		</DesktopDeferredMount>

		<DesktopIconLayer {...iconLayer} />
		<DesktopDeferredMount
			active={mountDeferredLayers && iconLayer.items.length === 0}
		>
			<WelcomeTourIconsExample />
		</DesktopDeferredMount>

		{showEmptyState && (
			<DesktopWorkspaceEmptyState
				title={emptyState.title}
				description={emptyState.description}
				appStoreLabel={emptyState.appStoreLabel}
				onOpenAppStore={emptyState.onOpenAppStore}
			/>
		)}

		<SelectionBox
			enabled={true}
			items={selectionBox.items}
			onSelectionChange={selectionBox.onSelectionChange}
			containerRef={selectionBox.containerRef}
			selectedIds={selectionBox.selectedIds}
			iconSize={selectionBox.iconSize}
		/>
		<DesktopDeferredMount active={mountDeferredLayers && widgetsPanel != null}>
			{widgetsPanel ? <DesktopWidgetsPanel {...widgetsPanel} /> : null}
		</DesktopDeferredMount>
	</>
);
