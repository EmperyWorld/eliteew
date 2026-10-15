/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Create-folder item factory and markdown desktop shortcut create flow for
 * `useDesktopStorage` (upload + local item + optional server upsert).
 *
 * Invariants:
 * - Folder ids are client-generated (`folder-<ts>`); markdown shortcut id = content id.
 * - Duplicate markdown shortcut under the same parent is not appended twice.
 *
 * Related:
 * - hooks/useDesktopStorage.ts
 * - utils/createDesktopMarkdownFile.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import { notify } from '@/notifications';
import type { TFunction } from 'i18next';
import { contentApi } from '../../../services/contentApi';
import { log } from '../../../utils/logger';
import {
	DESKTOP_GRID,
	DESKTOP_GRID_STEPS,
	DESKTOP_ICON_SIZES,
} from '../constants';
import {
	type UserFolderIconId,
	resolveUserFolderIconNode,
} from '../constants/folderIcons';
import { upsertDesktopItem } from '../services/desktopApi';
import { toApiItem } from '../services/desktopApi';
import {
	buildDesktopMarkdownFileItem,
	createEmptyMarkdownBlob,
	resolveNextMarkdownFilename,
} from './createDesktopMarkdownFile';
import {
	defaultCreateFolderIconId,
	withFolderIconOnItem,
} from './desktopFolderIconMeta';
import { findNearestFreePosition, snapToGrid } from './desktopGrid';
import { readDesktopWorkArea } from './desktopSnapGeometry';
import type { DesktopConfig, DesktopItem } from '../types/desktop.types';

export function buildDesktopCreateFolderItem(params: {
	name: string;
	items: DesktopItem[];
	parentId?: string;
	folderIconId?: UserFolderIconId;
}): DesktopItem {
	const parentId = params.parentId;
	const folderIconId = params.folderIconId ?? defaultCreateFolderIconId();
	let position = { x: 350, y: 20 };
	if (parentId) {
		const parent = params.items.find((row) => row.id === parentId);
		position = parent
			? {
					x: parent.position.x + 24,
					y: parent.position.y + 24,
				}
			: { x: 350, y: 40 };
	}
	const iconNode = resolveUserFolderIconNode(folderIconId);
	return withFolderIconOnItem(
		{
			id: `folder-${Date.now()}`,
			name: params.name,
			type: 'folder',
			position,
			parentId,
			isPinned: false,
			children: [],
			icon: iconNode,
		},
		folderIconId
	);
}

export async function createDesktopMarkdownStorageItem(params: {
	items: DesktopItem[];
	config: DesktopConfig | null;
	parentId?: string;
	isOnline: boolean;
	t: TFunction;
	saveToLocalStorage: (
		newConfig?: DesktopConfig,
		newItems?: DesktopItem[]
	) => void;
	setItems: (updater: (prev: DesktopItem[]) => DesktopItem[]) => void;
	broadcastDesktopMutation: (scope: 'config' | 'items') => void;
}): Promise<{ contentId: string; item: DesktopItem } | null> {
	const {
		items,
		config,
		parentId,
		isOnline,
		t,
		saveToLocalStorage,
		setItems,
		broadcastDesktopMutation,
	} = params;

	const filename = resolveNextMarkdownFilename(items);
	const parentKey = parentId ?? '';
	const gridStepKey =
		config?.grid_step === 'small' ||
		config?.grid_step === 'medium' ||
		config?.grid_step === 'large'
			? config.grid_step
			: 'medium';
	const iconSizeKey =
		config?.icon_size === 'small' ||
		config?.icon_size === 'medium' ||
		config?.icon_size === 'large'
			? config.icon_size
			: 'medium';
	const gridSize = DESKTOP_GRID_STEPS[gridStepKey];
	const wa = readDesktopWorkArea();
	const iconMetrics =
		DESKTOP_ICON_SIZES[iconSizeKey] ?? DESKTOP_ICON_SIZES.medium;
	const layoutMax = {
		maxX: Math.max(DESKTOP_GRID.OFFSET, wa.width - iconMetrics.width),
		maxY: Math.max(DESKTOP_GRID.OFFSET, wa.height - iconMetrics.height),
	};
	const seed = findNearestFreePosition(
		items,
		'__new_md__',
		DESKTOP_GRID.OFFSET + gridSize,
		DESKTOP_GRID.OFFSET + gridSize,
		gridSize,
		DESKTOP_GRID.OFFSET,
		layoutMax
	);
	const position = snapToGrid(
		seed.x,
		seed.y,
		gridSize,
		DESKTOP_GRID.OFFSET,
		layoutMax
	);

	try {
		const file = createEmptyMarkdownBlob(filename);
		const uploaded = await contentApi.uploadContent(file, {
			name: filename,
			folder_item_id: parentId ?? null,
		});
		const contentId = uploaded.id?.trim();
		if (!contentId) {
			notify.error(t('storage.createMarkdownFailed'));
			return null;
		}
		const displayName = uploaded.name?.trim() || filename;
		const fileItem = buildDesktopMarkdownFileItem({
			contentId,
			name: displayName,
			position,
			parentId,
		});

		setItems((prev) => {
			if (
				prev.some(
					(row) =>
						row.type === 'file' &&
						row.id === contentId &&
						(row.parentId ?? '') === parentKey
				)
			) {
				return prev;
			}
			const updated = [...prev, fileItem];
			saveToLocalStorage(undefined, updated);
			return updated;
		});

		if (isOnline) {
			try {
				await upsertDesktopItem(contentId, toApiItem(fileItem));
				broadcastDesktopMutation('items');
			} catch (e) {
				log.warn('Desktop', 'Failed to create markdown shortcut on server', e);
			}
		}

		return { contentId, item: fileItem };
	} catch (e) {
		log.warn('Desktop', 'Failed to create markdown file', e);
		notify.error(t('storage.createMarkdownFailed'));
		return null;
	}
}

export function resolveDesktopDeleteConflictMessage(
	detail: unknown,
	fallback: string
): string {
	if (
		typeof detail === 'object' &&
		detail !== null &&
		'message' in detail &&
		typeof (detail as { message: unknown }).message === 'string'
	) {
		return (detail as { message: string }).message;
	}
	return fallback;
}
