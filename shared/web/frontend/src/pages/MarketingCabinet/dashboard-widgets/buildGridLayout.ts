import type { Layout } from 'react-grid-layout';

import type { MarketingDashboardWidget } from '../marketingCabinetApi';

import { DASHBOARD_WIDGET_CATALOG } from './registry';

/** When only one tile is visible, avoid a collapsed strip with empty space below. */
export const SINGLE_VISIBLE_TILE_MIN_H = 8;

export type BuildLayoutFromWidgetsOptions = {
	/** C.31: no drag/resize handles — RGL treats all tiles as static. */
	readOnlyLayout?: boolean;
};

function resolveGridItemHeight(
	storedH: number | null | undefined,
	catalogMinH: number | undefined,
	catalogDefaultH: number | undefined,
	singleVisibleTile: boolean
): number {
	const floorH = Math.max(1, catalogMinH ?? 1, catalogDefaultH ?? 1);
	let h = Math.max(storedH ?? catalogDefaultH ?? floorH, floorH);
	if (singleVisibleTile) {
		h = Math.max(h, SINGLE_VISIBLE_TILE_MIN_H);
	}
	return h;
}

/** RGL layout items derived from persisted widgets (visible only). */
export function buildLayoutFromWidgets(
	widgets: MarketingDashboardWidget[],
	opts?: BuildLayoutFromWidgetsOptions
): Layout {
	const readOnly = Boolean(opts?.readOnlyLayout);
	const visible = widgets.filter((w) => w.is_visible);
	const singleVisibleTile = visible.length === 1;
	return visible.map((w) => {
		const cat = DASHBOARD_WIDGET_CATALOG.find((c) => c.key === w.widget_key);
		const minW = w.grid_position.minW ?? cat?.minW;
		const minH = w.grid_position.minH ?? cat?.minH;
		return {
			i: w.id,
			x: w.grid_position.x ?? 0,
			y: w.grid_position.y ?? 0,
			w: w.grid_position.w ?? cat?.defaultW ?? 2,
			h: resolveGridItemHeight(
				w.grid_position.h,
				minH ?? cat?.minH,
				cat?.defaultH,
				singleVisibleTile
			),
			minW: minW ?? undefined,
			minH: minH ?? undefined,
			maxW: w.grid_position.maxW ?? undefined,
			maxH: w.grid_position.maxH ?? undefined,
			static: readOnly || w.is_locked,
		};
	});
}
