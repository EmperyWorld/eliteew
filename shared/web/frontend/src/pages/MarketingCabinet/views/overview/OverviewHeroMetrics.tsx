/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview hero strip: mode intro, performance panel, executive snapshot, metric cards, readiness breakdown, company ribbon.
 *
 * Invariants:
 * - Does not mutate dashboard data; performance panel stays behind ErrorBoundary.
 *
 * Related:
 * - overview/OverviewView.tsx, overviewViewModel.ts
 */

import { ErrorBoundary } from '@/components/ui/primitives/ErrorBoundary';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppErrorState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { MarketingPerformanceDashboardPanel } from '@/pages/MarketingCabinet/components/MarketingPerformanceDashboardPanel';
import { MetricCard } from '@/pages/MarketingCabinet/components/MetricCard';
import {
	formatDateTime,
	localizeOverviewInsight,
} from '@/pages/MarketingCabinet/locales';
import type { MarketingProject } from '@/pages/MarketingCabinet/marketingCabinetApi';
import type { MarketingView } from '@/pages/MarketingCabinet/constants';
import { cn } from '@/utils/cn';

import type { OverviewViewModel } from './overviewViewModel';

export function OverviewHeroMetrics({
	selectedProjectId,
	selectedProject,
	refetch,
	progressTrack,
	onNavigate,
	vm,
}: {
	selectedProjectId: string;
	selectedProject: MarketingProject;
	refetch: () => void;
	progressTrack: string;
	onNavigate: (view: MarketingView, entityId?: string | null) => void;
	vm: OverviewViewModel;
}) {
	const { t } = useTranslation('marketing');
	const {
		readinessScore,
		counts,
		jtbdCoverage,
		openAlertsCount,
		criticalAlertsCount,
		topGapSnapshot,
		readinessBreakdown,
		weakestReadinessKey,
		wMeta,
		readinessMeta,
		companyRollup,
	} = vm;

	return (
		<>
			<DesktopAppSurface
				variant="soft"
				className="min-w-0 p-4"
				data-mc-guide="overview-mode"
			>
				<div className="text-sm font-medium leading-snug text-(--desktop-text-primary)">
					{t('overview.viewModeTitle')}
				</div>
				<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 leading-relaxed')}>
					{t('overview.viewModeDescription')}
				</div>
			</DesktopAppSurface>

			<ErrorBoundary
				key={`overview-performance-${selectedProjectId}`}
				fallback={
					<DesktopAppSurface variant="soft" className="overflow-hidden p-0">
						<DesktopAppErrorState
							message={t('overview.performance.panelRenderError', {
								defaultValue:
									'Could not render the marketing performance block. Refresh the page or open another section.',
							})}
							onAction={() => void refetch()}
							actionLabel={t('overview.performance.refresh', {
								defaultValue: 'Refresh',
							})}
						/>
					</DesktopAppSurface>
				}
			>
				<MarketingPerformanceDashboardPanel projectId={selectedProjectId} />
			</ErrorBoundary>
			{topGapSnapshot || readinessBreakdown ? (
				<DesktopAppSurface variant="soft" className="min-w-0 space-y-3 p-4">
					<DesktopAppSectionLabel className="mb-0">
						{t('overview.executiveSnapshotTitle')}
					</DesktopAppSectionLabel>
					<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-relaxed')}>
						{t('overview.executiveSnapshotDescription')}
					</p>
					<ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-(--desktop-text-primary)">
						{topGapSnapshot ? (
							<li className="wrap-break-word">
								{t('overview.executiveSnapshotGapLine', {
									title: localizeOverviewInsight(
										topGapSnapshot.code,
										'title',
										topGapSnapshot.title
									),
								})}
							</li>
						) : (
							<li className="text-(--desktop-text-secondary)">
								{t('overview.executiveSnapshotNoGap')}
							</li>
						)}
						{readinessBreakdown && weakestReadinessKey ? (
							<li className="wrap-break-word">
								{t('overview.executiveSnapshotWeakLine', {
									score: readinessScore,
									component: t(
										`overview.readinessBreakdown.${weakestReadinessKey}`
									),
									value: readinessBreakdown[weakestReadinessKey],
								})}
							</li>
						) : null}
					</ul>
				</DesktopAppSurface>
			) : null}
			<div className="min-w-0 space-y-4">
				<div>
					<DesktopAppSectionLabel className="mb-3">
						{t('overview.indexMetricsSection')}
					</DesktopAppSectionLabel>
					<div className="grid min-w-0 gap-4 sm:grid-cols-2">
						<MetricCard
							label={t('overview.cards.readinessLabel')}
							value={`${readinessScore}%`}
							metricKind={t('overview.cards.metricKindIndex')}
							hint={t('overview.cards.readinessHint')}
							helpBlockId="overview.metric.readiness"
							tone={readinessScore >= 50 ? 'accent' : 'danger'}
						/>
						<MetricCard
							label={t('overview.cards.jtbdCoverageLabel')}
							value={`${jtbdCoverage?.percentage ?? 0}%`}
							metricKind={t('overview.cards.metricKindShare')}
							hint={t('overview.cards.jtbdCoverageHint', {
								covered: jtbdCoverage?.covered ?? 0,
								total: jtbdCoverage?.total ?? 0,
							})}
							helpBlockId="overview.metric.jtbd"
						/>
					</div>
				</div>
				<div>
					<DesktopAppSectionLabel className="mb-3">
						{t('overview.volumeMetricsSection')}
					</DesktopAppSectionLabel>
					<div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						<MetricCard
							label={t('overview.cards.segmentsLabel')}
							value={counts.segments}
							metricKind={t('overview.cards.metricKindCount')}
							hint={t('overview.cards.segmentsHint')}
						/>
						<MetricCard
							label={t('overview.cards.campaignsLabel')}
							value={counts.campaigns}
							metricKind={t('overview.cards.metricKindCount')}
							hint={t('overview.cards.campaignsHint')}
						/>
						<MetricCard
							label={t('overview.cards.alertsLabel')}
							value={openAlertsCount}
							metricKind={t('overview.cards.metricKindAlerts')}
							hint={t('overview.cards.alertsHint')}
							tone={criticalAlertsCount > 0 ? 'danger' : 'default'}
						/>
						<MetricCard
							label={t('overview.cards.aiRunsLabel')}
							value={counts.ai_runs}
							metricKind={t('overview.cards.metricKindCount')}
							hint={t('overview.cards.aiRunsHint')}
						/>
					</div>
				</div>
			</div>

			{readinessBreakdown ? (
				<DesktopAppSurface variant="soft" className="min-w-0 space-y-3 p-4">
					<DesktopAppSectionLabel className="mb-0">
						{t('overview.readinessBreakdownTitle')}
					</DesktopAppSectionLabel>
					<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-relaxed')}>
						{t('overview.readinessBreakdownDescription')}
					</p>
					<details className="group min-w-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 open:bg-(--desktop-surface-soft)/55">
						<summary
							className={cn(
								'cursor-pointer select-none px-3 py-2.5 text-sm font-medium leading-snug text-(--desktop-text-primary)',
								'list-none [&::-webkit-details-marker]:hidden'
							)}
						>
							{t('overview.readinessBreakdownDetailsToggle')}
						</summary>
						<div className="space-y-3 border-t border-(--desktop-border-subtle) px-3 pb-3 pt-2">
							{wMeta ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'leading-relaxed text-(--desktop-text-secondary)'
									)}
								>
									{t('overview.readinessWeightsShortLine', {
										wStrat: Math.round((wMeta.strategy_base ?? 0) * 100),
										wOps: Math.round((wMeta.operations ?? 0) * 100),
										wCov: Math.round((wMeta.coverage ?? 0) * 100),
										wFresh: Math.round((wMeta.freshness ?? 0) * 100),
										wInt: Math.round((wMeta.strategy_integrity ?? 0) * 100),
									})}
								</p>
							) : null}
							{readinessMeta && wMeta ? (
								<div
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'space-y-2 leading-relaxed text-(--desktop-text-secondary)'
									)}
								>
									<p>
										{t('overview.readinessWeightsExplainer', {
											wStrat: Math.round((wMeta.strategy_base ?? 0) * 100),
											wOps: Math.round((wMeta.operations ?? 0) * 100),
											wCov: Math.round((wMeta.coverage ?? 0) * 100),
											wFresh: Math.round((wMeta.freshness ?? 0) * 100),
											wInt: Math.round((wMeta.strategy_integrity ?? 0) * 100),
										})}
									</p>
									<p>
										{t('overview.readinessContributionExplainer', {
											s: readinessMeta.contribution_points?.strategy_base ?? 0,
											o: readinessMeta.contribution_points?.operations ?? 0,
											c: readinessMeta.contribution_points?.coverage ?? 0,
											f: readinessMeta.contribution_points?.freshness ?? 0,
											i:
												readinessMeta.contribution_points?.strategy_integrity ??
												0,
											total: readinessScore,
										})}
									</p>
									<p>
										{t('overview.readinessCoverageAverageSlots', {
											used: readinessMeta.coverage_average_rows_used ?? 0,
											slots: readinessMeta.coverage_average_slots_total ?? 0,
										})}
									</p>
								</div>
							) : null}
							<div className="space-y-2.5">
								{(
									[
										['strategy_base', readinessBreakdown.strategy_base],
										['operations', readinessBreakdown.operations],
										['coverage', readinessBreakdown.coverage],
										['freshness', readinessBreakdown.freshness],
										[
											'strategy_integrity',
											readinessBreakdown.strategy_integrity,
										],
									] as const
								).map(([key, val]) => (
									<div key={key} className="min-w-0">
										<div className="flex justify-between gap-2 text-xs text-(--desktop-text-secondary)">
											<span>{t(`overview.readinessBreakdown.${key}`)}</span>
											<span className="tabular-nums">{val}%</span>
										</div>
										<div className={progressTrack}>
											<div
												className="h-1.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.5)]"
												style={{
													width: `${Math.max(4, Math.min(100, val))}%`,
												}}
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					</details>
				</DesktopAppSurface>
			) : null}

			{companyRollup ? (
				<DesktopAppSurface
					variant="soft"
					className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4"
				>
					<div className="min-w-0 flex-1">
						<div
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
								'leading-normal'
							)}
						>
							{t('overview.companyRibbonTitle')}
						</div>
						<div className="mt-1 text-sm font-medium leading-snug text-(--desktop-text-primary)">
							{companyRollup.company_name || selectedProject.name}
						</div>
						<div
							className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 leading-relaxed')}
						>
							{t('overview.companyRibbonSubtitle', {
								total: companyRollup.total_projects,
								active: companyRollup.active_projects,
								latest: formatDateTime(companyRollup.latest_activity_at),
							})}
						</div>
					</div>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0"
						onClick={() => onNavigate('companies')}
					>
						{t('overview.openPortfolio')}
						<ArrowRightIcon
							className="h-3.5 w-3.5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
				</DesktopAppSurface>
			) : null}
		</>
	);
}
