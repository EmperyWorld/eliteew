/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Native mouse reposition drag for desktop icons (rAF translate3d preview, folder drop targets).
 *
 * Invariants:
 * - File icons skip reposition when Alt is held (HTML5 CM export handled separately).
 * - Click without motion commits cancelled drag (no server sync).
 *
 * Related:
 * - desktopIcon/DesktopIcon.tsx
 * - utils/desktopSnapGeometry.ts
 */

import type * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	DESKTOP_GRID,
	DESKTOP_ICON_SIZES,
	type IconSizePreference,
} from '../../constants';
import type { DesktopItem } from '../../types/desktop.types';
import { canMoveDesktopItemIntoFolder } from '../../utils/desktopItemTree';
import { readDesktopWorkArea } from '../../utils/desktopSnapGeometry';

export interface UseDesktopIconDragOptions {
	item: DesktopItem;
	allItems: DesktopItem[];
	iconSize: IconSizePreference;
	isRenaming: boolean;
	onDragStart?: () => void;
	onDragEnd: (
		x: number,
		y: number,
		opts?: { droppedOnFolder?: boolean; cancelled?: boolean }
	) => void;
	onDrag?: (x: number, y: number) => void;
	onDropToFolder?: (itemId: string, folderId: string) => void;
	onDropTargetChange?: (folderId: string | null) => void;
}

export function useDesktopIconDrag({
	item,
	allItems,
	iconSize,
	isRenaming,
	onDragStart,
	onDragEnd,
	onDrag,
	onDropToFolder,
	onDropTargetChange,
}: UseDesktopIconDragOptions) {
	const [isDragging, setIsDragging] = useState(false);
	const [isDropTarget, setIsDropTarget] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const didDragRef = useRef(false);
	const dragStateRef = useRef<{
		startClientX: number;
		startClientY: number;
		startLeft: number;
		startTop: number;
		parentLeft: number;
		parentTop: number;
		parentLayoutWidth: number;
		parentLayoutHeight: number;
		layoutScale: number;
		clickOffsetX: number;
		clickOffsetY: number;
		lastX: number;
		lastY: number;
	} | null>(null);
	const dragMoveFrameRef = useRef<number | null>(null);
	const dragResetFrameRef = useRef<number | null>(null);
	const pendingDragPositionRef = useRef<{ x: number; y: number } | null>(null);
	const activeDropTargetRef = useRef<string | null>(null);

	const sizes = DESKTOP_ICON_SIZES[iconSize] ?? DESKTOP_ICON_SIZES.medium;

	const folderDropTargets = useMemo(
		() =>
			allItems.filter(
				(candidate) =>
					candidate.type === 'folder' &&
					candidate.id !== item.id &&
					canMoveDesktopItemIntoFolder(allItems, item, candidate)
			),
		[allItems, item]
	);

	const checkDropTarget = useCallback(
		(x: number, y: number) => {
			const { width: iconW, height: iconH } = sizes;
			for (const folder of folderDropTargets) {
				const fx = folder.position.x;
				const fy = folder.position.y;
				if (x >= fx && x <= fx + iconW && y >= fy && y <= fy + iconH)
					return folder;
			}
			return null;
		},
		[folderDropTargets, sizes]
	);

	useLayoutEffect(() => {
		const el = wrapperRef.current;
		if (!el) return;
		el.style.left = `${item.position.x}px`;
		el.style.top = `${item.position.y}px`;
		el.style.width = `${sizes.width}px`;
		el.style.height = `${sizes.height}px`;
	}, [item.position.x, item.position.y, sizes.width, sizes.height]);

	const resetDragPreview = useCallback(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper) return;
		wrapper.style.transform = '';
		wrapper.style.willChange = '';
	}, []);

	const applyDragPreview = useCallback((x: number, y: number) => {
		const wrapper = wrapperRef.current;
		const st = dragStateRef.current;
		if (!wrapper || !st) return;
		wrapper.style.willChange = 'transform';
		wrapper.style.transform = `translate3d(${x - st.startLeft}px, ${y - st.startTop}px, 0)`;
	}, []);

	useEffect(() => {
		if (isDragging) return;
		resetDragPreview();
	}, [isDragging, resetDragPreview]);

	useEffect(() => {
		return () => {
			if (dragMoveFrameRef.current != null) {
				cancelAnimationFrame(dragMoveFrameRef.current);
			}
			if (dragResetFrameRef.current != null) {
				cancelAnimationFrame(dragResetFrameRef.current);
			}
			resetDragPreview();
		};
	}, [resetDragPreview]);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			const st = dragStateRef.current;
			if (!st) return;
			const s = st.layoutScale > 0 ? st.layoutScale : 1;
			const parentX = (e.clientX - st.parentLeft) / s - st.clickOffsetX;
			const parentY = (e.clientY - st.parentTop) / s - st.clickOffsetY;
			const minX = DESKTOP_GRID.OFFSET;
			const minY = DESKTOP_GRID.OFFSET;
			const maxX = Math.max(minX, st.parentLayoutWidth - sizes.width);
			const maxY = Math.max(minY, st.parentLayoutHeight - sizes.height);
			const x = Math.max(minX, Math.min(maxX, parentX));
			const y = Math.max(minY, Math.min(maxY, parentY));
			st.lastX = x;
			st.lastY = y;
			didDragRef.current = true;
			pendingDragPositionRef.current = { x, y };

			if (dragMoveFrameRef.current != null) return;
			dragMoveFrameRef.current = requestAnimationFrame(() => {
				dragMoveFrameRef.current = null;
				const nextPosition = pendingDragPositionRef.current;
				if (!nextPosition) return;

				applyDragPreview(nextPosition.x, nextPosition.y);

				const target = checkDropTarget(
					nextPosition.x + sizes.width / 2,
					nextPosition.y + sizes.height / 2
				);
				const targetId = target?.id ?? null;

				if (activeDropTargetRef.current !== targetId) {
					activeDropTargetRef.current = targetId;
					setIsDropTarget(Boolean(targetId));
					onDropTargetChange?.(targetId);
				}

				onDrag?.(nextPosition.x, nextPosition.y);
			});
		},
		[applyDragPreview, checkDropTarget, onDrag, onDropTargetChange, sizes]
	);

	const handleMouseUp = useCallback(
		(e: MouseEvent) => {
			if (e.button !== 0) return;
			const st = dragStateRef.current;
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			dragStateRef.current = null;
			setIsDragging(false);
			setIsDropTarget(false);
			activeDropTargetRef.current = null;
			onDropTargetChange?.(null);
			if (dragMoveFrameRef.current != null) {
				cancelAnimationFrame(dragMoveFrameRef.current);
				dragMoveFrameRef.current = null;
			}
			if (!st) return;
			const dropX = st.lastX;
			const dropY = st.lastY;
			const target = checkDropTarget(
				dropX + sizes.width / 2,
				dropY + sizes.height / 2
			);
			if (target && onDropToFolder) {
				resetDragPreview();
				onDropToFolder(item.id, target.id);
				onDragEnd(st.startLeft, st.startTop, { droppedOnFolder: true });
				return;
			}
			if (!didDragRef.current) {
				resetDragPreview();
				onDragEnd(st.startLeft, st.startTop, { cancelled: true });
				if (dragResetFrameRef.current != null) {
					cancelAnimationFrame(dragResetFrameRef.current);
				}
				dragResetFrameRef.current = requestAnimationFrame(() => {
					dragResetFrameRef.current = null;
					resetDragPreview();
				});
				return;
			}
			onDragEnd(dropX, dropY);
			if (dragResetFrameRef.current != null) {
				cancelAnimationFrame(dragResetFrameRef.current);
			}
			dragResetFrameRef.current = requestAnimationFrame(() => {
				dragResetFrameRef.current = null;
				resetDragPreview();
			});
		},
		[
			checkDropTarget,
			handleMouseMove,
			item.id,
			onDragEnd,
			onDropTargetChange,
			onDropToFolder,
			resetDragPreview,
			sizes,
		]
	);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (e.button !== 0 || isRenaming) return;
			if (item.type === 'file' && e.altKey) return;
			const wrapper = wrapperRef.current;
			const parent = wrapper?.offsetParent as HTMLElement | null;
			if (!wrapper || !parent) return;
			const parentRect = parent.getBoundingClientRect();
			const layoutScale =
				typeof document !== 'undefined' ? readDesktopWorkArea().layoutScale : 1;
			const s = layoutScale > 0 ? layoutScale : 1;
			const startLeft = item.position.x;
			const startTop = item.position.y;
			const clickOffsetX = (e.clientX - parentRect.left) / s - startLeft;
			const clickOffsetY = (e.clientY - parentRect.top) / s - startTop;
			didDragRef.current = false;
			dragStateRef.current = {
				startClientX: e.clientX,
				startClientY: e.clientY,
				startLeft,
				startTop,
				parentLeft: parentRect.left,
				parentTop: parentRect.top,
				parentLayoutWidth: parent.clientWidth,
				parentLayoutHeight: parent.clientHeight,
				layoutScale: s,
				clickOffsetX,
				clickOffsetY,
				lastX: startLeft,
				lastY: startTop,
			};
			pendingDragPositionRef.current = { x: startLeft, y: startTop };
			activeDropTargetRef.current = null;
			applyDragPreview(startLeft, startTop);
			setIsDragging(true);
			onDragStart?.();
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
		},
		[
			applyDragPreview,
			handleMouseMove,
			handleMouseUp,
			isRenaming,
			item.position,
			item.type,
			onDragStart,
		]
	);

	const consumeDidDrag = useCallback(() => {
		const did = didDragRef.current;
		didDragRef.current = false;
		return did;
	}, []);

	return {
		wrapperRef,
		sizes,
		isDragging,
		isDropTarget,
		handleMouseDown,
		consumeDidDrag,
	};
}
