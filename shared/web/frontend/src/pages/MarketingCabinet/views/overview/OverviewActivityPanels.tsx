/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview activity, AI insights, market/execution/evidence panels, positive signals, and stale warning.
 *
 * Invariants:
 * - Navigation and Content Manager open remain project-scoped; no dashboard mutation.
 *
 * Related:
 * - overviewRemediationHelpers.ts, overviewViewModel.ts, OverviewView.tsx
 */

import {
	ArrowRightIcon,
	ArrowTopRightOnSquareIcon,
	BeakerIcon,
	CheckCircleIcon,
	CpuChipIcon,
	ExclamationTriangleIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { SectionPanel } from '@/pages/MarketingCabinet/components/SectionPanel';
import type { MarketingView } from '@/pages/MarketingCabinet/constants';
import {
	formatDateTime,
	localizeAlertSeverity,
	localizeCampaignChannel,
	localizeMarketingAiTool,
	localizeOverviewInsight,
	localizePriority,
	localizeResearchTypeSafe,
	localizeSegmentType,
	localizeStatus,
} from '@/pages/MarketingCabinet/locales';
import type { MarketingProject } from '@/pages/MarketingCabinet/marketingCabinetApi';
import { excerptOverviewPlaintext } from '@/pages/MarketingCabinet/utils/overviewExcerpt';
import { openDesktopApp } from '@/pages/MarketingCabinet/utils';
import { cn } from '@/utils/cn';

import {
	getLocalizedOverviewAlertCopy,
	getLocalizedOverviewTaskCopy,
} from './overviewRemediationHelpers';
import type { OverviewViewModel } from './overviewViewModel';

export function OverviewActivityPanels({
	selectedProject,
	toolbarInset,
	onNavigate,
	vm,
}: {
	selectedProject: MarketingProject;
	toolbarInset: string;
	onNavigate: (view: MarketingView, entityId?: string | null) => void;
	vm: OverviewViewModel;
}) {
	const { t } = useTranslation('marketing');
	const {
		d,
		activityFeed,
		recentAiRuns,
		swotSnapshot,
		swotFactors,
		recentCampaigns,
		recentTasks,
		recentAlerts,
		recentResearches,
		recentContent,
		highlights,
		recentSegments,
		staleFlags,
	} = vm;

	return (
		<>
			<div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1fr]">
				<SectionPanel
					title={t('overview.activityFeedTitle')}
					description={t('overview.activityFeedDescription')}
				>
					{activityFeed.length > 0 ? (
						<div className="space-y-2">
							{activityFeed.map((item) => (
								<button
									key={`${item.kind}-${item.id}`}
									type="button"
									onClick={() =>
										onNavigate(
											(item.target_view as MarketingView) || 'overview',
											item.id
										)
									}
									className={cn(
										'flex w-full min-w-0 items-start justify-between gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 text-left transition-colors hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover)',
										DESKTOP_INTERACTIVE.rowInteractive,
										'focus:outline-none'
									)}
								>
									<div className="min-w-0 space-y-1">
										<div className="text-sm font-medium leading-snug text-(--desktop-text-primary) wrap-break-word">
											{excerptOverviewPlaintext(item.title, 120) || item.title}
										</div>
										{item.description ? (
											<div className="text-xs leading-5 text-(--desktop-text-secondary) wrap-break-word">
												{excerptOverviewPlaintext(item.description)}
											</div>
										) : null}
									</div>
									<div
										className={cn(
											DESKTOP_TYPOGRAPHY.caption,
											'shrink-0 text-right leading-tight'
										)}
									>
										{formatDateTime(item.occurred_at)}
									</div>
								</button>
							))}
						</div>
					) : (
						<DesktopAppEmptyState
							title={t('overview.noActivityTitle')}
							description={t('overview.noActivityDescription')}
						/>
					)}
				</SectionPanel>

				<SectionPanel
					title={t('overview.aiInsightsTitle')}
					description={t('overview.aiInsightsDescription')}
					actions={
						<div className="flex min-w-0 flex-wrap items-center gap-1">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => onNavigate('ai_studio')}
							>
								{t('overview.openAiStudio')}
								<SparklesIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => onNavigate('imc')}
							>
								{t('overview.openImc')}
								<BeakerIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
						</div>
					}
				>
					{recentAiRuns.length > 0 ? (
						<div className="space-y-3">
							{recentAiRuns.map((run) => (
								<DesktopAppSurface
									key={run.id}
									variant="soft"
									className="space-y-2 p-4"
								>
									<div className="flex min-w-0 items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-2 text-sm font-medium leading-snug text-(--desktop-text-primary)">
											<CpuChipIcon
												className="h-4 w-4 shrink-0"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
											<span className="min-w-0 wrap-break-word">
												{localizeMarketingAiTool(run.tool_key)}
											</span>
										</div>
										<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'shrink-0')}>
											{localizeStatus(run.status)}
										</div>
									</div>
									{run.result_excerpt ? (
										<p className="text-sm leading-6 text-(--desktop-text-secondary) wrap-break-word">
											{excerptOverviewPlaintext(run.result_excerpt)}
										</p>
									) : (
										<p
											className={cn(DESKTOP_TYPOGRAPHY.meta, 'wrap-break-word')}
										>
											{excerptOverviewPlaintext(run.prompt_excerpt ?? '')}
										</p>
									)}
								</DesktopAppSurface>
							))}
						</div>
					) : (
						<DesktopAppEmptyState
							title={t('overview.noAiTitle')}
							description={t('overview.noAiDescription')}
						/>
					)}
				</SectionPanel>
			</div>

			<div className="grid min-w-0 gap-4 xl:grid-cols-3">
				<SectionPanel
					title={t('overview.marketIntelligenceTitle')}
					description={t('overview.marketIntelligenceDescription')}
					actions={
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onNavigate('analysis')}
						>
							{t('overview.openAnalysis')}
							<ArrowRightIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					}
				>
					{swotSnapshot ? (
						<div className="space-y-3">
							<DesktopAppSurface variant="soft" className="space-y-2 p-4">
								<div className="text-sm font-semibold text-(--desktop-text-primary) wrap-break-word">
									{excerptOverviewPlaintext(swotSnapshot.title, 160) ||
										swotSnapshot.title}
								</div>
								{swotSnapshot.executive_summary ? (
									<p className="text-sm leading-6 text-(--desktop-text-secondary) wrap-break-word">
										{excerptOverviewPlaintext(swotSnapshot.executive_summary)}
									</p>
								) : null}
							</DesktopAppSurface>
							<div className="grid gap-2">
								{(
									[
										[t('overview.swotStrengths'), swotFactors.strength],
										[t('overview.swotWeaknesses'), swotFactors.weakness],
										[t('overview.swotOpportunities'), swotFactors.opportunity],
										[t('overview.swotThreats'), swotFactors.threat],
									] as const
								).map(([label, items]) => (
									<DesktopAppSurface
										key={label}
										variant="soft"
										className="space-y-2 p-3"
									>
										<DesktopAppSectionLabel>{label}</DesktopAppSectionLabel>
										{items && items.length > 0 ? (
											<div className="text-sm leading-6 text-(--desktop-text-secondary) wrap-break-word">
												{excerptOverviewPlaintext(items[0]?.factor_text)}
											</div>
										) : (
											<div className={DESKTOP_TYPOGRAPHY.meta}>
												{t('overview.noFactors')}
											</div>
										)}
									</DesktopAppSurface>
								))}
							</div>
						</div>
					) : (
						<DesktopAppEmptyState
							title={t('overview.noSwotTitle')}
							description={t('overview.noSwotDescription')}
						/>
					)}
				</SectionPanel>

				<SectionPanel
					title={t('overview.executionLayerTitle')}
					description={t('overview.executionLayerDescription')}
				>
					{recentCampaigns.length > 0 ||
					recentTasks.length > 0 ||
					recentAlerts.length > 0 ? (
						<div className="space-y-2">
							<p
								className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-1 leading-relaxed')}
							>
								{t('overview.executionLayerFeedNote')}
							</p>
							{recentCampaigns.slice(0, 2).map((campaign) => (
								<DesktopAppSurface
									key={campaign.id}
									variant="soft"
									className="space-y-2 p-3"
								>
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{campaign.name}
									</div>
									<div className={DESKTOP_TYPOGRAPHY.meta}>
										{localizeCampaignChannel(campaign.channel)} ·{' '}
										{localizeStatus(campaign.status)}
									</div>
									<p className="text-xs leading-5 text-(--desktop-text-secondary)">
										{campaign.objective ||
											campaign.hypothesis ||
											t('overview.noExecutionNarrative')}
									</p>
								</DesktopAppSurface>
							))}
							{recentTasks.slice(0, 2).map((task) => (
								<DesktopAppSurface
									key={task.id}
									variant="soft"
									className="space-y-2 p-3"
								>
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{getLocalizedOverviewTaskCopy(task, t).title}
									</div>
									<div className={DESKTOP_TYPOGRAPHY.meta}>
										{localizeStatus(task.status)} ·{' '}
										{localizePriority(task.priority)} ·{' '}
										{task.due_at
											? formatDateTime(task.due_at)
											: t('overview.noDueDate')}
									</div>
								</DesktopAppSurface>
							))}
							{recentAlerts.slice(0, 1).map((alert) => (
								<DesktopAppSurface
									key={alert.id}
									variant="soft"
									className="space-y-2 p-3"
								>
									<div className="text-sm font-medium text-(--desktop-text-primary)">
										{getLocalizedOverviewAlertCopy(alert, t).title}
									</div>
									<div className={DESKTOP_TYPOGRAPHY.meta}>
										{localizeAlertSeverity(alert.severity)} ·{' '}
										{localizeStatus(alert.status)}
									</div>
								</DesktopAppSurface>
							))}
						</div>
					) : (
						<DesktopAppEmptyState
							title={t('overview.noExecutionTitle')}
							description={t('overview.noExecutionDescription')}
						/>
					)}
				</SectionPanel>

				<SectionPanel
					title={t('overview.researchEvidenceTitle')}
					description={t('overview.researchEvidenceDescription')}
					actions={
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() =>
								openDesktopApp('ContentManagerPro', {
									contentManagerProjectId: selectedProject.id,
									contentManagerCompanyId: selectedProject.company_id,
									contentManagerProjectName: selectedProject.name,
									contentManagerCabinetView: true,
								})
							}
						>
							{t('overview.openContentManager')}
							<ArrowTopRightOnSquareIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					}
				>
					{recentResearches.length > 0 || recentContent.length > 0 ? (
						<div className="space-y-2">
							{recentResearches.slice(0, 2).map((research) => (
								<DesktopAppSurface
									key={research.id}
									variant="soft"
									className="space-y-2 p-3"
								>
									<div className="text-sm font-medium text-(--desktop-text-primary) wrap-break-word">
										{excerptOverviewPlaintext(research.title, 140) ||
											research.title}
									</div>
									<p className={DESKTOP_TYPOGRAPHY.meta}>
										{localizeResearchTypeSafe(research.research_type)} ·{' '}
										{localizeStatus(research.status)}
									</p>
									{research.result_summary ? (
										<p className="text-xs leading-5 text-(--desktop-text-secondary) wrap-break-word">
											{excerptOverviewPlaintext(research.result_summary)}
										</p>
									) : null}
								</DesktopAppSurface>
							))}
							{recentContent.slice(0, 3).map((item) => (
								<DesktopAppSurface
									key={item.id}
									variant="soft"
									className="space-y-2 p-3"
								>
									<div className="text-sm font-medium text-(--desktop-text-primary) wrap-break-word">
										{excerptOverviewPlaintext(item.name, 120) || item.name}
									</div>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'leading-5 wrap-break-word'
										)}
									>
										{item.excerpt || item.description
											? excerptOverviewPlaintext(
													item.excerpt || item.description || ''
												)
											: t('overview.noContentExcerpt')}
									</p>
								</DesktopAppSurface>
							))}
						</div>
					) : (
						<DesktopAppEmptyState
							title={t('overview.noEvidenceTitle')}
							description={t('overview.noEvidenceDescription')}
						/>
					)}
				</SectionPanel>
			</div>

			{highlights.length > 0 || recentSegments.length > 0 ? (
				<SectionPanel
					title={t('overview.positiveSignalsTitle')}
					description={t('overview.positiveSignalsDescription')}
				>
					<div className="grid min-w-0 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
						<DesktopAppSurface variant="soft" className="min-w-0 space-y-3 p-4">
							<DesktopAppSectionLabel>
								{t('overview.highlightsTitle')}
							</DesktopAppSectionLabel>
							{highlights.length > 0 ? (
								<div className="space-y-2">
									{highlights.map((highlight) => (
										<div
											key={highlight.code}
											className="flex min-w-0 items-start gap-2 text-sm text-(--desktop-text-secondary)"
										>
											<CheckCircleIcon
												className="mt-0.5 h-4 w-4 shrink-0 text-(--mc-accent-70)"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
											<div className="min-w-0">
												<div className="font-medium leading-snug text-(--desktop-text-primary) wrap-break-word">
													{localizeOverviewInsight(
														highlight.code,
														'title',
														highlight.title
													)}
												</div>
												<div className="text-xs leading-5 wrap-break-word">
													{localizeOverviewInsight(
														highlight.code,
														'description',
														highlight.description
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							) : (
								<DesktopAppEmptyState
									title={t('overview.noHighlightsTitle')}
									description={t('overview.noHighlightsDescription')}
								/>
							)}
						</DesktopAppSurface>
						<DesktopAppSurface variant="soft" className="min-w-0 space-y-3 p-4">
							<DesktopAppSectionLabel>
								{t('overview.topSegmentsTitle')}
							</DesktopAppSectionLabel>
							{recentSegments.length > 0 ? (
								<div className="space-y-2">
									{recentSegments.slice(0, 3).map((segment) => (
										<button
											key={segment.id}
											type="button"
											onClick={() => onNavigate('segments', segment.id)}
											className={cn(
												toolbarInset,
												'flex w-full min-w-0 items-start justify-between gap-3 rounded-(--desktop-radius) p-3 text-left transition-colors hover:border-(--desktop-border-strong)',
												DESKTOP_INTERACTIVE.rowInteractive,
												'focus:outline-none'
											)}
										>
											<div className="min-w-0 space-y-1">
												<div className="text-sm font-medium leading-snug text-(--desktop-text-primary) wrap-break-word">
													{segment.name}
												</div>
												<div className={DESKTOP_TYPOGRAPHY.meta}>
													{localizeSegmentType(segment.segment_type)} ·{' '}
													{localizeStatus(segment.status)}
												</div>
												{segment.description ? (
													<div className="text-xs leading-5 text-(--desktop-text-secondary) wrap-break-word">
														{segment.description}
													</div>
												) : null}
											</div>
											<ArrowRightIcon
												className="mt-0.5 h-4 w-4 shrink-0 text-(--desktop-text-muted)"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										</button>
									))}
								</div>
							) : (
								<DesktopAppEmptyState
									title={t('overview.noSegmentsTitle')}
									description={t('overview.noSegmentsDescription')}
								/>
							)}
						</DesktopAppSurface>
					</div>
				</SectionPanel>
			) : null}

			{staleFlags.length > 0 ? (
				<DesktopAppSurface
					variant="soft"
					className="flex min-w-0 items-start gap-3 rounded-(--desktop-radius-lg) border border-(--mc-border-accent-soft) bg-(--mc-readonly-banner-bg) p-4 text-sm leading-relaxed text-(--desktop-text-secondary)"
				>
					<ExclamationTriangleIcon
						className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
					<span className="min-w-0 wrap-break-word">
						{t('overview.staleWarning', {
							count: staleFlags.length,
							lastActivity: formatDateTime(d.last_activity_at),
						})}
					</span>
				</DesktopAppSurface>
			) : null}
		</>
	);
}
