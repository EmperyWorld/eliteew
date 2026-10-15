import { describe, expect, it } from 'vitest';

import type { MarketingDashboardWidget } from '../../marketingCabinetApi';

import { buildLayoutFromWidgets } from '../buildGridLayout';

function makeWidget(
	partial: Partial<MarketingDashboardWidget> &
		Pick<MarketingDashboardWidget, 'id' | 'widget_key'>
): MarketingDashboardWidget {
	const now = new Date().toISOString();
	return {
		layout_id: '00000000-0000-4000-8000-000000000001',
		widget_title: 'T',
		widget_config: {},
		grid_position: { x: 0, y: 0, w: 2, h: 2 },
		is_visible: true,
		is_locked: false,
		display_order: 0,
		created_at: now,
		updated_at: now,
		...partial,
	};
}

describe('buildLayoutFromWidgets', () => {
	it('maps visible widgets to RGL items with catalog minW/minH defaults', () => {
		const widgets: MarketingDashboardWidget[] = [
			makeWidget({
				id: 'a',
				widget_key: 'tasks',
				grid_position: { x: 1, y: 2, w: 4, h: 3 },
			}),
			makeWidget({
				id: 'b',
				widget_key: 'alerts',
				grid_position: { x: 5, y: 2, w: 4, h: 5 },
			}),
		];
		const layout = buildLayoutFromWidgets(widgets);
		expect(layout).toEqual([
			expect.objectContaining({
				i: 'a',
				x: 1,
				y: 2,
				w: 4,
				h: 5,
				minW: 3,
				minH: 3,
				static: false,
			}),
			expect.objectContaining({ i: 'b' }),
		]);
	});

	it('uses grid minW/minH when set on widget', () => {
		const widgets: MarketingDashboardWidget[] = [
			makeWidget({
				id: 'b',
				widget_key: 'chart_metric',
				grid_position: { x: 0, y: 0, w: 6, h: 5, minW: 6, minH: 5 },
				is_locked: true,
			}),
		];
		const layout = buildLayoutFromWidgets(widgets);
		expect(layout[0]).toMatchObject({ minW: 6, minH: 5, static: true });
	});

	it('omits hidden widgets', () => {
		const widgets: MarketingDashboardWidget[] = [
			makeWidget({ id: 'v', widget_key: 'tasks', is_visible: true }),
			makeWidget({ id: 'h', widget_key: 'alerts', is_visible: false }),
		];
		expect(buildLayoutFromWidgets(widgets).map((x) => x.i)).toEqual(['v']);
	});

	it('clamps stored h below catalog defaultH', () => {
		const widgets: MarketingDashboardWidget[] = [
			makeWidget({
				id: 'kpi',
				widget_key: 'overview_kpi',
				grid_position: { x: 0, y: 0, w: 12, h: 3 },
			}),
		];
		const layout = buildLayoutFromWidgets(widgets);
		expect(layout[0]?.h).toBeGreaterThanOrEqual(5);
	});

	it('expands a lone visible tile to SINGLE_VISIBLE_TILE_MIN_H', () => {
		const widgets: MarketingDashboardWidget[] = [
			makeWidget({
				id: 'solo',
				widget_key: 'overview_kpi',
				grid_position: { x: 0, y: 0, w: 12, h: 5 },
			}),
			makeWidget({
				id: 'hidden',
				widget_key: 'tasks',
				is_visible: false,
			}),
		];
		const layout = buildLayoutFromWidgets(widgets);
		expect(layout).toHaveLength(1);
		expect(layout[0]?.h).toBeGreaterThanOrEqual(8);
	});

	it('readOnlyLayout forces static on all tiles (C.31)', () => {
		const widgets: MarketingDashboardWidget[] = [
			makeWidget({
				id: 'r',
				widget_key: 'tasks',
				is_locked: false,
			}),
		];
		expect(
			buildLayoutFromWidgets(widgets, { readOnlyLayout: true })[0]?.static
		).toBe(true);
	});
});
