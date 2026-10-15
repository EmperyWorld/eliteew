/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props contract for draggable desktop icon (native mouse + optional HTML5 CM export).
 *
 * Invariants:
 * - Reposition drag uses mouse events + rAF translate3d preview on wrapper ref.
 *
 * Related:
 * - desktopIcon/DesktopIcon.tsx
 * - hooks/useDesktopWorkspaceIconInteractions.ts
 */

import type * as React from 'react';
import type { DesktopIconStyle } from '@/types/profile';
import type { IconSizePreference } from '../../constants';
import type {
	DesktopFolderPreviewEntry,
	DesktopItem,
} from '../../types/desktop.types';

export interface DesktopIconProps {
	item: DesktopItem;
	isSelected: boolean;
	onSelect: (e: React.MouseEvent) => void;
	onDoubleClick: () => void;
	onContextMenu: (e: React.MouseEvent) => void;
	onDragStart?: () => void;
	onDragEnd: (
		x: number,
		y: number,
		opts?: { droppedOnFolder?: boolean; cancelled?: boolean }
	) => void;
	/** During drag, report position (for group drag delta) */
	onDrag?: (x: number, y: number) => void;
	onDropToFolder?: (itemId: string, folderId: string) => void;
	/** HTML5: drop library content from Content Manager onto this folder icon. */
	onExternalContentDropToFolder?: (
		e: React.DragEvent,
		folderId: string
	) => void;
	allItems?: DesktopItem[];
	isRenaming?: boolean;
	onRename?: (newName: string) => void;
	onCancelRename?: () => void;
	isCut?: boolean;
	/** Keyboard nav: tabIndex 0 for focused icon, -1 otherwise */
	tabIndex?: number;
	/** Ref for the focusable wrapper (roving tabindex) */
	iconRef?:
		| React.RefCallback<HTMLDivElement>
		| React.RefObject<HTMLDivElement | null>;
	/** Keydown handler for Arrow/Enter/F2/Menu (handled by layer) */
	onKeyDown?: (e: React.KeyboardEvent) => void;
	/** From config.icon_size */
	iconSize?: IconSizePreference;
	/** Server-backed visual chrome preset for desktop icons. */
	visualStyle?: DesktopIconStyle;
	/** When dragging, report folder under cursor so that folder can show drop target highlight */
	onDropTargetChange?: (folderId: string | null) => void;
	/** Folder id that is currently the drop target (this icon shows highlight when item is folder and id matches) */
	activeDropTargetFolderId?: string | null;
	/** Optional unread badge count for app icons (e.g. chat). */
	badgeCount?: number;
	/** Number of direct child items when this icon is a folder (`parentId` chain). */
	folderChildCount?: number;
	/** Direct children to show as a small mosaic on folder icons. */
	folderPreviewEntries?: readonly DesktopFolderPreviewEntry[];
	/** Multi-select: used when starting HTML5 drag (Alt+drag) of file shortcuts toward Content Manager. */
	selectedIds?: ReadonlySet<string>;
}
