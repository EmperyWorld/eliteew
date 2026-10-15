import * as React from 'react';

import type { MarketingDashboardWidgetBodyProps } from './widgetBodyProps';
import type {
	MarketingChartMetricWidgetConfig,
	MarketingChartMetricsBarWidgetConfig,
	MarketingWidgetCanvasConfig,
} from './types';
import { UnknownFallbackWidget } from './widgets/unknownFallbackWidget';

/** K.109: bodies are code-split by `widget_key` (`React.lazy`); new keys must register here and stay tree-shake friendly. */
const OverviewKpiWidget = React.lazy(() =>
	import('./widgets/overviewKpiWidget').then((m) => ({
		default: m.OverviewKpiWidget,
	}))
);
const TasksWidget = React.lazy(() =>
	import('./widgets/tasksWidget').then((m) => ({ default: m.TasksWidget }))
);
const FunnelWidget = React.lazy(() =>
	import('./widgets/funnelWidget').then((m) => ({ default: m.FunnelWidget }))
);
const CampaignsWidget = React.lazy(() =>
	import('./widgets/campaignsWidget').then((m) => ({
		default: m.CampaignsWidget,
	}))
);
const AlertsWidget = React.lazy(() =>
	import('./widgets/alertsWidget').then((m) => ({ default: m.AlertsWidget }))
);
const SegmentsWidget = React.lazy(() =>
	import('./widgets/segmentsWidget').then((m) => ({
		default: m.SegmentsWidget,
	}))
);
const AiActivityWidget = React.lazy(() =>
	import('./widgets/aiActivityWidget').then((m) => ({
		default: m.AiActivityWidget,
	}))
);
const SwotWidget = React.lazy(() =>
	import('./widgets/swotWidget').then((m) => ({ default: m.SwotWidget }))
);
const ResearchesWidget = React.lazy(() =>
	import('./widgets/researchesWidget').then((m) => ({
		default: m.ResearchesWidget,
	}))
);
const ImcRecentWidget = React.lazy(() =>
	import('./widgets/imcRecentWidget').then((m) => ({
		default: m.ImcRecentWidget,
	}))
);
const JtbdStoriesWidget = React.lazy(() =>
	import('./widgets/jtbdStoriesWidget').then((m) => ({
		default: m.JtbdStoriesWidget,
	}))
);
const ValuePropsWidget = React.lazy(() =>
	import('./widgets/valuePropsWidget').then((m) => ({
		default: m.ValuePropsWidget,
	}))
);
const CompetitorsWidget = React.lazy(() =>
	import('./widgets/competitorsWidget').then((m) => ({
		default: m.CompetitorsWidget,
	}))
);
const ChartMetricWidget = React.lazy(() =>
	import('./widgets/chartMetricWidget').then((m) => ({
		default: m.ChartMetricWidget,
	}))
);
const ChartMetricsBarWidget = React.lazy(() =>
	import('./widgets/chartMetricsBarWidget').then((m) => ({
		default: m.ChartMetricsBarWidget,
	}))
);
const MarketingCanvasWidget = React.lazy(() =>
	import('./widgets/marketingCanvasWidget').then((m) => ({
		default: m.MarketingCanvasWidget,
	}))
);

/** Grid defaults per widget; 1:1 with add-widget catalog in the overview dashboard. */
export const DASHBOARD_WIDGET_CATALOG = [
	{ key: 'overview_kpi', defaultW: 6, defaultH: 5, minW: 4, minH: 5 },
	{ key: 'tasks', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'funnel', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'campaigns', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'alerts', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'segments', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'ai_activity', defaultW: 4, defaultH: 4, minW: 3, minH: 4 },
	{ key: 'swot', defaultW: 4, defaultH: 6, minW: 3, minH: 4 },
	{ key: 'researches', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'imc_recent', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'jtbd_stories', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'value_props', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{ key: 'competitors', defaultW: 4, defaultH: 5, minW: 3, minH: 3 },
	{
		key: 'chart_metric',
		defaultW: 6,
		defaultH: 5,
		minW: 5,
		minH: 4,
	},
	{
		key: 'chart_metrics_bar',
		defaultW: 6,
		defaultH: 5,
		minW: 4,
		minH: 4,
	},
	{
		key: 'marketing_canvas',
		defaultW: 4,
		defaultH: 4,
		minW: 4,
		minH: 4,
	},
] as const;

export type MarketingDashboardCatalogKey =
	(typeof DASHBOARD_WIDGET_CATALOG)[number]['key'];

export interface DashboardWidgetDefinition {
	key: MarketingDashboardCatalogKey;
	defaultW: number;
	defaultH: number;
	minW: number;
	minH: number;
	renderBody: (props: MarketingDashboardWidgetBodyProps) => React.ReactNode;
}

function catalogRow(
	key: MarketingDashboardCatalogKey
): Omit<DashboardWidgetDefinition, 'renderBody'> {
	const row = DASHBOARD_WIDGET_CATALOG.find((c) => c.key === key);
	if (!row) {
		throw new Error(`DASHBOARD_WIDGET_CATALOG missing key ${String(key)}`);
	}
	return row;
}

const ENTRIES: readonly DashboardWidgetDefinition[] = [
	{
		...catalogRow('overview_kpi'),
		renderBody: (p) => React.createElement(OverviewKpiWidget, p),
	},
	{
		...catalogRow('tasks'),
		renderBody: (p) => React.createElement(TasksWidget, p),
	},
	{
		...catalogRow('funnel'),
		renderBody: (p) => React.createElement(FunnelWidget, p),
	},
	{
		...catalogRow('campaigns'),
		renderBody: (p) => React.createElement(CampaignsWidget, p),
	},
	{
		...catalogRow('alerts'),
		renderBody: (p) => React.createElement(AlertsWidget, p),
	},
	{
		...catalogRow('segments'),
		renderBody: (p) => React.createElement(SegmentsWidget, p),
	},
	{
		...catalogRow('ai_activity'),
		renderBody: (p) => React.createElement(AiActivityWidget, p),
	},
	{
		...catalogRow('swot'),
		renderBody: (p) => React.createElement(SwotWidget, p),
	},
	{
		...catalogRow('researches'),
		renderBody: (p) => React.createElement(ResearchesWidget, p),
	},
	{
		...catalogRow('imc_recent'),
		renderBody: (p) => React.createElement(ImcRecentWidget, p),
	},
	{
		...catalogRow('jtbd_stories'),
		renderBody: (p) => React.createElement(JtbdStoriesWidget, p),
	},
	{
		...catalogRow('value_props'),
		renderBody: (p) => React.createElement(ValuePropsWidget, p),
	},
	{
		...catalogRow('competitors'),
		renderBody: (p) => React.createElement(CompetitorsWidget, p),
	},
	{
		...catalogRow('chart_metric'),
		renderBody: (p) =>
			React.createElement(ChartMetricWidget, {
				...p,
				widgetConfig: p.widgetConfig as MarketingChartMetricWidgetConfig,
			}),
	},
	{
		...catalogRow('chart_metrics_bar'),
		renderBody: (p) =>
			React.createElement(ChartMetricsBarWidget, {
				...p,
				widgetConfig: p.widgetConfig as MarketingChartMetricsBarWidgetConfig,
			}),
	},
	{
		...catalogRow('marketing_canvas'),
		renderBody: (p) =>
			React.createElement(MarketingCanvasWidget, {
				...p,
				widgetConfig: p.widgetConfig as MarketingWidgetCanvasConfig,
			}),
	},
];

const REGISTRY: Record<string, DashboardWidgetDefinition> = Object.fromEntries(
	ENTRIES.map((e) => [e.key, e])
);

export function getWidgetDefinition(
	key: string
): DashboardWidgetDefinition | undefined {
	return REGISTRY[key];
}

export function renderDashboardWidgetBody(
	props: MarketingDashboardWidgetBodyProps
): React.ReactNode {
	const def = getWidgetDefinition(props.widget.widget_key);
	if (def) {
		return def.renderBody(props);
	}
	return React.createElement(UnknownFallbackWidget, props);
}
