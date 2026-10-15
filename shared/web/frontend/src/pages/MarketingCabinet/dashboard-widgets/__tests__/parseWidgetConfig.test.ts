import { describe, expect, it } from 'vitest';

import {
	MAX_CANVAS_MARKDOWN_UTF8_BYTES,
	parseWidgetConfig,
} from '../parseWidgetConfig';
import { isParsedMarketingWidgetList } from '../types';

describe('parseWidgetConfig', () => {
	it('trims titleOverride on overview_kpi', () => {
		const r = parseWidgetConfig('overview_kpi', { titleOverride: '  KPI ' });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		expect(r.config.titleOverride).toBe('KPI');
	});

	it('keeps chart_metric chartKind strings as stored (widget picks area vs line)', () => {
		const lineish = parseWidgetConfig('chart_metric', { chartKind: 'line' });
		expect(lineish.knownKey).toBe(true);
		if (!lineish.knownKey) return;
		expect((lineish.config as { chartKind?: string }).chartKind).toBe('line');
	});

	it('parses chart_metrics_bar aggregation and windowDays', () => {
		const r = parseWidgetConfig('chart_metrics_bar', {
			windowDays: 14,
			aggregation: 'last',
		});
		expect(r.knownKey).toBe(true);
		if (!r.knownKey || r.widget_key !== 'chart_metrics_bar') return;
		expect(r.config.windowDays).toBe(14);
		expect(r.config.aggregation).toBe('last');
	});

	it('drops invalid chart_metrics_bar aggregation', () => {
		const r = parseWidgetConfig('chart_metrics_bar', { aggregation: 'mean' });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey || r.widget_key !== 'chart_metrics_bar') return;
		expect(r.config.aggregation).toBeUndefined();
	});

	it('parses chart_metrics_bar metricKeys, dedupes and caps', () => {
		const keys = Array.from({ length: 20 }, (_, i) => `m${i}`);
		const r = parseWidgetConfig('chart_metrics_bar', {
			metricKeys: ['a', '  b ', 'a', ...keys],
		});
		expect(r.knownKey).toBe(true);
		if (!r.knownKey || r.widget_key !== 'chart_metrics_bar') return;
		expect(r.config.metricKeys?.[0]).toBe('a');
		expect(r.config.metricKeys?.[1]).toBe('b');
		expect(r.config.metricKeys?.length).toBe(12);
	});

	it('drops invalid chart_metrics_bar chartFormat', () => {
		const r = parseWidgetConfig('chart_metrics_bar', { chartFormat: 'radar' });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey || r.widget_key !== 'chart_metrics_bar') return;
		expect(r.config.chartFormat).toBeUndefined();
	});

	it('keeps valid chart_metrics_bar chartFormat', () => {
		const r = parseWidgetConfig('chart_metrics_bar', {
			chartFormat: 'donut',
		});
		expect(r.knownKey).toBe(true);
		if (!r.knownKey || r.widget_key !== 'chart_metrics_bar') return;
		expect(r.config.chartFormat).toBe('donut');
	});

	it('treats unknown keys as unknown with common fields only', () => {
		const r = parseWidgetConfig('not_a_real_widget', {
			titleOverride: '  Hi ',
			maxItems: 9999,
			foo: 'bar',
		});
		expect(r.knownKey).toBe(false);
		expect(r.widget_key).toBe('not_a_real_widget');
		expect(r.config.titleOverride).toBe('Hi');
		expect(r.config.maxItems).toBeUndefined();
	});

	it('marketing_canvas: drops invalid canvasMode, keeps drawing', () => {
		const badMode = parseWidgetConfig('marketing_canvas', {
			canvasMode: 'hybrid',
			canvasMarkdown: '  hi ',
		});
		expect(badMode.knownKey).toBe(true);
		if (!badMode.knownKey || badMode.widget_key !== 'marketing_canvas') return;
		expect(badMode.config.canvasMode).toBeUndefined();
		expect(badMode.config.canvasMarkdown).toBe('hi');

		const ok = parseWidgetConfig('marketing_canvas', { canvasMode: 'drawing' });
		expect(ok.knownKey).toBe(true);
		if (!ok.knownKey || ok.widget_key !== 'marketing_canvas') return;
		expect(ok.config.canvasMode).toBe('drawing');
	});

	it('drops non-object filters for list widgets (M.125 edge)', () => {
		const r = parseWidgetConfig('campaigns', {
			filters: 'not-an-object' as unknown as Record<string, string>,
			maxItems: 5,
		});
		expect(r.knownKey).toBe(true);
		if (!isParsedMarketingWidgetList(r)) return;
		expect(r.config.filters).toBeUndefined();
		expect(r.config.maxItems).toBe(5);
	});

	it('parses list widget sort and filters', () => {
		const r = parseWidgetConfig('tasks', {
			sort: { field: 'due_at', direction: 'desc' },
			filters: { status: 'open' },
			maxItems: '40',
		});
		expect(r.knownKey).toBe(true);
		if (!isParsedMarketingWidgetList(r)) return;
		expect(r.config.sort).toEqual({ field: 'due_at', direction: 'desc' });
		expect(r.config.filters).toEqual({ status: 'open' });
		expect(r.config.maxItems).toBe(40);
	});

	it('parses imc_recent list filters (status, type_key)', () => {
		const r = parseWidgetConfig('imc_recent', {
			filters: { status: 'completed', type_key: 'imc_rag_swot' },
			maxItems: 12,
		});
		expect(r.knownKey).toBe(true);
		if (!isParsedMarketingWidgetList(r)) return;
		expect(r.widget_key).toBe('imc_recent');
		expect(r.config.filters).toEqual({
			status: 'completed',
			type_key: 'imc_rag_swot',
		});
		expect(r.config.maxItems).toBe(12);
	});

	it('parses jtbd_stories, value_props, and competitors as list widgets', () => {
		for (const key of ['jtbd_stories', 'value_props', 'competitors'] as const) {
			const filters =
				key === 'competitors'
					? { competitor_type: 'direct' }
					: { status: 'active' };
			const r = parseWidgetConfig(key, {
				filters,
				maxItems: 8,
				sort: { field: 'updated_at', direction: 'desc' },
			});
			expect(r.knownKey).toBe(true);
			if (!isParsedMarketingWidgetList(r)) return;
			expect(r.widget_key).toBe(key);
			expect(r.config.maxItems).toBe(8);
			expect(r.config.sort).toEqual({
				field: 'updated_at',
				direction: 'desc',
			});
			expect(r.config.filters).toEqual(filters);
		}
	});

	it('drops invalid chart windowDays', () => {
		const r = parseWidgetConfig('chart_metric', { windowDays: 0 });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		expect((r.config as { windowDays?: number }).windowDays).toBeUndefined();
	});

	it('rejects oversize tldraw snapshot', () => {
		const huge: Record<string, unknown> = {};
		const filler = 'x'.repeat(600_000);
		huge.a = filler;
		const r = parseWidgetConfig('marketing_canvas', { tldrawSnapshot: huge });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		expect(
			(r.config as { tldrawSnapshot?: unknown }).tldrawSnapshot
		).toBeUndefined();
	});

	it('clamps canvas markdown by UTF-8 bytes', () => {
		const long = '\u0100'.repeat(MAX_CANVAS_MARKDOWN_UTF8_BYTES);
		const r = parseWidgetConfig('marketing_canvas', { canvasMarkdown: long });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		const md = (r.config as { canvasMarkdown?: string }).canvasMarkdown;
		expect(md).toBeDefined();
		expect(new TextEncoder().encode(md ?? '').length).toBeLessThanOrEqual(
			MAX_CANVAS_MARKDOWN_UTF8_BYTES
		);
	});

	it('drops invalid sort direction but keeps field on list widgets', () => {
		const r = parseWidgetConfig('tasks', {
			sort: { field: 'due_at', direction: 'sideways' },
		});
		expect(r.knownKey).toBe(true);
		if (!isParsedMarketingWidgetList(r)) return;
		expect(r.config.sort).toEqual({ field: 'due_at', direction: undefined });
	});

	it('omits sort when only direction is present and direction is invalid', () => {
		const r = parseWidgetConfig('alerts', {
			sort: { direction: 'ascending' },
		});
		expect(r.knownKey).toBe(true);
		if (!isParsedMarketingWidgetList(r)) return;
		expect(r.config.sort).toBeUndefined();
	});

	it('preserves unknown filter keys on list widgets', () => {
		const r = parseWidgetConfig('tasks', {
			filters: { status: 'open', futureFlag: true, nested: { a: 1 } },
		});
		expect(r.knownKey).toBe(true);
		if (!isParsedMarketingWidgetList(r)) return;
		expect(r.config.filters).toEqual({
			status: 'open',
			futureFlag: true,
			nested: { a: 1 },
		});
	});

	it('accepts chart_metric windowDays at max (90) and drops above max', () => {
		const atMax = parseWidgetConfig('chart_metric', { windowDays: 90 });
		expect(atMax.knownKey).toBe(true);
		if (!atMax.knownKey) return;
		expect((atMax.config as { windowDays?: number }).windowDays).toBe(90);

		const overMax = parseWidgetConfig('chart_metric', { windowDays: 91 });
		expect(overMax.knownKey).toBe(true);
		if (!overMax.knownKey) return;
		expect(
			(overMax.config as { windowDays?: number }).windowDays
		).toBeUndefined();
	});

	it('parses chart_metric windowDays max boundary from numeric string', () => {
		const r = parseWidgetConfig('chart_metric', { windowDays: '90' });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		expect((r.config as { windowDays?: number }).windowDays).toBe(90);

		const tooBig = parseWidgetConfig('chart_metric', { windowDays: '91' });
		expect(tooBig.knownKey).toBe(true);
		if (!tooBig.knownKey) return;
		expect(
			(tooBig.config as { windowDays?: number }).windowDays
		).toBeUndefined();
	});

	it('ignores invalid marketing_canvas canvasMode values', () => {
		const r = parseWidgetConfig('marketing_canvas', {
			canvasMode: 'whiteboard',
		});
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		expect((r.config as { canvasMode?: string }).canvasMode).toBeUndefined();
	});

	it('accepts list maxItems at boundary (500) and drops above for alerts and tasks', () => {
		for (const key of ['alerts', 'tasks'] as const) {
			const ok = parseWidgetConfig(key, { maxItems: 500 });
			expect(ok.knownKey).toBe(true);
			if (!ok.knownKey) return;
			expect(ok.config.maxItems).toBe(500);

			const tooMany = parseWidgetConfig(key, { maxItems: 501 });
			expect(tooMany.knownKey).toBe(true);
			if (!tooMany.knownKey) return;
			expect(tooMany.config.maxItems).toBeUndefined();
		}
	});

	it('treats null and undefined raw config as empty object (no throw)', () => {
		for (const raw of [null, undefined]) {
			const list = parseWidgetConfig('tasks', raw);
			expect(list.knownKey).toBe(true);
			if (!list.knownKey) return;
			expect(list.config).toEqual({});

			const chart = parseWidgetConfig('chart_metric', raw);
			expect(chart.knownKey).toBe(true);
			if (!chart.knownKey) return;
			expect(chart.config).toEqual({});

			const bar = parseWidgetConfig('chart_metrics_bar', raw);
			expect(bar.knownKey).toBe(true);
			if (!bar.knownKey) return;
			expect(bar.config).toEqual({});

			const canvas = parseWidgetConfig('marketing_canvas', raw);
			expect(canvas.knownKey).toBe(true);
			if (!canvas.knownKey) return;
			expect(canvas.config).toEqual({});

			const unknown = parseWidgetConfig('not_a_key', raw);
			expect(unknown.knownKey).toBe(false);
			expect(unknown.config).toEqual({});
		}
	});

	it('normalizes overview_kpi density', () => {
		const ok = parseWidgetConfig('overview_kpi', { density: 'comfortable' });
		expect(ok.knownKey).toBe(true);
		if (!ok.knownKey) return;
		expect(ok.config.density).toBe('comfortable');

		const bad = parseWidgetConfig('overview_kpi', { density: 'ultra' });
		expect(bad.knownKey).toBe(true);
		if (!bad.knownKey) return;
		expect(bad.config.density).toBeUndefined();
	});

	it('parses marketing_canvas with both modes and markdown', () => {
		const r = parseWidgetConfig('marketing_canvas', {
			canvasMode: 'markdown',
			canvasMarkdown: '  hello ',
		});
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		expect((r.config as { canvasMode?: string }).canvasMode).toBe('markdown');
		expect((r.config as { canvasMarkdown?: string }).canvasMarkdown).toBe(
			'hello'
		);
	});

	it('maps non-finite maxItems on list widgets to undefined', () => {
		const r = parseWidgetConfig('funnel', { maxItems: Number.NaN });
		expect(r.knownKey).toBe(true);
		if (!r.knownKey) return;
		expect(r.config.maxItems).toBeUndefined();
	});
});
