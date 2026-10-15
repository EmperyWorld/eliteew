/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types for EnhancedContextMenu (position, items, props).
 *
 * Invariants:
 * - Menu item ids are globally unique across nested submenus.
 * - contextType no longer includes `window` (workspace window chrome is separate).
 *
 * Related:
 * - EnhancedContextMenu.tsx (P30 atomization)
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */

import type * as React from 'react';
import type { DesktopItem } from '../../types/desktop.types';
import type { DesktopWindowStyle } from '../../../../types/profile';

export type ContextMenuPosition = { x: number; y: number };

export type ContextMenuItem = {
	id: string;
	label: string;
	icon?: React.ReactNode;
	action?: () => void;
	submenu?: ContextMenuItem[];
	separator?: boolean;
	disabled?: boolean;
	shortcut?: string;
	badge?: string;
	checked?: boolean;
};

/** Known EnhancedContextMenu action ids (`ui-scale-*` is a dynamic prefix). */
export type EnhancedContextMenuActionId =
	| 'refresh'
	| 'new-folder'
	| 'paste'
	| 'cut'
	| 'copy'
	| 'delete'
	| 'rename'
	| 'open'
	| 'pin'
	| 'unpin'
	| 'properties'
	| 'download'
	| 'move-here'
	| 'move-to-desktop'
	| 'open-in-doc-editor'
	| 'open-in-content-manager'
	| 'play-in-music-player'
	| 'send-to-gaf-chat'
	| 'send-to-desktop-ai'
	| 'assign-content-to-project'
	| 'view-icon-small'
	| 'view-icon-medium'
	| 'view-icon-large'
	| 'view-snap-grid'
	| 'appearance'
	| 'wallpaper'
	| 'settings'
	| 'open-app-store'
	| 'open-control-center'
	| 'assistant'
	| 'gaf';

export interface EnhancedContextMenuProps {
	isVisible: boolean;
	position: ContextMenuPosition;
	onClose: () => void;
	selectedItems: DesktopItem[];
	contextType: 'desktop' | 'folder' | 'file' | 'app';
	onAction?: (actionId: EnhancedContextMenuActionId | string) => void;
	/** For desktop context: paste is enabled when clipboard has items */
	hasClipboard?: boolean;
	/** Current icon size (for desktop View submenu checkmark) */
	iconSize?: 'small' | 'medium' | 'large';
	/** Current snap-to-grid (for desktop View submenu checkmark) */
	snapToGrid?: boolean;
	/** Текущий масштаб стола (для подменю пресетов 50–150%). */
	desktopUiScale?: number;
	/** Item that was right-clicked (folder for "move selected here") */
	targetItem?: DesktopItem | null;
	/** @deprecated Window chrome uses DesktopWorkspaceWindowContextMenu. */
	activeWindowAlwaysOnTop?: boolean;
	/** Пресет «Стиль окон» оболочки — ПКМ совпадает с рамкой/фоном панелей. */
	shellWindowStyle?: DesktopWindowStyle;
}

export type CreateContextMenuItemsParams = {
	contextType: EnhancedContextMenuProps['contextType'];
	selectedItems: DesktopItem[];
	targetItem: DesktopItem | null;
	hasClipboard: boolean;
	iconSize: 'small' | 'medium' | 'large';
	snapToGrid: boolean;
	desktopUiScale: number;
	activeWindowAlwaysOnTop: boolean;
	fireAction: (id: EnhancedContextMenuActionId | string) => void;
	t: (key: string, options?: Record<string, unknown>) => string;
};
