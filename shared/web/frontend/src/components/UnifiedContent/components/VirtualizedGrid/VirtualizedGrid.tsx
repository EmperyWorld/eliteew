/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Virtualized grid renderer for Unified Content cards with keyboard navigation support.
 *
 * Invariants:
 * - Row heights are measured (`measureElement`) instead of assuming fixed card size.
 * - Virtual row keys follow first-card id per row for stable DOM reuse while filtering/sorting.
 *
 * Related:
 * - src/pages/ContentManager/ContentManagerFilesTab.tsx
 * - src/components/shared/VirtualList.tsx
 */

import * as React from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import type { Content } from '../../types';
import { FileCard, type FileCardAction } from '../FileCard';

interface VirtualizedGridProps {
	contents: Content[];
	selectedIds: Set<string>;
	favorites: Set<string>;
	isSelectMode?: boolean;
	onSelect: (id: string, multi: boolean) => void;
	onClick: (content: Content) => void;
	onQuickAction: (id: string, action: FileCardAction) => void;
	onToggleFavorite?: (id: string) => void;
	columns?: number;
	itemHeight?: number;
	containerHeight?: number;
}

export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({
	contents,
	selectedIds,
	favorites,
	isSelectMode: _isSelectMode = false,
	onSelect,
	onClick,
	onQuickAction,
	onToggleFavorite,
	columns = 4,
	itemHeight = 280,
	containerHeight,
}) => {
	const { t } = useTranslation('contentManager');
	const parentRef = useRef<HTMLDivElement>(null);
	const [kbFocusIndex, setKbFocusIndex] = React.useState(0);

	const [adaptiveColumns, setAdaptiveColumns] = React.useState(columns);

	React.useEffect(() => {
		const updateColumns = (): void => {
			const width = window.innerWidth;
			if (width < 640) {
				setAdaptiveColumns(1);
			} else if (width < 1024) {
				setAdaptiveColumns(2);
			} else if (width < 1280) {
				setAdaptiveColumns(3);
			} else {
				setAdaptiveColumns(4);
			}
		};

		updateColumns();
		window.addEventListener('resize', updateColumns);
		return () => window.removeEventListener('resize', updateColumns);
	}, []);

	const rowCount = Math.ceil(contents.length / adaptiveColumns);

	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => itemHeight + 16,
		getItemKey: (index) => contents[index * adaptiveColumns]?.id ?? index,
		overscan: 3,
	});

	const calculatedHeight =
		containerHeight || Math.min(600, window.innerHeight * 0.7);

	const rows = useMemo(() => {
		const result: Content[][] = [];
		for (let i = 0; i < contents.length; i += adaptiveColumns) {
			result.push(contents.slice(i, i + adaptiveColumns));
		}
		return result;
	}, [contents, adaptiveColumns]);

	const gridColsClass = useMemo(() => {
		if (adaptiveColumns === 1) {
			return 'grid-cols-1';
		}
		if (adaptiveColumns === 2) {
			return 'grid-cols-1 sm:grid-cols-2';
		}
		if (adaptiveColumns === 3) {
			return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
		}
		return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
	}, [adaptiveColumns]);

	React.useEffect(() => {
		setKbFocusIndex((i) => {
			if (contents.length === 0) return 0;
			return Math.min(Math.max(0, i), contents.length - 1);
		});
	}, [contents.length]);

	React.useEffect(() => {
		if (selectedIds.size !== 1) return;
		const id = Array.from(selectedIds)[0];
		const idx = contents.findIndex((c) => c.id === id);
		if (idx >= 0) setKbFocusIndex(idx);
	}, [selectedIds, contents]);

	const handleArrowGridNavigate = useCallback(
		(key: string, id: string): void => {
			const idx = contents.findIndex((c) => c.id === id);
			if (idx < 0) return;
			const cols = Math.max(1, adaptiveColumns);
			const len = contents.length;
			let next = idx;
			switch (key) {
				case 'ArrowRight':
					next = Math.min(len - 1, idx + 1);
					break;
				case 'ArrowLeft':
					next = Math.max(0, idx - 1);
					break;
				case 'ArrowDown':
					next = Math.min(len - 1, idx + cols);
					break;
				case 'ArrowUp':
					next = Math.max(0, idx - cols);
					break;
				case 'Home':
					next = 0;
					break;
				case 'End':
					next = len - 1;
					break;
				default:
					return;
			}
			if (next !== idx) setKbFocusIndex(next);
		},
		[contents, adaptiveColumns]
	);

	useLayoutEffect(() => {
		if (contents.length === 0 || !parentRef.current) return;
		const item = contents[kbFocusIndex];
		if (!item) return;
		const col = Math.max(1, adaptiveColumns);
		const rowIdx = Math.floor(kbFocusIndex / col);
		virtualizer.scrollToIndex(rowIdx, { align: 'auto' });
		const raf = requestAnimationFrame(() => {
			const root = parentRef.current;
			if (!root) return;
			const el = root.querySelector(
				`[data-uc-file-card-id="${CSS.escape(item.id)}"]`
			) as HTMLElement | null;
			if (!el) return;
			const ae = document.activeElement;
			const fromCard =
				ae instanceof HTMLElement &&
				!!ae.closest('[data-uc-virtual-grid-root]') &&
				ae.hasAttribute('data-uc-file-card-id');
			const sole = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
			if (sole === item.id || fromCard) {
				el.focus({ preventScroll: true });
			}
		});
		return () => cancelAnimationFrame(raf);
	}, [kbFocusIndex, contents, adaptiveColumns, selectedIds, virtualizer]);

	return (
		<div className="relative min-w-0 max-w-full">
			{contents.length > 30 && (
				<div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
					<div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400 motion-reduce:animate-none" />
					<span>{t('virtualizedGrid.active', { count: contents.length })}</span>
				</div>
			)}

			<div
				ref={parentRef}
				data-uc-virtual-grid-root
				className="min-w-0 overflow-auto rounded-lg"
				style={{ height: `${calculatedHeight}px` }}
			>
				<div
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						width: '100%',
						position: 'relative',
					}}
				>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const row = rows[virtualRow.index];
						if (!row) {
							return null;
						}

						return (
							<div
								key={virtualRow.key}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
								style={{
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									transform: `translateY(${virtualRow.start}px)`,
								}}
							>
								<div className={`grid ${gridColsClass} gap-4 px-4`}>
									{row.map((content, colIdx) => {
										const flatIdx = virtualRow.index * adaptiveColumns + colIdx;
										return (
											<FileCard
												key={content.id}
												content={content}
												selected={selectedIds.has(content.id)}
												isFavorite={favorites.has(content.id)}
												onSelect={onSelect}
												onClick={onClick}
												onQuickAction={onQuickAction}
												onToggleFavorite={onToggleFavorite}
												showContextMenu={true}
												cardTabIndex={kbFocusIndex === flatIdx ? 0 : -1}
												onArrowGridNavigate={handleArrowGridNavigate}
											/>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};
