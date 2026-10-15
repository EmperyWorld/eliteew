/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Analytics view: 24h KPIs, type breakdown chart/table, error distribution.
 *
 * Invariants:
 * - User-scoped GET /api/v1/ugs/analytics; labels from types catalog when available.
 *
 * Related:
 * - pages/Desktop/components/UGSDesktopContainer.tsx
 * - components/UGS/workspace/ugsAnalyticsData.ts
 */

import {
	UgsHubSectionHeading,
	ugsHubInsetRowClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '@/components/UGS/hub/ugsHubSharedUi';
import { UgsMetricCard } from '@/components/UGS/workspace/UgsMetricCard';
import { UgsWorkspaceLoading } from '@/components/UGS/workspace/UgsWorkspaceLoading';
import { UgsWorkspaceShell } from '@/components/UGS/workspace/UgsWorkspaceShell';
import {
	buildStackedChartRows,
	buildTypeBreakdownRows,
	formatSuccessRatePercent,
	parseErrorDistribution,
} from '@/components/UGS/workspace/ugsAnalyticsData';
import { EmptyStateBlock } from '@/components/ui/EmptyStateBlock';
import { RetryBlock } from '@/components/ui/RetryBlock';
import {
	UGS_DESKTOP_TABLE,
	UGS_WORKSPACE_SEMANTIC,
	ugsDesktopChartGridStroke,
	ugsDesktopChartTooltipStyle,
} from '@/features/ugs/shared/ugsDesktopUi';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import {
	fetchUgsAnalytics,
	type UGSAnalyticsSummary,
} from '@/services/api/ugs/dashboard';
import { ugsTypesQueryOptions } from '@/services/api/ugsQueryOptions';
import { cn } from '@/utils/cn';
import { parseServerUtcIsoMs } from '@/utils/parseServerUtcIso';
import {
	ArrowTrendingUpIcon,
	ChartBarSquareIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationCircleIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
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

import type { NavigationHandler } from '../types/navigation';

const ERROR_CHART_COLORS = [
	'rgb(244 63 94 / 0.85)',
	'rgb(251 146 60 / 0.85)',
	'rgb(250 204 21 / 0.85)',
	'rgb(148 163 184 / 0.85)',
];

interface UGSAnalyticsProps {
	onNavigate?: NavigationHandler;
}

function formatErrorTimestamp(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) {
		return '—';
	}
	const ms = parseServerUtcIsoMs(value);
	if (ms == null) {
		return value;
	}
	return new Date(ms).toLocaleString();
}

const UGSAnalytics: React.FC<UGSAnalyticsProps> = ({
	onNavigate: _onNavigate,
}) => {
	const { t } = useTranslation('ugsAnalytics');
	const theme = useDesktopShellTheme();
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	const analyticsQuery = useQuery<UGSAnalyticsSummary | null, Error>({
		queryKey: ['ugs', 'analytics'] as const,
		queryFn: async () => {
			const data = await fetchUgsAnalytics();
			setLastUpdated(new Date());
			return data;
		},
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	});

	const typesQuery = useQuery(ugsTypesQueryOptions());

	const displayNameByKey = useMemo(() => {
		const map = new Map<string, string>();
		for (const type of typesQuery.data ?? []) {
			const label = type.display_name?.trim();
			if (label) {
				map.set(type.type_key, label);
			}
		}
		return map;
	}, [typesQuery.data]);

	const analytics = analyticsQuery.data;
	const totals = analytics?.totals;
	const breakdownRows = useMemo(
		() => buildTypeBreakdownRows(analytics?.by_type ?? [], displayNameByKey),
		[analytics?.by_type, displayNameByKey]
	);
	const chartRows = useMemo(
		() => buildStackedChartRows(breakdownRows),
		[breakdownRows]
	);
	const errorDistribution = useMemo(
		() => parseErrorDistribution(analytics?.error_distribution ?? []),
		[analytics?.error_distribution]
	);
	const recentErrors = analytics?.recent_errors ?? [];

	const hasData =
		(totals?.total_generations ?? 0) > 0 || breakdownRows.length > 0;

	const handleRefresh = useCallback(() => {
		void analyticsQuery.refetch();
	}, [analyticsQuery]);

	const kpiCards: Array<{
		key: string;
		label: string;
		value: string | number;
		icon: typeof ChartBarSquareIcon;
		accent?: 'default' | 'success' | 'warning' | 'danger';
	}> = [
		{
			key: 'total',
			label: t('kpi.total'),
			value: totals?.total_generations ?? 0,
			icon: ChartBarSquareIcon,
		},
		{
			key: 'successful',
			label: t('kpi.successful'),
			value: totals?.successful ?? 0,
			icon: CheckCircleIcon,
			accent: 'success',
		},
		{
			key: 'failed',
			label: t('kpi.failed'),
			value: totals?.failed ?? 0,
			icon: XCircleIcon,
			accent: (totals?.failed ?? 0) > 0 ? 'danger' : 'default',
		},
		{
			key: 'cancelled',
			label: t('kpi.cancelled'),
			value: totals?.cancelled ?? 0,
			icon: ExclamationCircleIcon,
		},
		{
			key: 'successRate',
			label: t('kpi.successRate'),
			value: formatSuccessRatePercent(analytics?.success_rate),
			icon: ArrowTrendingUpIcon,
			accent:
				(analytics?.success_rate ?? 0) >= 0.9
					? 'success'
					: (analytics?.success_rate ?? 1) < 0.7
						? 'danger'
						: 'warning',
		},
		{
			key: 'avgDuration',
			label: t('kpi.avgDuration'),
			value:
				analytics?.avg_duration_ms != null && analytics.avg_duration_ms > 0
					? `${(analytics.avg_duration_ms / 1000).toFixed(1)} с`
					: '—',
			icon: ClockIcon,
		},
	];

	const tooltipStyle = ugsDesktopChartTooltipStyle(theme);
	const gridStroke = ugsDesktopChartGridStroke(theme);

	return (
		<UgsWorkspaceShell
			title={t('title')}
			subtitle={t('subtitle')}
			isFetching={analyticsQuery.isFetching}
			lastUpdated={lastUpdated}
			onRefresh={handleRefresh}
			data-testid="ugs-analytics-root"
		>
			{analyticsQuery.isLoading ? (
				<UgsWorkspaceLoading theme={theme} kpiCount={6} />
			) : null}

			{analyticsQuery.isError ? (
				<RetryBlock
					message={
						analyticsQuery.error instanceof Error
							? analyticsQuery.error.message
							: t('error')
					}
					onRetry={handleRefresh}
					retryLabel={t('retry')}
				/>
			) : null}

			{!analyticsQuery.isLoading && !analyticsQuery.isError && !hasData ? (
				<EmptyStateBlock
					icon={<ChartBarSquareIcon className="h-8 w-8 opacity-50" />}
					title={t('empty.title')}
					description={t('empty.description')}
				/>
			) : null}

			{!analyticsQuery.isLoading && !analyticsQuery.isError && hasData ? (
				<>
					<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						{kpiCards.map((card) => (
							<UgsMetricCard
								key={card.key}
								theme={theme}
								label={card.label}
								value={card.value}
								icon={card.icon}
								accent={card.accent}
							/>
						))}
					</section>

					<div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
						{chartRows.length > 0 ? (
							<section className={cn(ugsHubPanelClasses(theme), 'p-4')}>
								<UgsHubSectionHeading
									eyebrow="24h"
									title={t('charts.byTypeTitle')}
								/>
								<p className={cn('mt-1 text-xs', ugsHubTextMuted(theme))}>
									{t('charts.byTypeSubtitle')}
								</p>
								<div className="mt-4 h-[min(420px,50vh)] min-h-[280px] w-full">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											data={chartRows}
											layout="vertical"
											margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												stroke={gridStroke}
												horizontal={false}
											/>
											<XAxis
												type="number"
												allowDecimals={false}
												tick={{ fontSize: 11 }}
											/>
											<YAxis
												type="category"
												dataKey="label"
												width={140}
												tick={{ fontSize: 11 }}
											/>
											<Tooltip contentStyle={tooltipStyle} />
											<Legend />
											<Bar
												dataKey="successful"
												stackId="a"
												fill="rgb(52 211 153 / 0.85)"
												name={t('charts.successful')}
												radius={[0, 0, 0, 0]}
											/>
											<Bar
												dataKey="failed"
												stackId="a"
												fill="rgb(244 63 94 / 0.85)"
												name={t('charts.failed')}
												radius={[0, 4, 4, 0]}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</section>
						) : null}

						{errorDistribution.length > 0 ? (
							<section className={cn(ugsHubPanelClasses(theme), 'p-4')}>
								<UgsHubSectionHeading
									eyebrow="24h"
									title={t('charts.errorsTitle')}
								/>
								<p className={cn('mt-1 text-xs', ugsHubTextMuted(theme))}>
									{t('charts.errorsSubtitle')}
								</p>
								<div className="mt-4 h-[min(420px,50vh)] min-h-[240px]">
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie
												data={errorDistribution}
												dataKey="count"
												nameKey="errorType"
												cx="50%"
												cy="50%"
												innerRadius={52}
												outerRadius={88}
												paddingAngle={2}
											>
												{errorDistribution.map((entry, index) => (
													<Cell
														key={entry.errorType}
														fill={
															ERROR_CHART_COLORS[
																index % ERROR_CHART_COLORS.length
															]
														}
													/>
												))}
											</Pie>
											<Tooltip contentStyle={tooltipStyle} />
										</PieChart>
									</ResponsiveContainer>
								</div>
								<ul className="mt-3 space-y-1 text-xs">
									{errorDistribution.map((row) => (
										<li
											key={row.errorType}
											className={cn(
												'flex justify-between gap-2',
												ugsHubTextSecondary(theme)
											)}
										>
											<span className="truncate">{row.errorType}</span>
											<span className="tabular-nums">{row.count}</span>
										</li>
									))}
								</ul>
							</section>
						) : null}
					</div>

					{breakdownRows.length > 0 ? (
						<section
							className={cn(ugsHubPanelClasses(theme), 'overflow-hidden p-0')}
						>
							<div className="border-b border-(--desktop-border-subtle) px-4 py-4">
								<UgsHubSectionHeading eyebrow="24h" title={t('table.title')} />
							</div>
							<div className="overflow-x-auto">
								<table className="min-w-full text-left text-sm">
									<thead className={UGS_DESKTOP_TABLE.head}>
										<tr>
											<th className={UGS_DESKTOP_TABLE.cell}>
												{t('table.type')}
											</th>
											<th className={UGS_DESKTOP_TABLE.cell}>
												{t('table.total')}
											</th>
											<th className={UGS_DESKTOP_TABLE.cell}>
												{t('table.successful')}
											</th>
											<th className={UGS_DESKTOP_TABLE.cell}>
												{t('table.failed')}
											</th>
											<th className={UGS_DESKTOP_TABLE.cell}>
												{t('table.successRate')}
											</th>
										</tr>
									</thead>
									<tbody>
										{breakdownRows.map((row) => (
											<tr key={row.typeKey} className={UGS_DESKTOP_TABLE.row}>
												<td className={UGS_DESKTOP_TABLE.cellStrong}>
													<div className="font-medium">{row.label}</div>
													<div
														className={cn(
															'text-xs font-normal',
															ugsHubTextMuted(theme)
														)}
													>
														{row.typeKey}
													</div>
												</td>
												<td
													className={cn(UGS_DESKTOP_TABLE.cell, 'tabular-nums')}
												>
													{row.total}
												</td>
												<td
													className={cn(
														UGS_DESKTOP_TABLE.cell,
														'tabular-nums',
														UGS_WORKSPACE_SEMANTIC.success
													)}
												>
													{row.successful}
												</td>
												<td
													className={cn(
														UGS_DESKTOP_TABLE.cell,
														'tabular-nums',
														UGS_WORKSPACE_SEMANTIC.danger
													)}
												>
													{row.failed}
												</td>
												<td
													className={cn(UGS_DESKTOP_TABLE.cell, 'tabular-nums')}
												>
													{formatSuccessRatePercent(row.successRate)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					<section className={cn(ugsHubPanelClasses(theme), 'p-4')}>
						<UgsHubSectionHeading
							eyebrow="24h"
							title={t('recentErrors.title')}
							count={recentErrors.length}
						/>
						{recentErrors.length === 0 ? (
							<p className={cn('mt-3 text-sm', ugsHubTextSecondary(theme))}>
								{t('recentErrors.empty')}
							</p>
						) : (
							<ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
								{recentErrors.slice(0, 20).map((err) => (
									<li
										key={`${String(err.timestamp ?? '')}-${String(err.type_key ?? '')}-${String(err.error_message ?? '')}`}
										className={cn(
											ugsHubInsetRowClasses(theme),
											'flex-col items-stretch gap-1'
										)}
									>
										<div className={cn('text-xs', ugsHubTextMuted(theme))}>
											{displayNameByKey.get(String(err.type_key ?? '')) ??
												String(err.type_key ?? '—')}{' '}
											· {String(err.error_type ?? 'error')}
										</div>
										{err.error_message ? (
											<p
												className={cn(
													'mt-1 line-clamp-2',
													ugsHubTextPrimary(theme)
												)}
												title={String(err.error_message)}
											>
												{String(err.error_message)}
											</p>
										) : null}
										<p className={cn('mt-1 text-xs', ugsHubTextMuted(theme))}>
											{formatErrorTimestamp(err.timestamp)}
										</p>
									</li>
								))}
							</ul>
						)}
						{recentErrors.length > 20 ? (
							<p className={cn('mt-2 text-xs', ugsHubTextMuted(theme))}>
								{t('recentErrors.more', {
									shown: 20,
									total: recentErrors.length,
								})}
							</p>
						) : null}
					</section>
				</>
			) : null}
		</UgsWorkspaceShell>
	);
};

export default UGSAnalytics;
