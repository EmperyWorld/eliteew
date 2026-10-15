/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props contract for DesktopWidgetsPanel (P32 atomization).
 *
 * Invariants:
 * - Mirrors shell/widget state callbacks; no separate domain stores.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 * - useDesktopWorkspaceWidgetsPanelProps.ts
 */

import type { DesktopWidgetsStyle } from '../../../../types/profile';
import type {
	DesktopAppCollection,
	DesktopContentShortcut,
	DesktopWidgetLayoutSlot,
	DesktopWidgetsLayout,
	DesktopWorkspaceProfile,
} from '../../types/desktopExpansion.types';
import type {
	RecentFile,
	WidgetsPanelPosition,
} from '../../types/desktop.types';

export type DesktopWidgetsPanelProps = {
	widgetsLayout: DesktopWidgetsLayout;
	workspaceProfiles: DesktopWorkspaceProfile[];
	activeDesktopId: string;
	panelPosition: WidgetsPanelPosition;
	compactWidgetsGlobal: boolean;
	widgetsStyle: DesktopWidgetsStyle;
	appCollections: DesktopAppCollection[];
	contentShortcuts: DesktopContentShortcut[];
	recentOpened: RecentFile[];
	desktopUnreadCount: number;
	markAllAsRead: () => void;
	onOpenNotificationCenter: () => void;
	onOpenEwDesk: () => void;
	onOpenMusicPlayer: () => void;
	onOpenContentShortcut: (id: string) => void;
	onOpenAppCollection: (id: string) => void;
	onOpenRecentFile: (file: RecentFile) => void;
	/** Сдвиг от якоря (сохраняется в `shell_state.widgets_layout.panelOffset`). */
	panelOffset: { x: number; y: number };
	onPanelOffsetCommit?: (next: { x: number; y: number }) => void;
	/** Свободная раскладка: зафиксировать позицию слота (layout px). */
	onSlotPositionCommit?: (
		slotId: string,
		next: { x: number; y: number }
	) => void;
	/** Свободная раскладка: сдвинуть все включённые слоты на дельту (layout px). */
	onAllWidgetSlotsOffsetCommit?: (delta: { x: number; y: number }) => void;
	/** Дозаполнить отсутствующие координаты при `slotPlacement: free`. */
	onEnsureFreeSlotPositions?: () => void;
	/** Secondary: open the related app window after the live slot body. */
	onOpenWidgetSlotExpanded?: (type: DesktopWidgetLayoutSlot['type']) => void;
	/** Welcome-tour preview: example panel, no persist side effects. */
	tourPreview?: boolean;
};
