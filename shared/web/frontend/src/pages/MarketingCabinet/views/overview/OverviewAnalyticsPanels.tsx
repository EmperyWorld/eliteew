/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview action-center gaps, coverage/freshness, and strategy-integrity SectionPanels.
 *
 * Invariants:
 * - Gap collapse toggle is local; remediation actions stay project-scoped.
 *
 * Related:
 * - IssueRemediationStatus.tsx, overviewRemediationHelpers.ts, overviewViewModel.ts
 */

import {
	ArrowRightIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { OverviewRemediationActions } from '@/pages/MarketingCabinet/components/OverviewRemediationActions';
import { SectionPanel } from '@/pages/MarketingCabinet/components/SectionPanel';
import type { MarketingView } from '@/pages/MarketingCabinet/constants';
import {
	localizeOverviewCoverageLabel,
	localizeOverviewFreshnessDetail,
	localizeOverviewFreshnessLabel,
	localizeOverviewInsight,
	localizeOverviewStrategyIntegrityLabel,
} from '@/pages/MarketingCabinet/locales';
import { cn } from '@/utils/cn';

import { IssueRemediationStatus } from './IssueRemediationStatus';
import { GAPS_COLLAPSED_AT, type OverviewViewModel } from './overviewViewModel';
import {
	canCreateAlertForSeverity,
	overviewPressableFocus,
} from './overviewRemediationHelpers';

export function OverviewAnalyticsPanels({
	selectedProjectId,
	progressTrack,
	onNavigate,
	gapsExpanded,
	setGapsExpanded,
	vm,
}: {
	selectedProjectId: string;
	progressTrack: string;
	onNavigate: (view: MarketingView, entityId?: string | null) => void;
	gapsExpanded: boolean;
	setGapsExpanded: Dispatch<SetStateAction<boolean>>;
	vm: OverviewViewModel;
}) {
	const { t } = useTranslation('marketing');
	const {
		gaps,
		visibleGaps,
		remediationIssueCodes,
		issueRemediationByCode,
		coverage,
		freshness,
		strategyIntegrityScore,
		strategyIntegrity,
		strategyIntegrityIssues,
		strategyIntegrityIssuesVisible,
		strategyIntegrityIssueCodes,
	} = vm;

	return (
		<>
			<div className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
				<SectionPanel
					title={t('overview.actionCenterTitle')}
					description={t('overview.actionCenterDescription')}
					helpBlockId="overview.readiness_cycle"
					actions={
						remediationIssueCodes.length > 0 ? (
							<OverviewRemediationActions
								projectId={selectedProjectId}
								issueCodes={remediationIssueCodes}
							/>
						) : null
					}
				>
					<div className="grid gap-4">
						<DesktopAppSurface variant="soft" className="space-y-3 p-4">
							<DesktopAppSectionLabel>
								{t('overview.gapsTitle')}
							</DesktopAppSectionLabel>
							{gaps.length > 0 ? (
								<div className="space-y-2">
									{visibleGaps.map((gap) => (
										<DesktopAppSurface
											key={gap.code}
											variant="soft"
											className="space-y-2 p-3"
										>
											<button
												type="button"
												onClick={() =>
													onNavigate(
														(gap.target_view as MarketingView) || 'overview'
													)
												}
												className={cn(
													'flex w-full min-w-0 items-start gap-2 rounded-[calc(var(--desktop-radius)-2px)] text-left transition-colors hover:bg-(--desktop-surface-soft)/60',
													overviewPressableFocus
												)}
											>
												<ExclamationTriangleIcon
													className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
												<div className="min-w-0 space-y-1">
													<div className="text-sm font-medium leading-snug text-(--desktop-text-primary)">
														{localizeOverviewInsight(
															gap.code,
															'title',
															gap.title
														)}
													</div>
													<div className="text-xs leading-5 text-(--desktop-text-secondary) wrap-break-word">
														{localizeOverviewInsight(
															gap.code,
															'description',
															gap.description
														)}
													</div>
												</div>
											</button>
											<div className="grid min-w-0 gap-2 pl-6">
												<IssueRemediationStatus
													remediation={issueRemediationByCode.get(gap.code)}
													onNavigate={onNavigate}
													primaryView={
														(gap.target_view as MarketingView) || null
													}
												/>
												<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
													<OverviewRemediationActions
														projectId={selectedProjectId}
														issueCodes={[gap.code]}
														allowAlert={canCreateAlertForSeverity(gap.severity)}
														compact
													/>
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="sm"
														onClick={() =>
															onNavigate(
																(gap.target_view as MarketingView) || 'overview'
															)
														}
													>
														{t('overview.openAction')}
														<ArrowRightIcon
															className="h-3.5 w-3.5"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													</DesktopAppButton>
												</div>
											</div>
										</DesktopAppSurface>
									))}
									{gaps.length > GAPS_COLLAPSED_AT ? (
										<div className="flex justify-center pt-1">
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => setGapsExpanded((v) => !v)}
											>
												{gapsExpanded
													? t('overview.gapsShowLess')
													: t('overview.gapsShowMore', {
															count: gaps.length - GAPS_COLLAPSED_AT,
														})}
											</DesktopAppButton>
										</div>
									) : null}
								</div>
							) : (
								<div className="flex items-start gap-2.5 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/35 px-3 py-3 text-sm leading-relaxed text-(--desktop-text-secondary)">
									<CheckCircleIcon
										className="mt-0.5 h-4 w-4 shrink-0 text-(--mc-accent-75)"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									<span className="min-w-0">
										{t('overview.noCriticalGaps')}
									</span>
								</div>
							)}
						</DesktopAppSurface>
					</div>
				</SectionPanel>

				<SectionPanel
					title={t('overview.coverageFreshnessTitle')}
					description={t('overview.coverageFreshnessDescription')}
					helpBlockId="overview.latest_swot"
				>
					<div className="space-y-4">
						<div className="space-y-3">
							{coverage.map((item) => (
								<div key={item.key} className="min-w-0 space-y-1.5">
									<div className="flex min-w-0 items-center justify-between gap-3">
										<div className="min-w-0 text-sm leading-snug text-(--desktop-text-secondary) wrap-break-word">
											{localizeOverviewCoverageLabel(item.key, item.label)}
										</div>
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'shrink-0 tabular-nums'
											)}
										>
											{item.covered}/{item.total} · {item.percentage}%
										</div>
									</div>
									<div className={progressTrack}>
										<div
											className={`h-2 rounded-full ${
												item.status === 'strong'
													? 'bg-[rgb(var(--desktop-accent-rgb)/0.55)]'
													: item.status === 'warning'
														? 'bg-[rgb(var(--desktop-accent-rgb)/0.72)]'
														: 'bg-red-600/80'
											}`}
											style={{ width: `${Math.max(6, item.percentage)}%` }}
										/>
									</div>
								</div>
							))}
						</div>
						<div className="grid gap-2">
							{freshness.map((item) => (
								<DesktopAppSurface
									key={item.key}
									variant="soft"
									className="flex min-w-0 items-center justify-between gap-3 p-3"
								>
									<div className="min-w-0 flex-1">
										<div className="text-sm font-medium leading-snug text-(--desktop-text-primary) wrap-break-word">
											{localizeOverviewFreshnessLabel(item.key, item.label)}
										</div>
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'leading-relaxed wrap-break-word'
											)}
										>
											{localizeOverviewFreshnessDetail(item.key, item.detail)}
										</div>
									</div>
									<div className="flex shrink-0 items-center gap-2 text-xs text-(--desktop-text-secondary)">
										<ClockIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{item.age_days != null
											? t('overview.daysShort', { count: item.age_days })
											: t('overview.missingFreshness')}
									</div>
								</DesktopAppSurface>
							))}
						</div>
					</div>
				</SectionPanel>
			</div>

			<SectionPanel
				title={t('overview.strategyIntegrityTitle')}
				description={t('overview.strategyIntegrityDescription')}
				actions={
					strategyIntegrityIssueCodes.length > 0 ? (
						<OverviewRemediationActions
							projectId={selectedProjectId}
							issueCodes={strategyIntegrityIssueCodes}
							compact={strategyIntegrityIssueCodes.length === 1}
						/>
					) : null
				}
			>
				<div className="grid min-w-0 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
					<DesktopAppSurface variant="soft" className="min-w-0 space-y-4 p-4">
						<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
							<div className="min-w-0 max-w-xl flex-1">
								<DesktopAppSectionLabel>
									{t('overview.strategyIntegrityIndexTitle')}
								</DesktopAppSectionLabel>
								<div className="mt-2 text-sm leading-6 text-(--desktop-text-secondary)">
									{t('overview.strategyIntegrityIndexDescription')}
								</div>
							</div>
							<div
								className={`shrink-0 rounded-(--desktop-radius) border px-4 py-3 ${
									strategyIntegrityScore >= 75
										? 'border-(--mc-accent-35) bg-(--desktop-surface-accent)'
										: strategyIntegrityScore >= 45
											? 'border-(--mc-border-accent-soft) bg-(--mc-readonly-banner-bg)'
											: 'border-red-500/30 bg-red-950/35'
								}`}
							>
								<div
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
										strategyIntegrityScore >= 75 &&
											'text-[rgb(var(--desktop-fg-primary-rgb)/0.78)]'
									)}
								>
									{t('overview.strategyIntegrityBadgeLabel')}
								</div>
								<div
									className={`mt-1 text-2xl font-semibold tabular-nums ${
										strategyIntegrityScore >= 75
											? 'text-[rgb(var(--desktop-fg-primary-rgb))]'
											: 'text-(--desktop-text-primary)'
									}`}
								>
									{strategyIntegrityScore}%
								</div>
							</div>
						</div>

						{strategyIntegrity.length > 0 ? (
							<div className="space-y-3">
								{strategyIntegrity.map((item) => (
									<div key={item.key} className="min-w-0 space-y-1.5">
										<div className="flex min-w-0 items-center justify-between gap-3">
											<div className="min-w-0 text-sm leading-snug text-(--desktop-text-secondary) wrap-break-word">
												{localizeOverviewStrategyIntegrityLabel(
													item.key,
													item.label
												)}
											</div>
											<div
												className={cn(
													DESKTOP_TYPOGRAPHY.meta,
													'shrink-0 tabular-nums'
												)}
											>
												{item.covered}/{item.total} · {item.percentage}%
											</div>
										</div>
										<div className={progressTrack}>
											<div
												className={`h-2 rounded-full ${
													item.status === 'strong'
														? 'bg-[rgb(var(--desktop-accent-rgb)/0.55)]'
														: item.status === 'warning'
															? 'bg-[rgb(var(--desktop-accent-rgb)/0.72)]'
															: 'bg-red-600/80'
												}`}
												style={{ width: `${Math.max(6, item.percentage)}%` }}
											/>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/35 px-3 py-3 text-sm leading-relaxed text-(--desktop-text-muted)">
								{t('overview.strategyIntegrityEmpty')}
							</div>
						)}
					</DesktopAppSurface>

					<DesktopAppSurface variant="soft" className="min-w-0 space-y-3 p-4">
						<DesktopAppSectionLabel>
							{t('overview.strategyIntegrityIssuesTitle')}
						</DesktopAppSectionLabel>
						{strategyIntegrityIssuesVisible.length > 0 ? (
							<div className="space-y-2">
								{strategyIntegrityIssuesVisible.map((issue) => (
									<DesktopAppSurface
										key={issue.code}
										variant="soft"
										className="space-y-2 p-3"
									>
										<button
											type="button"
											onClick={() =>
												onNavigate(
													(issue.target_view as MarketingView) || 'overview'
												)
											}
											className={cn(
												'flex w-full min-w-0 items-start justify-between gap-3 rounded-[calc(var(--desktop-radius)-2px)] text-left transition-colors hover:bg-(--desktop-surface-soft)/60',
												overviewPressableFocus
											)}
										>
											<div className="flex min-w-0 items-start gap-2">
												<ExclamationTriangleIcon
													className={`mt-0.5 h-4 w-4 shrink-0 ${
														issue.severity === 'critical'
															? 'text-red-300/90'
															: issue.severity === 'high'
																? 'text-[rgb(var(--desktop-accent-rgb)/0.88)]'
																: 'text-(--desktop-text-muted)'
													}`}
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
												<div className="min-w-0 space-y-1">
													<div className="text-sm font-medium text-(--desktop-text-primary)">
														{localizeOverviewInsight(
															issue.code,
															'title',
															issue.title
														)}
													</div>
													<div className="text-xs leading-5 text-(--desktop-text-secondary) wrap-break-word">
														{localizeOverviewInsight(
															issue.code,
															'description',
															issue.description
														)}
													</div>
												</div>
											</div>
											{issue.metric_value != null ? (
												<div
													className={cn(
														DESKTOP_TYPOGRAPHY.caption,
														'shrink-0 rounded-full border border-(--desktop-border-subtle) px-2.5 py-1'
													)}
												>
													{issue.metric_value}
												</div>
											) : null}
										</button>
										<div className="grid min-w-0 gap-2 pl-6">
											<IssueRemediationStatus
												remediation={issueRemediationByCode.get(issue.code)}
												onNavigate={onNavigate}
												primaryView={
													(issue.target_view as MarketingView) || null
												}
											/>
											<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
												<OverviewRemediationActions
													projectId={selectedProjectId}
													issueCodes={[issue.code]}
													allowAlert={canCreateAlertForSeverity(issue.severity)}
													compact
												/>
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													onClick={() =>
														onNavigate(
															(issue.target_view as MarketingView) || 'overview'
														)
													}
												>
													{t('overview.openAction')}
													<ArrowRightIcon
														className="h-3.5 w-3.5"
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
												</DesktopAppButton>
											</div>
										</div>
									</DesktopAppSurface>
								))}
							</div>
						) : strategyIntegrityIssues.length > 0 ? (
							<div className="rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/35 px-3 py-3 text-sm leading-relaxed text-(--desktop-text-secondary)">
								{t('overview.strategyIntegrityIssuesDedupedHint')}
							</div>
						) : (
							<div className="flex items-start gap-2.5 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/35 px-3 py-3 text-sm leading-relaxed text-(--desktop-text-secondary)">
								<CheckCircleIcon
									className="mt-0.5 h-4 w-4 shrink-0 text-(--mc-accent-75)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
								<span className="min-w-0">
									{t('overview.strategyIntegrityNoIssues')}
								</span>
							</div>
						)}
					</DesktopAppSurface>
				</div>
			</SectionPanel>
		</>
	);
}
