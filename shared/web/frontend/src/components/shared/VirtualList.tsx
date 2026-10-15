/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Virtual wrappers for fixed rows, measured variable rows, and
 * measured grid layouts used by long chat/log/task/document lists.
 *
 * Invariants:
 * - Dynamic list/grid rows are measured after mount and on ResizeObserver changes
 *   (`VirtualVariableList`, `VirtualGrid`) so tall cards cannot overlap short estimates.
 * - Virtual item keys prefer entity `id`; index fallback is only for immutable/static collections.
 *
 * Related:
 * - documentation/product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md
 */

import {
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
} from 'react';
import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// ============================================
// Fixed Size List (all items same height)
// ============================================

interface VirtualListProps<T> {
	/** Array of items to render */
	items: T[];
	/** Height of each item in pixels */
	itemHeight: number;
	/** Render function for each item */
	renderItem: (item: T, index: number) => React.ReactNode;
	/** Container height */
	height?: number;
	/** Number of items to render outside visible area */
	overscanCount?: number;
	/** Custom class name */
	className?: string;
	/** Callback when scroll reaches near end (for infinite loading) */
	onEndReached?: () => void;
	/** Threshold for onEndReached (items from end) */
	endReachedThreshold?: number;
	/**
	 * Stable key per index for the virtualizer (reorder / refetch). If omitted,
	 * uses `items[index]` with an `id` field when present, otherwise the index.
	 */
	getItemKey?: (index: number) => string | number;
}

/** String id for virtualizer keys when `item` exposes a non-empty `id`. */
function virtualItemIdString(item: unknown): string | null {
	if (item && typeof item === 'object' && item !== null && 'id' in item) {
		const id = (item as { id: unknown }).id;
		if (id != null && id !== '') {
			return String(id);
		}
	}
	return null;
}

/** Shared default: entity `id` when available, else index (fixed + variable lists). */
function defaultVirtualItemKeyByIndex<T>(
	items: T[],
	index: number
): string | number {
	const id = virtualItemIdString(items[index]);
	if (id !== null) {
		return id;
	}
	return index;
}

/** Dynamic height sizer — layout applied in useLayoutEffect (avoids JSX `style` for Edge Tools). */
function VirtualSizer({
	heightPx,
	widthPx,
	children,
}: {
	heightPx: number;
	/** Omit for full-width lists; set for virtual grids (total pixel width). */
	widthPx?: number;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = `${heightPx}px`;
		el.style.position = 'relative';
		if (widthPx !== undefined) {
			el.style.width = `${widthPx}px`;
		} else {
			el.style.width = '100%';
		}
	}, [heightPx, widthPx]);
	return <div ref={ref}>{children}</div>;
}

function VirtualFixedRow({
	heightPx,
	translateYPx,
	children,
}: {
	heightPx: number;
	translateYPx: number;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.position = 'absolute';
		el.style.top = '0';
		el.style.left = '0';
		el.style.width = '100%';
		el.style.height = `${heightPx}px`;
		el.style.transform = `translateY(${translateYPx}px)`;
	}, [heightPx, translateYPx]);
	return <div ref={ref}>{children}</div>;
}

function VirtualVariableRow({
	translateYPx,
	index,
	measureElement,
	children,
}: {
	translateYPx: number;
	index: number;
	measureElement: (el: HTMLElement | null) => void;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			ref.current = node;
			measureElement(node);
		},
		[measureElement]
	);
	useEffect(() => {
		const el = ref.current;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => {
			if (rafRef.current !== null) {
				window.cancelAnimationFrame(rafRef.current);
			}
			rafRef.current = window.requestAnimationFrame(() => {
				rafRef.current = null;
				measureElement(el);
			});
		});
		observer.observe(el);
		return () => {
			observer.disconnect();
			if (rafRef.current !== null) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [measureElement]);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.position = 'absolute';
		el.style.top = '0';
		el.style.left = '0';
		el.style.width = '100%';
		el.style.transform = `translateY(${translateYPx}px)`;
	}, [translateYPx]);
	return (
		<div ref={setRefs} data-index={index}>
			{children}
		</div>
	);
}

function VirtualGridCell({
	widthPx,
	children,
}: {
	widthPx: number;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.width = `${widthPx}px`;
		el.style.minWidth = `${widthPx}px`;
		el.style.maxWidth = `${widthPx}px`;
	}, [widthPx]);
	return <div ref={ref}>{children}</div>;
}

export function VirtualList<T>({
	items,
	itemHeight,
	renderItem,
	height = 400,
	overscanCount = 5,
	className = '',
	onEndReached,
	endReachedThreshold = 10,
	getItemKey: getItemKeyProp,
}: VirtualListProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null);
	const lastEndReachedItemCountRef = useRef<number | null>(null);

	const getItemKey = useMemo(
		() =>
			getItemKeyProp ??
			((index: number) => defaultVirtualItemKeyByIndex(items, index)),
		[getItemKeyProp, items]
	);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => itemHeight,
		overscan: overscanCount,
		getItemKey,
	});

	const virtualItems = virtualizer.getVirtualItems();

	useLayoutEffect(() => {
		const el = parentRef.current;
		if (!el) return;
		el.style.height = `${height}px`;
	}, [height]);

	// Handle infinite loading
	useEffect(() => {
		if (!onEndReached) return;

		const lastItem = virtualItems[virtualItems.length - 1];
		if (lastItem && lastItem.index >= items.length - endReachedThreshold) {
			if (lastEndReachedItemCountRef.current === items.length) return;
			lastEndReachedItemCountRef.current = items.length;
			onEndReached();
		}
	}, [virtualItems, items.length, onEndReached, endReachedThreshold]);

	return (
		<div ref={parentRef} className={`overflow-auto ${className}`}>
			<VirtualSizer heightPx={virtualizer.getTotalSize()}>
				{virtualItems.map((virtualItem) => (
					<VirtualFixedRow
						key={virtualItem.key}
						heightPx={virtualItem.size}
						translateYPx={virtualItem.start}
					>
						{renderItem(items[virtualItem.index], virtualItem.index)}
					</VirtualFixedRow>
				))}
			</VirtualSizer>
		</div>
	);
}

// ============================================
// Variable Size List (items with different heights)
// ============================================

export type VirtualVariableListScrollOptions = {
	align?: 'start' | 'center' | 'end' | 'auto';
	behavior?: ScrollBehavior;
};

export type VirtualVariableListHandle = {
	scrollToIndex: (
		index: number,
		options?: VirtualVariableListScrollOptions
	) => void;
};

export interface VirtualVariableListProps<T> {
	/** Array of items to render */
	items: T[];
	/** Function to estimate height of each item */
	estimateSize: (index: number) => number;
	/**
	 * Stable key per index for the virtualizer. If omitted, uses `items[index].id`
	 * when present, otherwise the index (same as fixed `VirtualList`).
	 */
	getItemKey?: (index: number) => string | number;
	/** Render function for each item */
	renderItem: (item: T, index: number) => React.ReactNode;
	/** Container height */
	height?: number;
	/** Number of items to render outside visible area */
	overscanCount?: number;
	/** Custom class name */
	className?: string;
	/** Callback when scroll reaches near end (for infinite loading) */
	onEndReached?: () => void;
	/** Threshold for onEndReached (items from end) */
	endReachedThreshold?: number;
	/** Fired when the primary visible row index changes (scroll / scrollToIndex). */
	onVisibleIndexChange?: (index: number) => void;
	/** Optional imperative handle for scrollToIndex (EWRP slide editor). */
	virtualListRef?: React.RefObject<VirtualVariableListHandle | null>;
}

type VirtualRowSlice = { index: number; start: number; size: number };

function resolveVirtualListVisibleIndex(
	scrollTop: number,
	clientHeight: number,
	virtualItems: VirtualRowSlice[]
): number | null {
	if (virtualItems.length === 0) return null;
	const anchor = scrollTop + clientHeight * 0.32;
	for (const item of virtualItems) {
		if (item.start <= anchor && item.start + item.size > anchor) {
			return item.index;
		}
	}
	return virtualItems[0]?.index ?? null;
}

export function VirtualVariableList<T>({
	items,
	estimateSize,
	getItemKey,
	renderItem,
	height = 400,
	overscanCount = 5,
	className = '',
	onEndReached,
	endReachedThreshold = 10,
	onVisibleIndexChange,
	virtualListRef,
}: VirtualVariableListProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null);
	const lastEndReachedItemCountRef = useRef<number | null>(null);
	const lastVisibleIndexRef = useRef<number | null>(null);

	const getItemKeyResolved = useMemo(
		() =>
			getItemKey ??
			((index: number) => defaultVirtualItemKeyByIndex(items, index)),
		[getItemKey, items]
	);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize,
		overscan: overscanCount,
		getItemKey: getItemKeyResolved,
	});

	const virtualItems = virtualizer.getVirtualItems();

	useImperativeHandle(
		virtualListRef,
		() => ({
			scrollToIndex: (index, options) => {
				virtualizer.scrollToIndex(index, {
					align: options?.align ?? 'start',
					behavior: options?.behavior ?? 'smooth',
				});
			},
		}),
		[virtualizer]
	);

	const emitVisibleIndex = useCallback(() => {
		if (!onVisibleIndexChange) return;
		const el = parentRef.current;
		if (!el) return;
		const next = resolveVirtualListVisibleIndex(
			el.scrollTop,
			el.clientHeight,
			virtualizer.getVirtualItems()
		);
		if (next == null || next === lastVisibleIndexRef.current) return;
		lastVisibleIndexRef.current = next;
		onVisibleIndexChange(next);
	}, [onVisibleIndexChange, virtualizer]);

	useLayoutEffect(() => {
		const el = parentRef.current;
		if (!el) return;
		el.style.height = `${height}px`;
	}, [height]);

	useEffect(() => {
		if (!onVisibleIndexChange) return;
		const el = parentRef.current;
		if (!el) return;
		const onScroll = () => emitVisibleIndex();
		el.addEventListener('scroll', onScroll, { passive: true });
		emitVisibleIndex();
		return () => el.removeEventListener('scroll', onScroll);
	}, [emitVisibleIndex, onVisibleIndexChange]);

	useEffect(() => {
		if (!onEndReached) return;

		const lastItem = virtualItems[virtualItems.length - 1];
		if (lastItem && lastItem.index >= items.length - endReachedThreshold) {
			if (lastEndReachedItemCountRef.current === items.length) return;
			lastEndReachedItemCountRef.current = items.length;
			onEndReached();
		}
	}, [virtualItems, items.length, onEndReached, endReachedThreshold]);

	return (
		<div ref={parentRef} className={`overflow-auto ${className}`}>
			<VirtualSizer heightPx={virtualizer.getTotalSize()}>
				{virtualItems.map((virtualItem) => (
					<VirtualVariableRow
						key={virtualItem.key}
						translateYPx={virtualItem.start}
						index={virtualItem.index}
						measureElement={virtualizer.measureElement}
					>
						{renderItem(items[virtualItem.index], virtualItem.index)}
					</VirtualVariableRow>
				))}
			</VirtualSizer>
		</div>
	);
}

// ============================================
// Grid (virtualized 2D grid)
// ============================================

interface VirtualGridProps<T> {
	/** Flat array of items */
	items: T[];
	/** Number of columns */
	columnCount: number;
	/** Width of each column */
	columnWidth: number;
	/**
	 * Estimated row height for the virtualizer before/without measurement.
	 * Actual row height is measured (`measureElement` + ResizeObserver).
	 */
	rowHeight: number;
	/** Render function for each cell */
	renderCell: (
		item: T | undefined,
		rowIndex: number,
		columnIndex: number
	) => React.ReactNode;
	/** Container height */
	height?: number;
	/** Custom class name */
	className?: string;
	/**
	 * Extra rows to render above/below the viewport (helps tall cards / image decode).
	 * @default 3
	 */
	overscanRows?: number;
}

function cellKeyForVirtualGrid<T>(
	item: T | undefined,
	rowIndex: number,
	colIndex: number
): string {
	const id = virtualItemIdString(item);
	if (id !== null) {
		return id;
	}
	return `cell-${rowIndex}-${colIndex}`;
}

export function VirtualGrid<T>({
	items,
	columnCount,
	columnWidth,
	rowHeight,
	renderCell,
	height = 400,
	className = '',
	overscanRows = 3,
}: VirtualGridProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null);
	const rowCount = Math.ceil(items.length / columnCount);

	const getRowItemKey = useMemo(
		() => (rowIndex: number) => {
			const id = virtualItemIdString(items[rowIndex * columnCount]);
			if (id !== null) {
				return id;
			}
			return rowIndex;
		},
		[items, columnCount]
	);

	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => rowHeight,
		overscan: overscanRows,
		getItemKey: getRowItemKey,
	});

	const virtualRows = virtualizer.getVirtualItems();

	useLayoutEffect(() => {
		const el = parentRef.current;
		if (!el) return;
		el.style.height = `${height}px`;
	}, [height]);

	return (
		<div
			ref={parentRef}
			className={`w-full max-w-full overflow-auto ${className}`}
		>
			<VirtualSizer
				heightPx={virtualizer.getTotalSize()}
				widthPx={columnCount * columnWidth}
			>
				{virtualRows.map((virtualRow) => (
					<VirtualVariableRow
						key={virtualRow.key}
						index={virtualRow.index}
						translateYPx={virtualRow.start}
						measureElement={virtualizer.measureElement}
					>
						<div className="flex w-full">
							{Array.from({ length: columnCount }).map((_, colIndex) => {
								const itemIndex = virtualRow.index * columnCount + colIndex;
								const item = items[itemIndex];
								return (
									<VirtualGridCell
										key={cellKeyForVirtualGrid(
											item,
											virtualRow.index,
											colIndex
										)}
										widthPx={columnWidth}
									>
										{renderCell(item, virtualRow.index, colIndex)}
									</VirtualGridCell>
								);
							})}
						</div>
					</VirtualVariableRow>
				))}
			</VirtualSizer>
		</div>
	);
}

export default VirtualList;
