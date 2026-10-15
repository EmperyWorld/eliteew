import type {
	MarketingChartMetricsBarChartFormat,
	MarketingCanvasContentMode,
	MarketingChartMetricWidgetConfig,
	MarketingChartMetricsBarWidgetConfig,
	MarketingWidgetCanvasConfig,
	MarketingWidgetConfigCommon,
	MarketingWidgetDensity,
	MarketingWidgetListConfig,
	MarketingWidgetSortSpec,
	ParsedMarketingWidgetConfig,
} from './types';
import {
	isMarketingDashboardWidgetKey,
	isMarketingDashboardWidgetListKey,
} from './types';

const MAX_WINDOW_DAYS = 90;
const MAX_MAX_ITEMS = 500;
/** Подмножество ключей метрик для `chart_metrics_bar` (синхронизировать с API). */
const MAX_METRICS_BAR_SELECTED_KEYS = 12;
const MAX_METRIC_KEY_CHARS = 64;
const CHART_METRICS_BAR_FORMATS: ReadonlySet<MarketingChartMetricsBarChartFormat> =
	new Set(['bar_horizontal', 'bar_vertical', 'donut']);
/** Keep in sync with `MAX_CANVAS_MARKDOWN_UTF8_BYTES` in `dashboard_widget_config.py`. */
export const MAX_CANVAS_MARKDOWN_UTF8_BYTES = 32768;

/** Keep in sync with `MAX_TLDRAW_SNAPSHOT_JSON_BYTES` in `dashboard_widget_config.py`. */
export const MAX_TLDRAW_SNAPSHOT_JSON_BYTES = 524288;

const canvasUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

function truncateUtf8ToMaxBytes(s: string, maxBytes: number): string {
	const encoder = new TextEncoder();
	const buf = encoder.encode(s);
	if (buf.length <= maxBytes) {
		return s;
	}
	let end = maxBytes;
	while (end > 0) {
		try {
			return canvasUtf8Decoder.decode(buf.subarray(0, end));
		} catch {
			end -= 1;
		}
	}
	return '';
}

/** While typing: enforce UTF-8 byte cap only (persistence trims whitespace server-side). */
export function clampMarketingCanvasDraftText(s: string): string {
	return truncateUtf8ToMaxBytes(s, MAX_CANVAS_MARKDOWN_UTF8_BYTES);
}

function pickCanvasMarkdown(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const t = value.trim();
	if (t.length === 0) {
		return undefined;
	}
	return truncateUtf8ToMaxBytes(t, MAX_CANVAS_MARKDOWN_UTF8_BYTES);
}

function pickCanvasMode(
	value: unknown
): MarketingCanvasContentMode | undefined {
	if (value === 'markdown' || value === 'drawing') {
		return value;
	}
	return undefined;
}

function pickTldrawSnapshot(
	value: unknown
): Record<string, unknown> | undefined {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const o = value as Record<string, unknown>;
	try {
		const blob = JSON.stringify(o);
		if (
			new TextEncoder().encode(blob).length > MAX_TLDRAW_SNAPSHOT_JSON_BYTES
		) {
			return undefined;
		}
	} catch {
		return undefined;
	}
	return o;
}

function toPlainObject(raw: unknown): Record<string, unknown> {
	if (raw === null || raw === undefined) {
		return {};
	}
	if (typeof raw !== 'object' || Array.isArray(raw)) {
		return {};
	}
	return raw as Record<string, unknown>;
}

function pickTrimmedString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const t = value.trim();
	return t.length > 0 ? t : undefined;
}

function pickDensity(value: unknown): MarketingWidgetDensity | undefined {
	if (value === 'compact' || value === 'comfortable') {
		return value;
	}
	return undefined;
}

function pickPositiveInt(value: unknown, max: number): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		const n = Math.trunc(value);
		if (n >= 1 && n <= max) {
			return n;
		}
		return undefined;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const n = Number.parseInt(value, 10);
		if (Number.isFinite(n) && n >= 1 && n <= max) {
			return n;
		}
	}
	return undefined;
}

function parseSortSpec(raw: unknown): MarketingWidgetSortSpec | undefined {
	if (typeof raw === 'string') {
		return pickTrimmedString(raw);
	}
	if (
		raw === null ||
		raw === undefined ||
		typeof raw !== 'object' ||
		Array.isArray(raw)
	) {
		return undefined;
	}
	const o = raw as Record<string, unknown>;
	const fieldRaw = o.field;
	const field =
		typeof fieldRaw === 'string'
			? pickTrimmedString(fieldRaw)
			: fieldRaw === undefined
				? undefined
				: String(fieldRaw);
	const dir = o.direction;
	const direction = dir === 'asc' || dir === 'desc' ? dir : undefined;
	if (field === undefined && direction === undefined) {
		return undefined;
	}
	return { field, direction };
}

function parseFilters(raw: unknown): Record<string, unknown> | undefined {
	if (
		raw === null ||
		raw === undefined ||
		typeof raw !== 'object' ||
		Array.isArray(raw)
	) {
		return undefined;
	}
	return { ...(raw as Record<string, unknown>) };
}

function parseCommonFields(
	obj: Record<string, unknown>
): MarketingWidgetConfigCommon {
	const out: MarketingWidgetConfigCommon = {};
	const title = pickTrimmedString(obj.titleOverride);
	if (title !== undefined) {
		out.titleOverride = title;
	}
	const maxItems = pickPositiveInt(obj.maxItems, MAX_MAX_ITEMS);
	if (maxItems !== undefined) {
		out.maxItems = maxItems;
	}
	const density = pickDensity(obj.density);
	if (density !== undefined) {
		out.density = density;
	}
	return out;
}

function parseListConfig(
	obj: Record<string, unknown>,
	common: MarketingWidgetConfigCommon
): MarketingWidgetListConfig {
	const sort = parseSortSpec(obj.sort);
	const filters = parseFilters(obj.filters);
	const out: MarketingWidgetListConfig = { ...common };
	if (sort !== undefined) {
		out.sort = sort;
	}
	if (filters !== undefined) {
		out.filters = filters;
	}
	return out;
}

function parseChartMetricConfig(
	obj: Record<string, unknown>,
	common: MarketingWidgetConfigCommon
): MarketingChartMetricWidgetConfig {
	const out: MarketingChartMetricWidgetConfig = { ...common };
	const chartKind = pickTrimmedString(obj.chartKind);
	if (chartKind !== undefined) {
		out.chartKind = chartKind;
	}
	const metric = pickTrimmedString(obj.metric);
	if (metric !== undefined) {
		out.metric = metric;
	}
	const windowDaysRaw = pickPositiveInt(obj.windowDays, MAX_WINDOW_DAYS);
	if (windowDaysRaw !== undefined) {
		out.windowDays = windowDaysRaw;
	}
	return out;
}

function parseMetricKeysForBar(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const out: string[] = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (typeof entry !== 'string') {
			continue;
		}
		const key = entry.trim().slice(0, MAX_METRIC_KEY_CHARS);
		if (!key || seen.has(key)) {
			continue;
		}
		seen.add(key);
		out.push(key);
		if (out.length >= MAX_METRICS_BAR_SELECTED_KEYS) {
			break;
		}
	}
	if (!out.length) {
		return undefined;
	}
	return out;
}

function parseChartFormatForBar(
	value: unknown
): MarketingChartMetricsBarChartFormat | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const fmt = value.trim() as MarketingChartMetricsBarChartFormat;
	if (CHART_METRICS_BAR_FORMATS.has(fmt)) {
		return fmt;
	}
	return undefined;
}

function parseChartMetricsBarConfig(
	obj: Record<string, unknown>,
	common: MarketingWidgetConfigCommon
): MarketingChartMetricsBarWidgetConfig {
	const out: MarketingChartMetricsBarWidgetConfig = { ...common };
	const windowDaysRaw = pickPositiveInt(obj.windowDays, MAX_WINDOW_DAYS);
	if (windowDaysRaw !== undefined) {
		out.windowDays = windowDaysRaw;
	}
	const agg = obj.aggregation;
	if (agg === 'last' || agg === 'sum') {
		out.aggregation = agg;
	}
	const metricKeys = parseMetricKeysForBar(obj.metricKeys);
	if (metricKeys !== undefined) {
		out.metricKeys = metricKeys;
	}
	const chartFormat = parseChartFormatForBar(obj.chartFormat);
	if (chartFormat !== undefined) {
		out.chartFormat = chartFormat;
	}
	return out;
}

function parseMarketingCanvasConfig(
	obj: Record<string, unknown>,
	common: MarketingWidgetConfigCommon
): MarketingWidgetCanvasConfig {
	const out: MarketingWidgetCanvasConfig = { ...common };
	const md = pickCanvasMarkdown(obj.canvasMarkdown);
	if (md !== undefined) {
		out.canvasMarkdown = md;
	}
	const mode = pickCanvasMode(obj.canvasMode);
	if (mode !== undefined) {
		out.canvasMode = mode;
	}
	const snap = pickTldrawSnapshot(obj.tldrawSnapshot);
	if (snap !== undefined) {
		out.tldrawSnapshot = snap;
	}
	return out;
}

/**
 * Safely parse JSONB widget_config for a tile. Never throws; invalid shapes yield defaults.
 */
export function parseWidgetConfig(
	widgetKey: string,
	raw: unknown
): ParsedMarketingWidgetConfig {
	const obj = toPlainObject(raw);
	const common = parseCommonFields(obj);

	if (!isMarketingDashboardWidgetKey(widgetKey)) {
		return { knownKey: false, widget_key: widgetKey, config: common };
	}

	if (widgetKey === 'overview_kpi') {
		return { knownKey: true, widget_key: widgetKey, config: common };
	}

	if (widgetKey === 'marketing_canvas') {
		return {
			knownKey: true,
			widget_key: widgetKey,
			config: parseMarketingCanvasConfig(obj, common),
		};
	}

	if (widgetKey === 'chart_metric') {
		return {
			knownKey: true,
			widget_key: widgetKey,
			config: parseChartMetricConfig(obj, common),
		};
	}

	if (widgetKey === 'chart_metrics_bar') {
		return {
			knownKey: true,
			widget_key: widgetKey,
			config: parseChartMetricsBarConfig(obj, common),
		};
	}

	if (isMarketingDashboardWidgetListKey(widgetKey)) {
		return {
			knownKey: true,
			widget_key: widgetKey,
			config: parseListConfig(obj, common),
		};
	}

	const _exhaustive: never = widgetKey;
	return _exhaustive;
}
