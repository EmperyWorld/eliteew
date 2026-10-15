/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketer-facing performance panel for spend, revenue, ROI/ROMI, CPA/CPL, cohorts, charts, and campaign table.
 *
 * Invariants:
 * - Filters update the analytics query only; the Marketing Cabinet shell must not reload.
 * - Empty datasets are valid and rendered as an actionable empty state, not as an error.
 * - Recharts mounts only inside {@link MarketingPerformanceChartFrame} after layout size is known.
 *
 * Related:
 * - ../hooks/useMarketingPerformanceDashboard.ts
 * - ../marketingPerformanceDashboard.ts
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppErrorState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useMarketingPerformanceDashboard } from '../hooks/useMarketingPerformanceDashboard';
import {
	formatMarketingMoney,
	formatMarketingPercent,
	formatMarketingRatio,
	type MarketingPerformanceCampaign,
} from '../marketingPerformanceDashboard';
import { MarketingPerformanceChartFrame } from './MarketingPerformanceChartFrame';
import { MetricCard } from './MetricCard';

type CampaignSortKey = 'revenue' | 'spend' | 'leads' | 'conversions' | 'romi';

function splitDimensionInput(value: string): string[] {
	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

function campaignSortValue(
	row: MarketingPerformanceCampaign,
	key: CampaignSortKey
): number {
	const value = row[key];
	return typeof value === 'number' ? value : Number.NEGATIVE_INFINITY;
}

export function MarketingPerformanceDashboardPanel({
	projectId,
}: {
	projectId: string;
}) {
	const { t } = useTranslation('marketing');
	const [windowDays, setWindowDays] = useState(30);
	const [sourceText, setSourceText] = useState('');
	const [geoText, setGeoText] = useState('');
	const [sortKey, setSortKey] = useState<CampaignSortKey>('revenue');
	const [sortDesc, setSortDesc] = useState(true);
	const filters = useMemo(
		() => ({
			windowDays,
			sources: splitDimensionInput(sourceText),
			geos: splitDimensionInput(geoText),
		}),
		[geoText, sourceText, windowDays]
	);
	const query = useMarketingPerformanceDashboard({
		selectedProjectId: projectId,
		filters,
	});
	const data = query.data;
	const totals = data?.totals;
	const diagnostics = Array.isArray(data?.diagnostics) ? data.diagnostics : [];
	const series = Array.isArray(data?.series) ? data.series : [];
	const sortedCampaigns = useMemo(() => {
		const rows = [...(Array.isArray(data?.campaigns) ? data.campaigns : [])];
		return rows.sort((a, b) => {
			const delta =
				campaignSortValue(a, sortKey) - campaignSortValue(b, sortKey);
			return sortDesc ? -delta : delta;
		});
	}, [data?.campaigns, sortDesc, sortKey]);
	const hasFacts =
		(totals?.spend ?? 0) > 0 ||
		(totals?.revenue ?? 0) > 0 ||
		(totals?.leads ?? 0) > 0 ||
		(totals?.conversions ?? 0) > 0;

	const setSort = (key: CampaignSortKey) => {
		if (key === sortKey) {
			setSortDesc((current) => !current);
			return;
		}
		setSortKey(key);
		setSortDesc(true);
	};

	return (
		<DesktopAppSurface variant="soft" className="min-w-0 space-y-4 p-4">
			<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<DesktopAppSectionLabel className="mb-1">
						{t('overview.performance.title', {
							defaultValue: 'Marketing performance',
						})}
					</DesktopAppSectionLabel>
					<p
						className={cn(DESKTOP_TYPOGRAPHY.meta, 'max-w-3xl leading-relaxed')}
					>
						{t('overview.performance.description', {
							defaultValue:
								'Answers the daily marketing questions: how much was spent, how much was earned, and which campaign performs best.',
						})}
					</p>
				</div>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => void query.refetch()}
					disabled={query.isFetching}
				>
					{query.isFetching
						? t('overview.performance.refreshing', {
								defaultValue: 'Refreshing...',
							})
						: t('overview.performance.refresh', { defaultValue: 'Refresh' })}
				</DesktopAppButton>
			</div>

			<div className="grid min-w-0 gap-3 md:grid-cols-[10rem_1fr_1fr]">
				<label className="grid gap-1 text-xs font-medium text-(--desktop-text-secondary)">
					{t('overview.performance.window', { defaultValue: 'Window' })}
					<select
						value={windowDays}
						onChange={(event) => setWindowDays(Number(event.target.value))}
						className={cn(
							DESKTOP_INTERACTIVE.inputFocus,
							'min-h-9 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-3 py-2 text-sm text-(--desktop-text-primary)'
						)}
					>
						<option value={7}>
							{t('overview.performance.windowDays7', {
								defaultValue: '7 days',
							})}
						</option>
						<option value={30}>
							{t('overview.performance.windowDays30', {
								defaultValue: '30 days',
							})}
						</option>
						<option value={90}>
							{t('overview.performance.windowDays90', {
								defaultValue: '90 days',
							})}
						</option>
					</select>
				</label>
				<label className="grid gap-1 text-xs font-medium text-(--desktop-text-secondary)">
					{t('overview.performance.sources', {
						defaultValue: 'Traffic sources',
					})}
					<input
						value={sourceText}
						onChange={(event) => setSourceText(event.target.value)}
						placeholder={t('overview.performance.sourcesPlaceholder', {
							defaultValue: 'paid, organic, email',
						})}
						className={cn(
							DESKTOP_INTERACTIVE.inputFocus,
							'min-h-9 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-3 py-2 text-sm text-(--desktop-text-primary)'
						)}
					/>
				</label>
				<label className="grid gap-1 text-xs font-medium text-(--desktop-text-secondary)">
					{t('overview.performance.geos', { defaultValue: 'Geo' })}
					<input
						value={geoText}
						onChange={(event) => setGeoText(event.target.value)}
						placeholder={t('overview.performance.geosPlaceholder', {
							defaultValue: 'EU, US, APAC',
						})}
						className={cn(
							DESKTOP_INTERACTIVE.inputFocus,
							'min-h-9 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-3 py-2 text-sm text-(--desktop-text-primary)'
						)}
					/>
				</label>
			</div>

			{query.isError ? (
				<DesktopAppErrorState
					message={t('overview.performance.loadError', {
						defaultValue: 'Could not load performance analytics.',
					})}
					onAction={() => void query.refetch()}
				/>
			) : null}

			{diagnostics.length ? (
				<ul className="space-y-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 px-3 py-2 text-xs leading-5 text-(--desktop-text-secondary)">
					{diagnostics.map((diagnostic) => (
						<li key={`${diagnostic.code}-${diagnostic.message}`}>
							<span className="font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
								{diagnostic.severity}
							</span>{' '}
							{t(`overview.performance.diagnostics.${diagnostic.code}`, {
								defaultValue: diagnostic.message,
							})}
						</li>
					))}
				</ul>
			) : null}

			<div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					label={t('overview.performance.spend', { defaultValue: 'Spend' })}
					value={formatMarketingMoney(totals?.spend)}
					metricKind={t('overview.performance.money', {
						defaultValue: 'money',
					})}
					hint={t('overview.performance.spendHint', {
						defaultValue: 'Actual spend from normalized performance facts.',
					})}
				/>
				<MetricCard
					label={t('overview.performance.revenue', { defaultValue: 'Revenue' })}
					value={formatMarketingMoney(totals?.revenue)}
					metricKind={t('overview.performance.money', {
						defaultValue: 'money',
					})}
					hint={t('overview.performance.revenueHint', {
						defaultValue: 'Attributed revenue in the selected window.',
					})}
					tone={
						(totals?.revenue ?? 0) >= (totals?.spend ?? 0)
							? 'accent'
							: 'default'
					}
				/>
				<MetricCard
					label={t('overview.performance.romi', { defaultValue: 'ROMI' })}
					value={formatMarketingPercent(totals?.romi)}
					metricKind={t('overview.performance.return', {
						defaultValue: 'return',
					})}
					hint={t('overview.performance.romiHint', {
						defaultValue: '(Revenue - spend) / spend, shown as percent.',
					})}
				/>
				<MetricCard
					label={t('overview.performance.cpaCpl', {
						defaultValue: 'CPA / CPL',
					})}
					value={`${formatMarketingMoney(totals?.cpa)} / ${formatMarketingMoney(totals?.cpl)}`}
					metricKind={t('overview.performance.efficiency', {
						defaultValue: 'efficiency',
					})}
					hint={t('overview.performance.cpaCplHint', {
						defaultValue: 'Cost per conversion and cost per lead.',
					})}
				/>
			</div>

			<div className="grid min-w-0 gap-4 xl:grid-cols-2">
				<DesktopAppSurface variant="soft" className="min-w-0 p-3">
					<div className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}>
						{t('overview.performance.spendRevenueChart', {
							defaultValue: 'Spend vs revenue',
						})}
					</div>
					<MarketingPerformanceChartFrame
						ariaLabel={t('overview.performance.spendRevenueChart', {
							defaultValue: 'Spend vs revenue',
						})}
					>
						<LineChart data={series}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" minTickGap={24} />
							<YAxis />
							<Tooltip />
							<Line
								type="monotone"
								dataKey="spend"
								stroke="currentColor"
								dot={false}
							/>
							<Line
								type="monotone"
								dataKey="revenue"
								stroke="currentColor"
								dot={false}
							/>
						</LineChart>
					</MarketingPerformanceChartFrame>
				</DesktopAppSurface>
				<DesktopAppSurface variant="soft" className="min-w-0 p-3">
					<div className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}>
						{t('overview.performance.leadsChart', {
							defaultValue: 'Leads and conversions',
						})}
					</div>
					<MarketingPerformanceChartFrame
						ariaLabel={t('overview.performance.leadsChart', {
							defaultValue: 'Leads and conversions',
						})}
					>
						<BarChart data={series}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" minTickGap={24} />
							<YAxis />
							<Tooltip />
							<Bar dataKey="leads" fill="currentColor" />
							<Bar dataKey="conversions" fill="currentColor" />
						</BarChart>
					</MarketingPerformanceChartFrame>
				</DesktopAppSurface>
			</div>

			<DesktopAppSurface variant="soft" className="min-w-0 overflow-hidden p-0">
				<div className="flex items-center justify-between gap-3 border-b border-(--desktop-border-subtle) px-3 py-2">
					<div className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}>
						{t('overview.performance.campaignTable', {
							defaultValue: 'Campaign effectiveness',
						})}
					</div>
					<div className="text-xs text-(--desktop-text-secondary)">
						{t('overview.performance.roi', { defaultValue: 'ROI' })}:{' '}
						{formatMarketingRatio(totals?.roi)}
					</div>
				</div>
				<div className="overflow-auto">
					<table className="min-w-full text-left text-sm">
						<thead className="text-xs uppercase tracking-wide text-(--desktop-text-muted)">
							<tr>
								<th className="px-3 py-2 font-medium">
									{t('overview.performance.campaignColumn', {
										defaultValue: 'Campaign',
									})}
								</th>
								{(
									[
										['revenue', 'overview.performance.sortRevenue'],
										['spend', 'overview.performance.sortSpend'],
										['leads', 'overview.performance.sortLeads'],
										['conversions', 'overview.performance.sortConversions'],
										['romi', 'overview.performance.sortRomi'],
									] as const
								).map(([key, labelKey]) => (
									<th key={key} className="px-3 py-2 font-medium">
										<button
											type="button"
											onClick={() => setSort(key)}
											className="rounded px-1 py-0.5 hover:bg-(--desktop-surface-soft)"
										>
											{t(labelKey, { defaultValue: key })}
										</button>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{sortedCampaigns.slice(0, 12).map((row) => (
								<tr
									key={row.campaign_id ?? row.campaign_name}
									className="border-t border-(--desktop-border-subtle)"
								>
									<td className="px-3 py-2 font-medium text-(--desktop-text-primary)">
										{row.campaign_name}
										<div className="text-xs font-normal text-(--desktop-text-secondary)">
											{row.channel ||
												t('overview.performance.channelUnknown', {
													defaultValue: 'unknown',
												})}{' '}
											·{' '}
											{row.status ||
												t('overview.performance.statusNa', {
													defaultValue: 'n/a',
												})}
										</div>
									</td>
									<td className="px-3 py-2 tabular-nums">
										{formatMarketingMoney(row.revenue)}
									</td>
									<td className="px-3 py-2 tabular-nums">
										{formatMarketingMoney(row.spend)}
									</td>
									<td className="px-3 py-2 tabular-nums">{row.leads}</td>
									<td className="px-3 py-2 tabular-nums">{row.conversions}</td>
									<td className="px-3 py-2 tabular-nums">
										{formatMarketingPercent(row.romi)}
									</td>
								</tr>
							))}
							{!sortedCampaigns.length ? (
								<tr>
									<td
										colSpan={6}
										className="px-3 py-6 text-center text-sm text-(--desktop-text-secondary)"
									>
										{hasFacts
											? t('overview.performance.noCampaignRows', {
													defaultValue: 'No campaign rows match the filters.',
												})
											: t('overview.performance.noFacts', {
													defaultValue:
														'No performance data yet. Add campaign budget and dates, fill funnel stages with visitors/conversions, and set a revenue-like actual metric on campaigns.',
												})}
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>
			</DesktopAppSurface>
		</DesktopAppSurface>
	);
}
