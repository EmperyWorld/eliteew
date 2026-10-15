import { describe, expect, it } from 'vitest';

import type { MarketingDashboardWidget } from '../../marketingCabinetApi';
import {
	buildWidgetsClipboardPayload,
	MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION,
	parseWidgetsClipboardPayload,
} from '../dashboardWidgetClipboard';

describe('parseWidgetsClipboardPayload', () => {
	it('accepts v1 payload with known widget_key', () => {
		const r = parseWidgetsClipboardPayload({
			schemaVersion: MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION,
			widget_key: 'tasks',
			widget_title: 'My tasks',
			widget_config: { maxItems: 5 },
			grid_position: { w: 4, h: 5, minW: 3 },
		});
		expect(r).not.toBeNull();
		if (!r) return;
		expect(r.widget_key).toBe('tasks');
		expect(r.widget_title).toBe('My tasks');
		expect(r.widget_config.maxItems).toBe(5);
		expect(r.grid_position?.w).toBe(4);
	});

	it('rejects wrong schema version', () => {
		expect(
			parseWidgetsClipboardPayload({
				schemaVersion: 2,
				widget_key: 'tasks',
				widget_title: 'x',
			})
		).toBeNull();
	});

	it('rejects unknown widget_key', () => {
		expect(
			parseWidgetsClipboardPayload({
				schemaVersion: MC_DASHBOARD_CLIPBOARD_SCHEMA_VERSION,
				widget_key: 'not_real',
				widget_title: 'x',
			})
		).toBeNull();
	});

	it('build + parse roundtrip keeps title and config (Wave 23 / D.40)', () => {
		const widget = {
			id: 'w1',
			layout_id: 'l1',
			widget_key: 'tasks',
			widget_title: 'On board',
			widget_config: { titleOverride: 'Stored', maxItems: 3 },
			grid_position: { x: 0, y: 0, w: 4, h: 5, minW: 3, minH: 3 },
			is_visible: true,
			is_locked: false,
			display_order: 0,
			created_at: '',
			updated_at: '',
		} satisfies MarketingDashboardWidget;
		const built = buildWidgetsClipboardPayload(widget);
		const again = parseWidgetsClipboardPayload(built);
		expect(again).not.toBeNull();
		if (!again) return;
		expect(again.widget_title).toBe('On board');
		expect(again.widget_config.titleOverride).toBe('Stored');
		expect(again.widget_config.maxItems).toBe(3);
		expect(again.grid_position?.w).toBe(4);
	});
});
