/**
 * useDragDrop - Hook для drag & drop организации файлов
 *
 * Возможности:
 * - Перетаскивание файлов для изменения порядка
 * - Перетаскивание в папки (компании/проекты)
 * - Визуальная обратная связь при перетаскивании
 * - Поддержка множественного выбора
 */

import { useState, useCallback } from 'react';

interface UseDragDropOptions {
	onMove?: (
		contentId: string,
		targetId: string | null,
		position?: number
	) => void;
	onMoveToFolder?: (
		contentIds: string[],
		folderId: string,
		folderType: 'company' | 'project'
	) => void;
	onReorder?: (contentIds: string[], newOrder: number[]) => void;
}

interface DragState {
	draggedId: string | null;
	draggedIds: string[];
	targetId: string | null;
	targetType: 'file' | 'folder' | null;
	targetFolderType: 'company' | 'project' | null;
	position: number | null;
}

interface UseDragDropReturn {
	dragState: DragState;
	dragStart: (contentId: string, selectedIds?: string[]) => void;
	dragOver: (
		targetId: string,
		targetType: 'file' | 'folder',
		position?: number,
		folderType?: 'company' | 'project'
	) => void;
	dragEnd: () => void;
	dragCancel: () => void;
	isDragging: boolean;
}

export const useDragDrop = (
	options: UseDragDropOptions = {}
): UseDragDropReturn => {
	const { onMove, onMoveToFolder, onReorder } = options;

	const [dragState, setDragState] = useState<DragState>({
		draggedId: null,
		draggedIds: [],
		targetId: null,
		targetType: null,
		targetFolderType: null,
		position: null,
	});

	const dragStart = useCallback(
		(contentId: string, selectedIds: string[] = []) => {
			setDragState({
				draggedId: contentId,
				draggedIds: selectedIds.length > 0 ? selectedIds : [contentId],
				targetId: null,
				targetType: null,
				targetFolderType: null,
				position: null,
			});
		},
		[]
	);

	const dragOver = useCallback(
		(
			targetId: string,
			targetType: 'file' | 'folder',
			position?: number,
			folderType?: 'company' | 'project'
		) => {
			setDragState((prev) => ({
				...prev,
				targetId,
				targetType,
				targetFolderType: targetType === 'folder' ? (folderType ?? null) : null,
				position: position ?? null,
			}));
		},
		[]
	);

	const dragEnd = useCallback(() => {
		const { draggedIds, targetId, targetType, targetFolderType, position } =
			dragState;

		if (targetId && draggedIds.length > 0) {
			if (targetType === 'folder') {
				onMoveToFolder?.(draggedIds, targetId, targetFolderType ?? 'company');
			} else if (targetType === 'file' && position !== null) {
				// Переупорядочивание
				const newOrder = draggedIds.map((_, idx) => position + idx);
				onReorder?.(draggedIds, newOrder);
			} else if (targetId && draggedIds[0]) {
				// Перемещение к файлу
				onMove?.(draggedIds[0], targetId, position ?? undefined);
			}
		}

		setDragState({
			draggedId: null,
			draggedIds: [],
			targetId: null,
			targetType: null,
			targetFolderType: null,
			position: null,
		});
	}, [dragState, onMove, onMoveToFolder, onReorder]);

	const dragCancel = useCallback(() => {
		setDragState({
			draggedId: null,
			draggedIds: [],
			targetId: null,
			targetType: null,
			targetFolderType: null,
			position: null,
		});
	}, []);

	return {
		dragState,
		dragStart,
		dragOver,
		dragEnd,
		dragCancel,
		isDragging: dragState.draggedId !== null,
	};
};
