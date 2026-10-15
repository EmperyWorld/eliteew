/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bidirectional converters between frontend desktop models and OpenAPI item/config shapes.
 *
 * Invariants:
 * - Folder icon id travels in item `meta` via `buildDesktopItemMetaForApi` / `readFolderIconIdFromMeta`.
 *
 * Related:
 * - `types/desktop.types.ts`
 * - `utils/desktopFolderIconMeta.ts`
 */

import type { DesktopItem } from '../../types/desktop.types';
import {
	buildDesktopItemMetaForApi,
	readFolderIconIdFromMeta,
} from '../../utils/desktopFolderIconMeta';
import type {
	DesktopItemCreate,
	DesktopItemResponse,
	IconSize,
	ItemType,
	Theme,
} from './types';

/**
 * Convert frontend DesktopItem to API format
 */
export function toApiItem(item: DesktopItem): DesktopItemCreate {
	const meta = buildDesktopItemMetaForApi(item);
	return {
		item_id: item.id,
		item_type: item.type.toUpperCase() as ItemType,
		name: item.name,
		position: item.position,
		color: item.color || null,
		gradient: item.gradient || null,
		is_pinned: item.isPinned || false,
		app_component: item.appComponent || null,
		parent_item_id: item.parentId ?? null,
		...(meta ? { meta } : {}),
	};
}

/**
 * Normalize position from API (ensure { x, y } numbers)
 */
function normalizePosition(pos: unknown): { x: number; y: number } {
	if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos) {
		const p = pos as { x?: unknown; y?: unknown };
		return {
			x: typeof p.x === 'number' ? p.x : Number(p.x) || 20,
			y: typeof p.y === 'number' ? p.y : Number(p.y) || 20,
		};
	}
	return { x: 20, y: 20 };
}

/**
 * Convert API item to frontend DesktopItem format
 */
export function fromApiItem(item: DesktopItemResponse): Partial<DesktopItem> {
	return {
		id: item.item_id,
		name: item.name,
		type: item.item_type.toLowerCase() as 'folder' | 'file' | 'app',
		position: normalizePosition(item.position),
		color: item.color || undefined,
		gradient: item.gradient || undefined,
		isPinned: item.is_pinned,
		appComponent: item.app_component || undefined,
		isSystem: item.is_system ?? false,
		systemKey: item.system_key ?? undefined,
		parentId: item.parent_item_id ?? item.parent_id ?? undefined,
		meta: item.meta ?? undefined,
		folderIconId: readFolderIconIdFromMeta(item.meta),
		created_at: item.created_at,
		updated_at: item.updated_at,
	};
}

/**
 * Convert icon size from API to frontend format
 */
export function fromApiIconSize(size: IconSize): 'small' | 'medium' | 'large' {
	return size.toLowerCase() as 'small' | 'medium' | 'large';
}

/**
 * Convert icon size from frontend to API format
 */
export function toApiIconSize(size: 'small' | 'medium' | 'large'): IconSize {
	return size.toUpperCase() as IconSize;
}

/**
 * Convert theme from API to frontend format
 */
export function fromApiTheme(theme: Theme): 'dark' | 'light' | 'auto' {
	return theme.toLowerCase() as 'dark' | 'light' | 'auto';
}

/**
 * Convert theme from frontend to API format
 */
export function toApiTheme(theme: 'dark' | 'light' | 'auto'): Theme {
	return theme.toUpperCase() as Theme;
}
