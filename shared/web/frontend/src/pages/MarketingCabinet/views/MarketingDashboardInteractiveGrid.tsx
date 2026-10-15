import * as React from 'react';
import type { Layout } from 'react-grid-layout';
import ReactGridLayout from 'react-grid-layout/legacy';

import { MC_DASHBOARD_NO_DRAG_CLASS } from '../dashboard-widgets/TileChrome';
import {
	RGL_COMPACT_TYPE,
	RGL_PREVENT_COLLISION,
} from './overviewDashboardGridPolicy';
import {
	RGL_COLS,
	RGL_ROW_HEIGHT,
} from './overviewInteractiveDashboardConstants';

export function MarketingDashboardInteractiveGrid({
	containerRef,
	allowMarketingWrite,
	toolbarBusy,
	onGridCanvasContextMenu,
	mounted,
	width,
	gridLayout,
	onLayoutChange,
	children,
	visibleTileCount,
	allWidgetsCount,
	emptyWhenNoSizeSlot,
	emptyWhenAllHiddenSlot,
	emptyWhenNoWidgetsSlot,
}: {
	containerRef: React.RefObject<HTMLDivElement | null>;
	allowMarketingWrite: boolean;
	toolbarBusy: boolean;
	onGridCanvasContextMenu?: (ev: React.MouseEvent<HTMLDivElement>) => void;
	mounted: boolean;
	width: number;
	gridLayout: Layout;
	onLayoutChange: (layout: Layout) => void;
	children: React.ReactNode;
	/** Visible dashboard tiles — must match branching for placeholders (not React.Children.count). */
	visibleTileCount: number;
	allWidgetsCount: number;
	emptyWhenNoSizeSlot: React.ReactNode;
	emptyWhenAllHiddenSlot: React.ReactNode;
	emptyWhenNoWidgetsSlot: React.ReactNode;
}) {
	return (
		<div className="min-w-0 w-full overflow-x-hidden pb-6">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: RGL canvas — empty-area context menu for dashboard layout (same pattern as tile chrome). */}
			<div
				ref={containerRef}
				className="min-w-0 w-full"
				onContextMenu={onGridCanvasContextMenu}
			>
				{visibleTileCount > 0 && mounted && width > 0 ? (
					<ReactGridLayout
						className="mc-overview-dashboard-grid min-w-0"
						data-mc-guide="dashboard-grid"
						width={width}
						cols={RGL_COLS}
						rowHeight={RGL_ROW_HEIGHT}
						margin={[8, 8]}
						containerPadding={[0, 0]}
						layout={gridLayout}
						onLayoutChange={onLayoutChange}
						compactType={RGL_COMPACT_TYPE}
						preventCollision={RGL_PREVENT_COLLISION}
						autoSize
						resizeHandles={['se', 's', 'e']}
						draggableCancel={`.${MC_DASHBOARD_NO_DRAG_CLASS}`}
						isDraggable={Boolean(allowMarketingWrite && !toolbarBusy)}
						isResizable={Boolean(allowMarketingWrite && !toolbarBusy)}
						useCSSTransforms
					>
						{children}
					</ReactGridLayout>
				) : visibleTileCount > 0 ? (
					emptyWhenNoSizeSlot
				) : allWidgetsCount > 0 ? (
					emptyWhenAllHiddenSlot
				) : (
					emptyWhenNoWidgetsSlot
				)}
			</div>
		</div>
	);
}
