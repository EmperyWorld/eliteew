import type { Layout } from 'react-grid-layout';

import type {
	MarketingDashboardWidget,
	MarketingDashboardWidgetUpdatePayload,
} from '../marketingCabinetApi';

/** Next free row below existing tiles (stack new widgets at the bottom). */
export function nextNewWidgetY(widgets: MarketingDashboardWidget[]): number {
	let maxY = 0;
	for (const w of widgets) {
		const y = w.grid_position.y ?? 0;
		const h = w.grid_position.h ?? 2;
		maxY = Math.max(maxY, y + h);
	}
	return maxY;
}

export function nextDisplayOrder(widgets: MarketingDashboardWidget[]): number {
	let m = 0;
	for (const w of widgets) {
		m = Math.max(m, w.display_order ?? 0);
	}
	return m + 1;
}

export function layoutItemMatchesWidget(
	item: Layout[number],
	prev: MarketingDashboardWidget
): boolean {
	const g = prev.grid_position;
	return (
		(g.x ?? 0) === item.x &&
		(g.y ?? 0) === item.y &&
		(g.w ?? 2) === item.w &&
		(g.h ?? 2) === item.h
	);
}

export function isWidgetConfigOnlyPatch(
	body: MarketingDashboardWidgetUpdatePayload
): boolean {
	const defined = (v: unknown) => v !== undefined;
	return (
		defined(body.widget_config) &&
		!defined(body.widget_title) &&
		!defined(body.grid_position) &&
		!defined(body.is_visible) &&
		!defined(body.is_locked) &&
		!defined(body.display_order)
	);
}
