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
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
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
	MarketingChartMetricsBarChartFormat,
	MarketingChartMetricsBarWidgetConfig,
	MarketingWidgetConfig,
} from '../types';

const WINDOW_DAY_CHOICES = [7, 14, 21, 30, 45, 60, 90] as const;

const BAR_FILL =
	'var(--mc-dashboard-chart-line, rgb(var(--desktop-accent-rgb) / 0.85))';

const PIE_SEGMENT_FILLS = Array.from(
	{ length: 12 },
	(_, i) =>
		`rgb(var(--desktop-accent-rgb) / ${Math.max(0.34, 0.9 - i * 0.048)})`
);

function ChartMetricsBarWidgetImpl(
	props: MarketingDashboardWidgetBodyProps & {
		widgetConfig: MarketingChartMetricsBarWidgetConfig;
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

	const aggregation =
		widgetConfig.aggregation === 'last' ? 'last' : ('sum' as const);

	const chartFormat: MarketingChartMetricsBarChartFormat =
		widgetConfig.chartFormat === 'bar_vertical' ||
		widgetConfig.chartFormat === 'donut'
			? widgetConfig.chartFormat
			: 'bar_horizontal';

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

	const aggregationOptions = React.useMemo((): {
		value: 'sum' | 'last';
		label: string;
	}[] => {
		return [
			{
				value: 'sum',
				label: t('overview.dashboard.barChart.aggregationSum'),
			},
			{
				value: 'last',
				label: t('overview.dashboard.barChart.aggregationLast'),
			},
		];
	}, [t]);

	const chartFormatOptions = React.useMemo((): {
		value: MarketingChartMetricsBarChartFormat;
		label: string;
	}[] => {
		return [
			{
				value: 'bar_horizontal',
				label: t('overview.dashboard.barChart.formatHorizontal'),
			},
			{
				value: 'bar_vertical',
				label: t('overview.dashboard.barChart.formatVertical'),
			},
			{ value: 'donut', label: t('overview.dashboard.barChart.formatDonut') },
		];
	}, [t]);

	const seriesRows = React.useMemo(() => {
		const series = dashboard.analytics?.series ?? [];
		return series.map((s) => {
			const pts = s.points ?? [];
			let v = 0;
			if (aggregation === 'sum') {
				v = pts.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
			} else if (pts.length > 0) {
				v = Number(pts[pts.length - 1]?.value) || 0;
			}
			const label = t(
				`metric.${s.key}.label` as 'metric.tasks_completed_daily.label',
				{
					defaultValue: s.key,
				}
			);
			return { key: s.key, name: label, value: v };
		});
	}, [aggregation, dashboard.analytics?.series, t]);

	const allKeysOrdered = React.useMemo(
		() => seriesRows.map((r) => r.key),
		[seriesRows]
	);

	const effectiveKeySet = React.useMemo(() => {
		const stored = widgetConfig.metricKeys?.filter((k) =>
			allKeysOrdered.includes(k)
		);
		if (!stored?.length) {
			return null;
		}
		return new Set(stored);
	}, [allKeysOrdered, widgetConfig.metricKeys]);

	const barData = React.useMemo(() => {
		let rows = seriesRows;
		if (effectiveKeySet) {
			rows = rows.filter((r) => effectiveKeySet.has(r.key));
		}
		return [...rows].sort((a, b) => b.value - a.value);
	}, [effectiveKeySet, seriesRows]);

	const persistMetricSubset = React.useCallback(
		(nextKeys: string[] | undefined) => {
			if (!onPersistWidgetConfig) return;
			const base = { ...(widget.widget_config as MarketingWidgetConfig) };
			if (!nextKeys?.length || nextKeys.length >= allKeysOrdered.length) {
				delete base.metricKeys;
			} else {
				base.metricKeys = nextKeys;
			}
			void onPersistWidgetConfig(base);
		},
		[allKeysOrdered.length, onPersistWidgetConfig, widget.widget_config]
	);

	const onToggleMetricKey = React.useCallback(
		(key: string) => {
			if (!allowMarketingWrite || !onPersistWidgetConfig) return;
			const stored = widgetConfig.metricKeys?.filter((k) =>
				allKeysOrdered.includes(k)
			);
			const implicitAll = !stored?.length;

			if (implicitAll) {
				const next = allKeysOrdered.filter((k) => k !== key);
				if (!next.length) {
					persistMetricSubset(undefined);
					return;
				}
				persistMetricSubset(next);
				return;
			}

			const set = new Set(stored);
			if (set.has(key)) {
				set.delete(key);
			} else {
				set.add(key);
			}
			const next = allKeysOrdered.filter((k) => set.has(k));
			if (!next.length || next.length >= allKeysOrdered.length) {
				persistMetricSubset(undefined);
				return;
			}
			persistMetricSubset(next);
		},
		[
			allowMarketingWrite,
			allKeysOrdered,
			onPersistWidgetConfig,
			persistMetricSubset,
			widgetConfig.metricKeys,
		]
	);

	const metricCheckboxChecked = React.useCallback(
		(key: string) => {
			const stored = widgetConfig.metricKeys?.filter((k) =>
				allKeysOrdered.includes(k)
			);
			if (!stored?.length) {
				return true;
			}
			return stored.includes(key);
		},
		[allKeysOrdered, widgetConfig.metricKeys]
	);

	const animationDuration = reduceMotion ? 0 : 400;

	const formatLabelForAria = React.useMemo(() => {
		const opt = chartFormatOptions.find((o) => o.value === chartFormat);
		return opt?.label ?? chartFormat;
	}, [chartFormat, chartFormatOptions]);

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
			a.download = `marketing-metrics-${chartFormat}-${aggregation}-${windowDaysValue}d.png`;
			a.href = canvas.toDataURL('image/png');
			a.click();
		} catch {
			cabinetNotify.error(t('overview.dashboard.chart.exportPngFailed'));
		} finally {
			setPngBusy(false);
		}
	}, [aggregation, chartFormat, pngBusy, t, windowDaysValue]);

	const chartAriaLabel = t('overview.dashboard.barChart.chartAria', {
		format: formatLabelForAria,
		aggregation:
			aggregation === 'sum'
				? t('overview.dashboard.barChart.aggregationSum')
				: t('overview.dashboard.barChart.aggregationLast'),
		days: windowDaysValue,
		count: barData.length,
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

	const available = dashboard.analytics.series ?? [];
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

	const gridStroke = 'var(--desktop-border-subtle)';
	const axisTick = {
		fontSize: 10,
		fill: 'var(--desktop-text-muted)',
	} as const;

	const metricsReadout = !widgetConfig.metricKeys?.length ? (
		<span>{t('overview.dashboard.barChart.metricsAll')}</span>
	) : (
		<span>
			{t('overview.dashboard.barChart.metricsSelectedCount', {
				count: barData.length,
			})}
		</span>
	);

	return (
		<div
			className={cn(
				'mc-dashboard-no-drag flex min-h-0 flex-1 flex-col',
				MC_DASHBOARD_NO_DRAG_CLASS
			)}
		>
			{allowMarketingWrite && onPersistWidgetConfig ? (
				<div className="mb-2 flex flex-col gap-2">
					<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
						<div className="min-w-40 max-w-xs flex-1">
							<MarketingCabinetSelect
								size="compact"
								className="w-full"
								aria-label={t('overview.dashboard.barChart.formatAria')}
								value={chartFormat}
								options={chartFormatOptions}
								onChange={(v) => {
									if (
										v !== 'bar_horizontal' &&
										v !== 'bar_vertical' &&
										v !== 'donut'
									) {
										return;
									}
									void onPersistWidgetConfig({
										...(widget.widget_config as MarketingWidgetConfig),
										chartFormat: v,
									});
								}}
							/>
						</div>
						<div className="min-w-40 max-w-xs flex-1">
							<MarketingCabinetSelect
								size="compact"
								className="w-full"
								aria-label={t('overview.dashboard.barChart.aggregationAria')}
								value={aggregation}
								options={aggregationOptions}
								onChange={(v) => {
									if (v !== 'sum' && v !== 'last') return;
									void onPersistWidgetConfig({
										...(widget.widget_config as MarketingWidgetConfig),
										aggregation: v,
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
					<fieldset
						className={cn(
							'm-0 min-w-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-2',
							MC_DASHBOARD_NO_DRAG_CLASS
						)}
					>
						<legend
							className={cn(
								'px-1',
								DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
								DESKTOP_TYPOGRAPHY.meta
							)}
						>
							{t('overview.dashboard.barChart.metricsGroup')}
						</legend>
						<p
							className={cn('mb-2 mt-0', DESKTOP_APP_STYLE_CONTRACT.helperText)}
						>
							{t('overview.dashboard.barChart.metricsHint')}
						</p>
						<div className="max-h-32 min-h-0 overflow-y-auto pr-1">
							<ul className="m-0 list-none space-y-1.5 p-0">
								{seriesRows.map((row) => {
									const id = `mc-bar-metric-${widget.id}-${row.key}`;
									return (
										<li key={row.key}>
											<label
												htmlFor={id}
												className={cn(
													'flex cursor-pointer items-start gap-2',
													DESKTOP_TYPOGRAPHY.meta
												)}
											>
												<input
													id={id}
													type="checkbox"
													className="mc-dashboard-no-drag mt-0.5 shrink-0"
													checked={metricCheckboxChecked(row.key)}
													onChange={() => onToggleMetricKey(row.key)}
												/>
												<span className="min-w-0 wrap-break-word">
													{row.name}
												</span>
											</label>
										</li>
									);
								})}
							</ul>
						</div>
						<div className="mt-2 flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => persistMetricSubset(undefined)}
							>
								{t('overview.dashboard.barChart.selectAllMetrics')}
							</DesktopAppButton>
						</div>
					</fieldset>
				</div>
			) : (
				<p className={cn('mb-2 mt-0', DESKTOP_APP_STYLE_CONTRACT.helperText)}>
					{metricsReadout}
				</p>
			)}
			<p className={cn('mb-2 mt-0', DESKTOP_APP_STYLE_CONTRACT.helperText)}>
				{t('overview.dashboard.barChart.summaryHint', {
					mode:
						aggregation === 'sum'
							? t('overview.dashboard.barChart.aggregationSum')
							: t('overview.dashboard.barChart.aggregationLast'),
				})}
			</p>
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
					{chartFormat === 'donut' ? (
						<PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
							<Pie
								data={barData}
								dataKey="value"
								nameKey="name"
								cx="50%"
								cy="46%"
								innerRadius="40%"
								outerRadius="68%"
								paddingAngle={2}
								isAnimationActive={animationDuration > 0}
								animationDuration={animationDuration}
							>
								{barData.map((row, i) => (
									<Cell
										key={`cell-${row.key}`}
										fill={PIE_SEGMENT_FILLS[i % PIE_SEGMENT_FILLS.length]}
									/>
								))}
							</Pie>
							<Tooltip
								{...mcDashboardRechartsTooltipSharedProps}
								contentStyle={{
									fontSize: 12,
									backgroundColor: 'var(--desktop-surface-panel-strong)',
									border: '1px solid var(--desktop-border-subtle)',
									borderRadius: 'var(--desktop-radius)',
									color: 'var(--desktop-text-primary)',
								}}
								formatter={(v) => [
									v,
									t('overview.dashboard.barChart.valueLabel'),
								]}
							/>
							<Legend
								layout="horizontal"
								verticalAlign="bottom"
								align="center"
								wrapperStyle={{
									fontSize: 10,
									paddingTop: 4,
									lineHeight: 1.2,
								}}
							/>
						</PieChart>
					) : chartFormat === 'bar_vertical' ? (
						<BarChart
							data={barData}
							margin={{ top: 8, right: 8, bottom: 28, left: 8 }}
						>
							<CartesianGrid
								stroke={gridStroke}
								strokeDasharray="3 3"
								strokeOpacity={0.55}
							/>
							<XAxis
								dataKey="name"
								type="category"
								stroke={gridStroke}
								tick={axisTick}
								tickLine={{ stroke: gridStroke }}
								interval={0}
								angle={-28}
								textAnchor="end"
								height={56}
							/>
							<YAxis
								type="number"
								stroke={gridStroke}
								tick={axisTick}
								tickLine={{ stroke: gridStroke }}
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
								formatter={(v) => [
									v,
									t('overview.dashboard.barChart.valueLabel'),
								]}
							/>
							<Bar
								dataKey="value"
								name={t('overview.dashboard.barChart.valueLabel')}
								fill={BAR_FILL}
								radius={[4, 4, 0, 0]}
								isAnimationActive={animationDuration > 0}
								animationDuration={animationDuration}
							/>
						</BarChart>
					) : (
						<BarChart
							data={barData}
							layout="vertical"
							margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
						>
							<CartesianGrid
								stroke={gridStroke}
								strokeDasharray="3 3"
								strokeOpacity={0.55}
								horizontal
								vertical
							/>
							<XAxis
								type="number"
								stroke={gridStroke}
								tick={axisTick}
								tickLine={{ stroke: gridStroke }}
							/>
							<YAxis
								type="category"
								dataKey="name"
								stroke={gridStroke}
								tick={axisTick}
								tickLine={{ stroke: gridStroke }}
								width={112}
								interval={0}
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
								formatter={(v) => [
									v,
									t('overview.dashboard.barChart.valueLabel'),
								]}
							/>
							<Bar
								dataKey="value"
								name={t('overview.dashboard.barChart.valueLabel')}
								fill={BAR_FILL}
								radius={[0, 4, 4, 0]}
								isAnimationActive={animationDuration > 0}
								animationDuration={animationDuration}
							/>
						</BarChart>
					)}
				</ResponsiveContainer>
			</div>
		</div>
	);
}

export const ChartMetricsBarWidget = React.memo(ChartMetricsBarWidgetImpl);
