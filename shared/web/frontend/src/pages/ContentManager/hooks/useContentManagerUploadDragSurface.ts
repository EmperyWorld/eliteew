/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Root drag-and-drop upload surface and stable multi-select drag payload resolution for Content Manager files tab.
 *
 * Invariants:
 * - Drag payload reads latest selection via refs to keep row/card memo identities stable.
 *
 * Related:
 * - ContentManagerPro.tsx, utils/contentManagerDrag.ts
 */
import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import type { ContentDragPayload } from '../utils/contentManagerDrag';
import { contentManagerDisplayLabel } from '../utils/contentManagerTextLike';

export type UseContentManagerUploadDragSurfaceParams = {
	items: ContentItem[];
	selectMode: boolean;
	selectedIds: Set<string>;
	uploadFiles: (files: FileList | null) => void | Promise<void>;
	fileInputRef: RefObject<HTMLInputElement | null>;
};

export function useContentManagerUploadDragSurface({
	items,
	selectMode,
	selectedIds,
	uploadFiles,
	fileInputRef,
}: UseContentManagerUploadDragSurfaceParams) {
	const [isDragging, setIsDragging] = useState(false);

	const handleDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			void uploadFiles(e.dataTransfer.files);
		},
		[uploadFiles]
	);

	const handleRootDragOver = useCallback((e: DragEvent) => {
		if (e.dataTransfer.types.includes('Files')) {
			e.preventDefault();
			setIsDragging(true);
		}
	}, []);

	const handleRootDragLeave = useCallback((e: DragEvent) => {
		if (e.dataTransfer.types.includes('Files')) {
			setIsDragging(false);
		}
	}, []);

	const handleRootDrop = useCallback(
		(e: DragEvent) => {
			if (e.dataTransfer.types.includes('Files')) {
				handleDrop(e);
				return;
			}
			e.preventDefault();
		},
		[handleDrop]
	);

	const itemsRef = useRef(items);
	const selectModeRef = useRef(selectMode);
	const selectedIdsRef = useRef(selectedIds);
	useEffect(() => {
		itemsRef.current = items;
		selectModeRef.current = selectMode;
		selectedIdsRef.current = selectedIds;
	}, [items, selectMode, selectedIds]);

	const resolveDragContentIds = useCallback((itemId: string) => {
		const list = itemsRef.current;
		const sm = selectModeRef.current;
		const sel = selectedIdsRef.current;
		const candidate = sm && sel.has(itemId) ? Array.from(sel) : [itemId];
		const canEdit = new Map<string, boolean>();
		for (const it of list) {
			canEdit.set(it.id, it.can_edit !== false);
		}
		return candidate.filter((id) => canEdit.get(id) !== false);
	}, []);

	const resolveContentDragPayload = useCallback(
		(itemId: string): ContentDragPayload => {
			const ids = resolveDragContentIds(itemId);
			const list = itemsRef.current;
			const byId = new Map(list.map((it) => [it.id, it]));
			const dragItems = ids.map((id) => {
				const it = byId.get(id);
				if (!it) {
					return { id, name: id, content_type: null as string | null };
				}
				return {
					id,
					name: contentManagerDisplayLabel(it),
					content_type: it.content_type ?? null,
				};
			});
			return { ids, items: dragItems };
		},
		[resolveDragContentIds]
	);

	const handleFileSelect = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			void uploadFiles(e.target.files);
			if (fileInputRef.current) fileInputRef.current.value = '';
		},
		[uploadFiles, fileInputRef]
	);

	return {
		isDragging,
		handleRootDragOver,
		handleRootDragLeave,
		handleRootDrop,
		handleFileSelect,
		resolveDragContentIds,
		resolveContentDragPayload,
	} as const;
}
