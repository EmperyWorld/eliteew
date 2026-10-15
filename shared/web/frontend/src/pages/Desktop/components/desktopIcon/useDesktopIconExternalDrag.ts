/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTML5 drag/drop bridges for desktop icons: Alt+file export to Content Manager and folder external drops.
 *
 * Invariants:
 * - File icons are draggable only while Alt is held (contentManagerDragArmed).
 * - Folder external drop accepts CM content MIME and nested desktop item drag.
 *
 * Related:
 * - utils/contentManagerDrag.ts · utils/desktopNestedItemDrag.ts
 */

import { useCallback, useEffect, useState } from 'react';
import {
	CM_CONTENT_DRAG_MIME,
	dataTransferHasContentDrag,
	setContentManagerDragGhost,
	stringifyContentDragPayload,
	type ContentDragPayload,
} from '@/pages/ContentManager/utils/contentManagerDrag';
import type { DesktopItem } from '../../types/desktop.types';
import { dataTransferHasDesktopNestedItemDrag } from '../../utils/desktopNestedItemDrag';

export interface UseDesktopIconExternalDragOptions {
	item: DesktopItem;
	allItems: DesktopItem[];
	selectedIds?: ReadonlySet<string>;
	onExternalContentDropToFolder?: (
		e: React.DragEvent,
		folderId: string
	) => void;
}

export function useDesktopIconExternalDrag({
	item,
	allItems,
	selectedIds,
	onExternalContentDropToFolder,
}: UseDesktopIconExternalDragOptions) {
	const [externalContentOver, setExternalContentOver] = useState(false);
	const [contentManagerDragArmed, setContentManagerDragArmed] = useState(false);

	useEffect(() => {
		if (item.type !== 'file') {
			setContentManagerDragArmed(false);
			return;
		}
		const syncAlt = (e: KeyboardEvent) => {
			setContentManagerDragArmed(e.altKey);
		};
		const clearAlt = () => setContentManagerDragArmed(false);
		window.addEventListener('keydown', syncAlt);
		window.addEventListener('keyup', syncAlt);
		window.addEventListener('blur', clearAlt);
		return () => {
			window.removeEventListener('keydown', syncAlt);
			window.removeEventListener('keyup', syncAlt);
			window.removeEventListener('blur', clearAlt);
		};
	}, [item.type]);

	const resolveFileContentDragIds = useCallback((): string[] => {
		if (item.type !== 'file') return [];
		if (!selectedIds?.has(item.id)) return [item.id];
		const ids = allItems
			.filter((i) => selectedIds.has(i.id) && i.type === 'file')
			.map((i) => i.id);
		return ids.length > 0 ? ids : [item.id];
	}, [allItems, item.id, item.type, selectedIds]);

	const handleHtml5DragStart = useCallback(
		(e: React.DragEvent) => {
			if (item.type !== 'file' || !e.altKey) {
				e.preventDefault();
				return;
			}
			const ids = resolveFileContentDragIds();
			if (ids.length === 0) return;
			const dragItems = ids.map((id) => {
				const it = allItems.find((i) => i.id === id && i.type === 'file');
				return {
					id,
					name: it?.name ?? id,
					content_type: it?.fileType ?? null,
				};
			});
			const payload: ContentDragPayload = { ids, items: dragItems };
			e.dataTransfer.setData(
				CM_CONTENT_DRAG_MIME,
				stringifyContentDragPayload(payload)
			);
			e.dataTransfer.effectAllowed = 'move';
			setContentManagerDragGhost(e, {
				title: item.name,
				count: ids.length,
			});
			const el = e.currentTarget as HTMLElement;
			el.style.opacity = '0.42';
		},
		[allItems, item.name, item.type, resolveFileContentDragIds]
	);

	const handleHtml5DragEnd = useCallback((e: React.DragEvent) => {
		const el = e.currentTarget as HTMLElement;
		el.style.opacity = '';
	}, []);

	const handleFolderExternalDragOver = useCallback(
		(e: React.DragEvent) => {
			if (item.type !== 'folder' || !onExternalContentDropToFolder) {
				return;
			}
			const hasContent = dataTransferHasContentDrag(e.dataTransfer);
			const hasNested = dataTransferHasDesktopNestedItemDrag(e.dataTransfer);
			if (!hasContent && !hasNested) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = hasNested ? 'move' : 'copy';
			setExternalContentOver(true);
		},
		[item.type, onExternalContentDropToFolder]
	);

	const handleFolderExternalDragLeave = useCallback(
		(e: React.DragEvent) => {
			if (item.type !== 'folder') return;
			const related = e.relatedTarget as Node | null;
			if (related && (e.currentTarget as Node).contains(related)) return;
			setExternalContentOver(false);
		},
		[item.type]
	);

	const handleFolderExternalDrop = useCallback(
		(e: React.DragEvent) => {
			if (item.type !== 'folder' || !onExternalContentDropToFolder) {
				return;
			}
			setExternalContentOver(false);
			if (
				!dataTransferHasContentDrag(e.dataTransfer) &&
				!dataTransferHasDesktopNestedItemDrag(e.dataTransfer)
			) {
				return;
			}
			onExternalContentDropToFolder(e, item.id);
		},
		[item.id, item.type, onExternalContentDropToFolder]
	);

	return {
		contentManagerDragArmed,
		externalContentOver,
		handleHtml5DragStart,
		handleHtml5DragEnd,
		handleFolderExternalDragOver,
		handleFolderExternalDragLeave,
		handleFolderExternalDrop,
	};
}
