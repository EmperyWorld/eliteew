/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Multi-selection helpers for desktop icons (rubber-band / select-all / clipboard buffer).
 *
 * Invariants:
 * - ``selectAll`` / rubber-band never call ``Array.from`` on a missing NodeList.
 * - Icon ids are read from ``data-desktop-icon-id`` (legacy ``data-item-id`` accepted).
 * - Global Ctrl/Meta+A for icon select-all is owned by ``useDesktopClipboard`` (blocks select-all
 *   on the desk; text fields keep native select-all via defer) — this hook must not steal it.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopClipboard.ts
 * - src/pages/Desktop/hooks/useDesktopWorkspaceShellInputSurfaces.ts
 */

import { useCallback, useRef, useState, type RefObject } from 'react';
import type { DesktopItem } from '../types/desktop.types';

interface SelectionRect {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
}

interface UseMultiSelectReturn {
	selectedItems: Set<string>;
	isSelecting: boolean;
	selectionRect: SelectionRect | null;
	containerRef: RefObject<HTMLDivElement | null>;
	startSelection: (e: React.MouseEvent) => void;
	updateSelection: (e: React.MouseEvent) => void;
	endSelection: () => void;
	toggleSelection: (itemId: string, e?: React.MouseEvent) => void;
	selectAll: () => void;
	clearSelection: () => void;
	isItemSelected: (itemId: string) => boolean;
	getSelectedItems: (allItems: DesktopItem[]) => DesktopItem[];
	deleteSelected: () => void;
	moveSelectedToFolder: (folderId: string) => void;
	copySelected: () => void;
	cutSelected: () => void;
	pasteSelected: () => void;
}

/** Safe id collection for select-all / rubber-band (null container → empty). */
export function collectDesktopIconIdsFromContainer(
	container: ParentNode | null | undefined
): string[] {
	if (!container) return [];
	const icons = container.querySelectorAll('[data-desktop-icon]');
	return Array.from(icons)
		.map((node) => {
			const el = node as HTMLElement;
			return (
				el.dataset.desktopIconId?.trim() || el.dataset.itemId?.trim() || ''
			);
		})
		.filter(Boolean);
}

export function useMultiSelect(): UseMultiSelectReturn {
	const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
		null
	);
	const [copyBuffer, setCopyBuffer] = useState<{
		items: string[];
		operation: 'copy' | 'cut';
	} | null>(null);

	const containerRef = useRef<HTMLDivElement>(null);
	const startPointRef = useRef({ x: 0, y: 0 });

	const isIconInSelection = useCallback(
		(icon: HTMLElement, rect: SelectionRect): boolean => {
			const rect1 = icon.getBoundingClientRect();
			const rect2 = {
				left: Math.min(rect.startX, rect.endX),
				right: Math.max(rect.startX, rect.endX),
				top: Math.min(rect.startY, rect.endY),
				bottom: Math.max(rect.startY, rect.endY),
			};

			return !(
				rect1.right < rect2.left ||
				rect1.left > rect2.right ||
				rect1.bottom < rect2.top ||
				rect1.top > rect2.bottom
			);
		},
		[]
	);

	const startSelection = useCallback((e: React.MouseEvent) => {
		if (e.button !== 0) return;

		if ((e.target as HTMLElement).closest('[data-desktop-icon]')) {
			return;
		}

		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		startPointRef.current = { x, y };
		setIsSelecting(true);
		setSelectionRect({ startX: x, startY: y, endX: x, endY: y });

		if (!e.ctrlKey && !e.metaKey) {
			setSelectedItems(new Set());
		}
	}, []);

	const updateSelection = useCallback(
		(e: React.MouseEvent) => {
			if (!isSelecting || !selectionRect) return;

			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;

			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			const newRect = {
				...selectionRect,
				endX: x,
				endY: y,
			};

			setSelectionRect(newRect);

			const root = containerRef.current;
			if (!root) return;

			const icons = root.querySelectorAll(
				'[data-desktop-icon]'
			) as NodeListOf<HTMLElement>;
			const newSelection = new Set(selectedItems);

			icons.forEach((icon) => {
				const itemId =
					icon.dataset.desktopIconId?.trim() || icon.dataset.itemId?.trim();
				if (!itemId) return;

				if (isIconInSelection(icon, newRect)) {
					if (e.ctrlKey || e.metaKey) {
						if (newSelection.has(itemId)) {
							newSelection.delete(itemId);
						} else {
							newSelection.add(itemId);
						}
					} else {
						newSelection.add(itemId);
					}
				} else if (!e.ctrlKey && !e.metaKey) {
					newSelection.delete(itemId);
				}
			});

			setSelectedItems(newSelection);
		},
		[isSelecting, selectionRect, selectedItems, isIconInSelection]
	);

	const endSelection = useCallback(() => {
		setIsSelecting(false);
		setSelectionRect(null);
	}, []);

	const toggleSelection = useCallback(
		(itemId: string, e?: React.MouseEvent) => {
			setSelectedItems((prev) => {
				const newSelection = new Set(prev);

				if (e?.ctrlKey || e?.metaKey) {
					if (newSelection.has(itemId)) {
						newSelection.delete(itemId);
					} else {
						newSelection.add(itemId);
					}
				} else if (e?.shiftKey && newSelection.size > 0) {
					newSelection.add(itemId);
				} else {
					newSelection.clear();
					newSelection.add(itemId);
				}

				return newSelection;
			});
		},
		[]
	);

	const selectAll = useCallback(() => {
		const allIds = collectDesktopIconIdsFromContainer(containerRef.current);
		setSelectedItems(new Set(allIds));
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedItems(new Set());
	}, []);

	const isItemSelected = useCallback(
		(itemId: string) => selectedItems.has(itemId),
		[selectedItems]
	);

	const getSelectedItems = useCallback(
		(allItems: DesktopItem[]): DesktopItem[] =>
			allItems.filter((item) => selectedItems.has(item.id)),
		[selectedItems]
	);

	const deleteSelected = useCallback(() => {
		if (selectedItems.size === 0) return;
		clearSelection();
	}, [selectedItems, clearSelection]);

	const moveSelectedToFolder = useCallback(
		(_folderId: string) => {
			if (selectedItems.size === 0) return;
			clearSelection();
		},
		[selectedItems, clearSelection]
	);

	const copySelected = useCallback(() => {
		if (selectedItems.size === 0) return;
		setCopyBuffer({
			items: Array.from(selectedItems),
			operation: 'copy',
		});
	}, [selectedItems]);

	const cutSelected = useCallback(() => {
		if (selectedItems.size === 0) return;
		setCopyBuffer({
			items: Array.from(selectedItems),
			operation: 'cut',
		});
	}, [selectedItems]);

	const pasteSelected = useCallback(() => {
		if (!copyBuffer) return;
		if (copyBuffer.operation === 'cut') {
			setCopyBuffer(null);
		}
	}, [copyBuffer]);

	return {
		selectedItems,
		isSelecting,
		selectionRect,
		containerRef,
		startSelection,
		updateSelection,
		endSelection,
		toggleSelection,
		selectAll,
		clearSelection,
		isItemSelected,
		getSelectedItems,
		deleteSelected,
		moveSelectedToFolder,
		copySelected,
		cutSelected,
		pasteSelected,
	};
}
