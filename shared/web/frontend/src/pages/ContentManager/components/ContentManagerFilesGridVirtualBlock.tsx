/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memoized VirtualGrid adapter for a dense Content Manager files group.
 *
 * Invariants:
 * - `renderCell` stays stable for fixed geometry so the virtualizer is not reset every parent render.
 * - `rowHeight` is an estimate from column width; `VirtualGrid` measures real card rows.
 *
 * Related:
 * - components/shared/VirtualList.tsx
 * - ContentManagerFilesListBody.tsx
 */
import * as React from 'react';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { VirtualGrid } from '../../../components/shared/VirtualList';
import {
	CM_VIRTUAL_GRID_OVERSCAN_ROWS,
	estimateContentManagerVirtualGridRowHeightPx,
} from '../utils/contentManagerVirtualization';

export type ContentManagerFilesGridVirtualBlockProps = {
	items: ContentItem[];
	columnCount: number;
	columnWidth: number;
	height: number;
	groupStart: number;
	renderGridFileCard: (item: ContentItem, flatIdx: number) => React.ReactNode;
};

function ContentManagerFilesGridVirtualBlockInner({
	items,
	columnCount,
	columnWidth,
	height,
	groupStart,
	renderGridFileCard,
}: ContentManagerFilesGridVirtualBlockProps): React.ReactElement {
	const renderCell = React.useCallback(
		(item: ContentItem | undefined, rowIndex: number, columnIndex: number) => {
			if (!item) return null;
			const flatIdx = groupStart + rowIndex * columnCount + columnIndex;
			return (
				<div className="h-full min-h-0 p-1.5">
					{renderGridFileCard(item, flatIdx)}
				</div>
			);
		},
		[columnCount, groupStart, renderGridFileCard]
	);

	const estimatedRowHeight =
		estimateContentManagerVirtualGridRowHeightPx(columnWidth);

	return (
		<VirtualGrid
			items={items}
			columnCount={columnCount}
			columnWidth={columnWidth}
			rowHeight={estimatedRowHeight}
			height={height}
			overscanRows={CM_VIRTUAL_GRID_OVERSCAN_ROWS}
			className="min-h-0"
			renderCell={renderCell}
		/>
	);
}

export const ContentManagerFilesGridVirtualBlock = React.memo(
	ContentManagerFilesGridVirtualBlockInner
);
ContentManagerFilesGridVirtualBlock.displayName =
	'ContentManagerFilesGridVirtualBlock';
