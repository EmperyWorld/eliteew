/**
 * Dashboard widget wiring types (marketing cabinet).
 * Canonical module for `widget_key` / `widget_config`; API layer re-exports from `marketingCabinetApi/index.ts`.
 */

export const MARKETING_DASHBOARD_WIDGET_KEYS = [
	'overview_kpi',
	'tasks',
	'funnel',
	'campaigns',
	'alerts',
	'segments',
	'ai_activity',
	'swot',
	'researches',
	/** Recent IMC (AI research) runs for the project. */
	'imc_recent',
	/** JTBD / job stories list tile */
	'jtbd_stories',
	/** Value propositions list tile */
	'value_props',
	/** Competitors list tile */
	'competitors',
	/** Wave 3 — chart tile */
	'chart_metric',
	/** Сравнение метрик столбцами (те же ряды, что у линейного графика). */
	'chart_metrics_bar',
	/** Wave 4 — dashboard notes canvas (Markdown in widget_config) */
	'marketing_canvas',
] as const;

export type MarketingDashboardWidgetKey =
	(typeof MARKETING_DASHBOARD_WIDGET_KEYS)[number];

export type MarketingDashboardWidgetDensity = 'compact' | 'comfortable';

/** Alias used by parsers / widget internals. */
export type MarketingWidgetDensity = MarketingDashboardWidgetDensity;

export type MarketingDashboardWidgetListKey = Exclude<
	MarketingDashboardWidgetKey,
	'overview_kpi' | 'chart_metric' | 'chart_metrics_bar' | 'marketing_canvas'
>;

/** List-style tiles (shared list-config branch in {@link parseWidgetConfig}). */
export const MARKETING_DASHBOARD_LIST_KEYS = [
	'tasks',
	'funnel',
	'campaigns',
	'alerts',
	'segments',
	'ai_activity',
	'swot',
	'researches',
	'imc_recent',
	'jtbd_stories',
	'value_props',
	'competitors',
] as const satisfies readonly MarketingDashboardWidgetListKey[];

export type MarketingWidgetSortSpec =
	| string
	| {
			field?: string;
			direction?: 'asc' | 'desc';
	  };

/** Normalized fields shared by every tile config branch. */
export interface MarketingWidgetConfigCommon {
	titleOverride?: string;
	maxItems?: number;
	density?: MarketingDashboardWidgetDensity;
	/** List tiles use these; other keys ignore them at runtime. */
	sort?: MarketingWidgetSortSpec;
	filters?: Record<string, unknown>;
}

export interface MarketingWidgetListConfig
	extends MarketingWidgetConfigCommon {}

export interface MarketingChartMetricWidgetConfig
	extends MarketingWidgetConfigCommon {
	chartKind?: string;
	metric?: string;
	windowDays?: number;
}

/** Форма диаграммы для `chart_metrics_bar`. */
export type MarketingChartMetricsBarChartFormat =
	| 'bar_horizontal'
	| 'bar_vertical'
	| 'donut';

/** Столбчатое сравнение метрик за окно: сумма по дням или последнее значение. */
export interface MarketingChartMetricsBarWidgetConfig
	extends MarketingWidgetConfigCommon {
	windowDays?: number;
	aggregation?: 'last' | 'sum';
	/** Подмножество ключей `analytics.series`; пусто / отсутствует — все доступные ряды. */
	metricKeys?: string[];
	chartFormat?: MarketingChartMetricsBarChartFormat;
}

/** Content mode for the `marketing_canvas` tile (`widget_config.canvasMode`). */
export type MarketingCanvasContentMode = 'markdown' | 'drawing';

export interface MarketingWidgetCanvasConfig
	extends MarketingWidgetConfigCommon {
	canvasMarkdown?: string;
	canvasMode?: MarketingCanvasContentMode;
	tldrawSnapshot?: Record<string, unknown>;
}

/**
 * Sanitized options object returned inside {@link ParsedMarketingWidgetConfig} for known keys
 * (safe for `.maxItems`, `.density`, etc. in widget bodies).
 */
export type MarketingDashboardWidgetBodyConfig =
	| MarketingWidgetConfigCommon
	| MarketingWidgetListConfig
	| MarketingChartMetricWidgetConfig
	| MarketingChartMetricsBarWidgetConfig
	| MarketingWidgetCanvasConfig;

/**
 * `widget_config` JSON from `marketing_dashboard_widgets.widget_config` (JSONB).
 * Known fields from product plan; extra keys allowed for forward compatibility.
 */
export interface MarketingWidgetConfig extends MarketingWidgetConfigCommon {
	chartKind?: string;
	metric?: string;
	windowDays?: number;
	aggregation?: 'last' | 'sum';
	metricKeys?: string[];
	chartFormat?: string;
	canvasKind?: string;
	canvasMarkdown?: string;
	canvasMode?: MarketingCanvasContentMode;
	tldrawSnapshot?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface ParsedMarketingWidgetUnknownKey {
	knownKey: false;
	widget_key: string;
	config: MarketingWidgetConfigCommon;
}

export interface ParsedMarketingWidgetOverviewKpi {
	knownKey: true;
	widget_key: 'overview_kpi';
	config: MarketingWidgetConfigCommon;
}

export interface ParsedMarketingWidgetChartMetric {
	knownKey: true;
	widget_key: 'chart_metric';
	config: MarketingChartMetricWidgetConfig;
}

export interface ParsedMarketingWidgetChartMetricsBar {
	knownKey: true;
	widget_key: 'chart_metrics_bar';
	config: MarketingChartMetricsBarWidgetConfig;
}

export interface ParsedMarketingWidgetMarketingCanvas {
	knownKey: true;
	widget_key: 'marketing_canvas';
	config: MarketingWidgetCanvasConfig;
}

export interface ParsedMarketingWidgetList {
	knownKey: true;
	widget_key: MarketingDashboardWidgetListKey;
	config: MarketingWidgetListConfig;
}

/**
 * Discriminated union: {@link ParsedMarketingWidgetConfig#widget_key} and {@link ParsedMarketingWidgetConfig#knownKey}.
 */
export type ParsedMarketingWidgetConfig =
	| ParsedMarketingWidgetUnknownKey
	| ParsedMarketingWidgetOverviewKpi
	| ParsedMarketingWidgetMarketingCanvas
	| ParsedMarketingWidgetChartMetric
	| ParsedMarketingWidgetChartMetricsBar
	| ParsedMarketingWidgetList;

const MARKETING_DASHBOARD_WIDGET_KEYS_SET = new Set<string>(
	MARKETING_DASHBOARD_WIDGET_KEYS
);

const MARKETING_DASHBOARD_LIST_KEYS_SET = new Set<string>(
	MARKETING_DASHBOARD_LIST_KEYS
);

export function isMarketingDashboardWidgetKey(
	key: string
): key is MarketingDashboardWidgetKey {
	return MARKETING_DASHBOARD_WIDGET_KEYS_SET.has(key);
}

export function isMarketingDashboardWidgetListKey(
	key: string
): key is MarketingDashboardWidgetListKey {
	return MARKETING_DASHBOARD_LIST_KEYS_SET.has(key);
}

export function isParsedMarketingWidgetUnknown(
	p: ParsedMarketingWidgetConfig
): p is ParsedMarketingWidgetUnknownKey {
	return p.knownKey === false;
}

export function isParsedMarketingWidgetOverviewKpi(
	p: ParsedMarketingWidgetConfig
): p is ParsedMarketingWidgetOverviewKpi {
	return p.knownKey === true && p.widget_key === 'overview_kpi';
}

export function isParsedMarketingWidgetChartMetric(
	p: ParsedMarketingWidgetConfig
): p is ParsedMarketingWidgetChartMetric {
	return p.knownKey === true && p.widget_key === 'chart_metric';
}

export function isParsedMarketingWidgetChartMetricsBar(
	p: ParsedMarketingWidgetConfig
): p is ParsedMarketingWidgetChartMetricsBar {
	return p.knownKey === true && p.widget_key === 'chart_metrics_bar';
}

export function isParsedMarketingWidgetList(
	p: ParsedMarketingWidgetConfig
): p is ParsedMarketingWidgetList {
	return p.knownKey === true && isMarketingDashboardWidgetListKey(p.widget_key);
}
