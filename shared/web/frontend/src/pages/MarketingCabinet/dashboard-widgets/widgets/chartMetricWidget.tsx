import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	Area,
	AreaChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';

import { cabinetNotify } from '../../cabinetNotify';
import { MarketingCabinetSelect } from '../../components/MarketingCabinetSelect';
import { mcDashboardRechartsTooltipSharedProps } from '../marketingDashboardRechartsTooltip';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';
import type {
	MarketingChartMetricWidgetConfig,
	MarketingWidgetConfig,
} from '../types';

const DEFAULT_METRIC = 'tasks_completed_daily';

const WINDOW_DAY_CHOICES = [7, 14, 21, 30, 45, 60, 90] as const;

/** Accent line; override with `--mc-dashboard-chart-line` in theme CSS if needed. */
const CHART_STROKE =
	'var(--mc-dashboard-chart-line, rgb(var(--desktop-accent-rgb)))';

function ChartMetricWidgetImpl(
	props: MarketingDashboardWidgetBodyProps & {
		widgetConfig: MarketingChartMetricWidgetConfig;
	}
) {
	const {
		dashboard,
		widgetConfig,
		allowMarketingWrite,
		onPersistWidgetConfig,
		widget,
		refetchProjectDashboard,
	} = props;
	const { t } = useTranslation('marketing');
	const reduceMotion = useReducedMotion();
	const chartBoxRef = React.useRef<HTMLDivElement>(null);
	const [pngBusy, setPngBusy] = React.useState(false);

	const metricRaw = widgetConfig.metric?.trim();
	const available = dashboard.analytics?.series ?? [];
	const requested = metricRaw || DEFAULT_METRIC;
	const seriesBlock =
		available.find((s) => s.key === requested) ??
		available.find((s) => s.key === DEFAULT_METRIC);
	const metric = String(seriesBlock?.key ?? DEFAULT_METRIC);
	const points = seriesBlock?.points ?? [];
	const labelKey = `metric.${metric}.label` as const;
	const axisLabel = t(labelKey, { defaultValue: metric });

	const chartKind = widgetConfig.chartKind === 'area' ? 'area' : 'line';

	const animationDuration = reduceMotion ? 0 : 400;
	const stroke = CHART_STROKE;

	const metricOptions = React.useMemo(() => {
		const rows = (dashboard.analytics?.series ?? []).map((s) => ({
			value: s.key,
			label: t(
				`metric.${s.key}.label` as 'metric.tasks_completed_daily.label',
				{
					defaultValue: s.key,
				}
			),
		}));
		if (rows.length > 0) return rows;
		return [
			{
				value: DEFAULT_METRIC,
				label: t('metric.tasks_completed_daily.label'),
			},
			{
				value: 'alerts_opened_daily',
				label: t('metric.alerts_opened_daily.label'),
			},
			{
				value: 'ai_runs_started_daily',
				label: t('metric.ai_runs_started_daily.label'),
			},
		];
	}, [dashboard.analytics?.series, t]);

	const windowDaysValue = Math.min(
		90,
		Math.max(
			1,
			Math.trunc(
				widgetConfig.windowDays ?? dashboard.analytics?.window_days ?? 30
			)
		)
	);

	const windowDayOptions = React.useMemo(() => {
		const set = new Set<number>([...WINDOW_DAY_CHOICES, windowDaysValue]);
		return [...set]
			.sort((a, b) => a - b)
			.map((d) => ({
				value: String(d),
				label: t('overview.dashboard.chart.windowDaysOption', { days: d }),
			}));
	}, [t, windowDaysValue]);

	const exportPng = React.useCallback(async () => {
		const el = chartBoxRef.current;
		if (!el || pngBusy) return;
		setPngBusy(true);
		try {
			const mod = await import('html2canvas');
			const canvas = await mod.default(el, {
				backgroundColor:
					typeof window !== 'undefined' &&
					window.matchMedia?.('(prefers-color-scheme: dark)').matches
						? '#0f1218'
						: '#f8fafc',
				scale: 2,
				useCORS: true,
			});
			const a = document.createElement('a');
			a.download = `marketing-chart-${metric}-${windowDaysValue}d.png`;
			a.href = canvas.toDataURL('image/png');
			a.click();
		} catch {
			cabinetNotify.error(t('overview.dashboard.chart.exportPngFailed'));
		} finally {
			setPngBusy(false);
		}
	}, [metric, pngBusy, t, windowDaysValue]);

	const chartAriaLabel = t('overview.dashboard.chartAria', {
		metric: axisLabel,
		days: windowDaysValue,
		points: points.length,
		defaultValue: `Chart: ${axisLabel}, ${points.length} days of data, ${windowDaysValue} day window`,
	});

	if (!dashboard.analytics) {
		return (
			<div
				className={cn(
					'space-y-2 px-1',
					DESKTOP_TYPOGRAPHY.meta,
					MC_DASHBOARD_NO_DRAG_CLASS
				)}
			>
				<p className="m-0" role="status">
					{t('overview.dashboard.chart.analyticsNotLoaded')}
				</p>
				{refetchProjectDashboard ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={() => void refetchProjectDashboard()}
					>
						{t('overview.dashboard.chart.retryLoad')}
					</DesktopAppButton>
				) : null}
			</div>
		);
	}

	if (available.length === 0) {
		return (
			<div
				className={cn(
					'px-1',
					DESKTOP_TYPOGRAPHY.meta,
					MC_DASHBOARD_NO_DRAG_CLASS
				)}
				role="status"
			>
				<p className="m-0">
					{t('overview.dashboard.chart.analyticsNotLoaded')}
				</p>
				{refetchProjectDashboard ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="mt-2"
						onClick={() => void refetchProjectDashboard()}
					>
						{t('overview.dashboard.chart.retryLoad')}
					</DesktopAppButton>
				) : null}
			</div>
		);
	}

	if (points.length === 0) {
		return (
			<div
				className={cn(
					'space-y-2 px-1',
					DESKTOP_TYPOGRAPHY.meta,
					MC_DASHBOARD_NO_DRAG_CLASS
				)}
			>
				<p className="m-0 text-(--desktop-text-muted)" role="status">
					{t('overview.dashboard.chart.emptySeries')}
				</p>
				{refetchProjectDashboard ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={() => void refetchProjectDashboard()}
					>
						{t('overview.dashboard.chart.retryLoad')}
					</DesktopAppButton>
				) : null}
				{allowMarketingWrite && onPersistWidgetConfig ? (
					<div className="max-w-xs pt-1">
						<MarketingCabinetSelect
							size="compact"
							className="w-full"
							aria-label={t('overview.dashboard.chart.metricAria')}
							value={metric}
							options={metricOptions}
							onChange={(nextKey) => {
								void onPersistWidgetConfig({
									...(widget.widget_config as MarketingWidgetConfig),
									metric: nextKey,
								});
							}}
						/>
					</div>
				) : null}
			</div>
		);
	}

	const gridStroke = 'var(--desktop-border-subtle)';
	const axisTick = {
		fontSize: 10,
		fill: 'var(--desktop-text-muted)',
	} as const;

	const grid = (
		<>
			<CartesianGrid
				stroke={gridStroke}
				strokeDasharray="3 3"
				strokeOpacity={0.55}
			/>
			<XAxis
				dataKey="date"
				stroke={gridStroke}
				tick={axisTick}
				tickLine={{ stroke: gridStroke }}
				minTickGap={16}
				angle={-22}
				textAnchor="end"
				height={48}
			/>
			<YAxis
				stroke={gridStroke}
				tick={axisTick}
				tickLine={{ stroke: gridStroke }}
				width={32}
				allowDecimals={false}
			/>
			<Tooltip
				{...mcDashboardRechartsTooltipSharedProps}
				contentStyle={{
					fontSize: 12,
					backgroundColor: 'var(--desktop-surface-panel-strong)',
					border: '1px solid var(--desktop-border-subtle)',
					borderRadius: 'var(--desktop-radius)',
					color: 'var(--desktop-text-primary)',
				}}
				labelFormatter={(v) => String(v)}
				formatter={(v) => [v, axisLabel]}
			/>
			<Legend
				verticalAlign="top"
				height={28}
				wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
				formatter={() => axisLabel}
			/>
		</>
	);

	return (
		<div
			className={cn(
				'mc-dashboard-no-drag flex min-h-0 flex-1 flex-col',
				MC_DASHBOARD_NO_DRAG_CLASS
			)}
		>
			{allowMarketingWrite && onPersistWidgetConfig ? (
				<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
					<div className="min-w-48 max-w-xs flex-1">
						<MarketingCabinetSelect
							size="compact"
							className="w-full"
							aria-label={t('overview.dashboard.chart.metricAria')}
							value={metric}
							options={metricOptions}
							onChange={(nextKey) => {
								void onPersistWidgetConfig({
									...(widget.widget_config as MarketingWidgetConfig),
									metric: nextKey,
								});
							}}
						/>
					</div>
					<div className="min-w-32 max-w-40">
						<MarketingCabinetSelect
							size="compact"
							className="w-full"
							aria-label={t('overview.dashboard.chart.windowDaysAria')}
							value={String(windowDaysValue)}
							options={windowDayOptions}
							onChange={(v) => {
								const days = Number.parseInt(v, 10);
								if (!Number.isFinite(days)) return;
								const next: MarketingWidgetConfig = {
									...(widget.widget_config as MarketingWidgetConfig),
									windowDays: Math.min(90, Math.max(1, days)),
								};
								void onPersistWidgetConfig(next);
							}}
						/>
					</div>
				</div>
			) : null}
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<p className={cn('m-0 flex-1', DESKTOP_APP_STYLE_CONTRACT.helperText)}>
					{t('overview.dashboard.chart.windowHint', {
						days: dashboard.analytics.window_days,
					})}
				</p>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					disabled={pngBusy}
					aria-label={t('overview.dashboard.chart.exportPngAria')}
					onClick={() => void exportPng()}
				>
					{t('overview.dashboard.chart.exportPng')}
				</DesktopAppButton>
			</div>
			<div
				ref={chartBoxRef}
				role="img"
				aria-label={chartAriaLabel}
				className="relative z-15 isolate min-h-[200px] w-full flex-1 rounded-(--desktop-radius) bg-(--desktop-surface-soft)/25 p-1"
			>
				<ResponsiveContainer width="100%" height="100%" minHeight={220}>
					{chartKind === 'area' ? (
						<AreaChart
							data={points}
							margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
						>
							{grid}
							<Area
								type="monotone"
								dataKey="value"
								name={axisLabel}
								stroke={stroke}
								fill={stroke}
								fillOpacity={0.12}
								strokeWidth={2}
								isAnimationActive={animationDuration > 0}
								animationDuration={animationDuration}
							/>
						</AreaChart>
					) : (
						<LineChart
							data={points}
							margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
						>
							{grid}
							<Line
								type="monotone"
								dataKey="value"
								name={axisLabel}
								stroke={stroke}
								strokeWidth={2}
								dot={false}
								isAnimationActive={animationDuration > 0}
								animationDuration={animationDuration}
							/>
						</LineChart>
					)}
				</ResponsiveContainer>
			</div>
		</div>
	);
}

export const ChartMetricWidget = React.memo(ChartMetricWidgetImpl);
