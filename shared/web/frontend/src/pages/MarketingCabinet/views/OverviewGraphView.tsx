import * as React from 'react';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	ArrowRightIcon,
	ChevronRightIcon,
	RectangleGroupIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { LoadingGrid } from '../components/LoadingGrid';
import type { MarketingView } from '../constants';
import {
	localizeOverviewGraphBullet,
	localizeOverviewGraphEdge,
	localizeOverviewGraphMetricLabel,
	localizeOverviewGraphNodeText,
	localizeOverviewInsight,
} from '../locales';
import { marketingCabinetProjectGraphQueryOptions } from '../marketingCabinetQueryOptions';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { cn } from '@/utils/cn';

interface OverviewGraphViewProps {
	projectId: string;
	onNavigate: (view: MarketingView, entityId?: string | null) => void;
	extractApiErrorMessage: (error: unknown, fallback: string) => string;
}

function toneClasses(tone?: string): string {
	if (tone === 'accent')
		return 'border-(--mc-accent-35) bg-(--desktop-surface-accent)';
	if (tone === 'warning')
		return 'border-(--mc-border-accent-soft) bg-[var(--mc-readonly-banner-bg)]';
	if (tone === 'danger') return 'border-red-500/30 bg-red-950/30';
	return 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)';
}

function toneInkClasses(tone?: string): string {
	if (tone === 'accent') return 'text-(--mc-accent)';
	if (tone === 'warning') return 'text-[rgb(var(--desktop-accent-rgb)/0.92)]';
	if (tone === 'danger') return 'text-red-200/95';
	return 'text-(--desktop-text-secondary)';
}

function toneChipClasses(
	tone: string | undefined,
	neutralInset: string
): string {
	if (tone === 'accent') {
		return 'border-(--mc-accent-35) bg-(--mc-accent-12) text-(--mc-accent)';
	}
	if (tone === 'warning')
		return 'border-(--mc-border-accent-soft) bg-(--mc-accent-10) text-(--desktop-text-secondary)';
	if (tone === 'danger')
		return 'border-red-500/30 bg-red-950/30 text-red-200/90';
	return cn(neutralInset, 'text-(--desktop-text-secondary)');
}

function integrityScoreClasses(score: number): string {
	if (score >= 75)
		return 'border-(--mc-accent-35) bg-(--desktop-surface-accent)';
	if (score >= 45)
		return 'border-(--mc-border-accent-soft) bg-[var(--mc-readonly-banner-bg)]';
	return 'border-red-500/30 bg-red-950/35';
}

function severityChipClasses(
	severity: string | undefined,
	neutralInset: string
): string {
	if (severity === 'critical')
		return 'border-red-500/30 bg-red-950/30 text-red-200/90';
	if (severity === 'high')
		return 'border-(--mc-border-accent-soft) bg-(--mc-accent-10) text-(--desktop-text-secondary)';
	return cn(neutralInset, 'text-(--desktop-text-secondary)');
}

function RadialMetric({
	percentage,
	tone,
	metricLabel,
	metricValue,
}: {
	percentage?: number | null;
	tone?: string;
	metricLabel?: string | null;
	metricValue?: string | number | null;
}) {
	const normalized = Math.max(0, Math.min(100, percentage ?? 0));
	const radius = 31;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference - (normalized / 100) * circumference;

	return (
		<div className="relative h-24 w-24 shrink-0">
			<svg viewBox="0 0 84 84" className="-rotate-90">
				<title>
					{metricLabel ? `${metricLabel}: ${normalized}%` : `${normalized}%`}
				</title>
				<circle
					cx="42"
					cy="42"
					r={radius}
					fill="none"
					stroke="rgba(148, 163, 184, 0.28)"
					strokeWidth="8"
				/>
				<circle
					cx="42"
					cy="42"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="8"
					strokeLinecap="round"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={dashOffset}
					className={cn('transition-all duration-300', toneInkClasses(tone))}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
				<div className="text-lg font-semibold text-(--desktop-text-primary)">
					{normalized}%
				</div>
				<div className="text-[11px] uppercase tracking-[0.14em] text-(--desktop-text-secondary)">
					{metricLabel || 'metric'}
				</div>
				{metricValue != null ? (
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'mt-0.5 text-(--desktop-text-secondary) leading-4'
						)}
					>
						{metricValue}
					</div>
				) : null}
			</div>
		</div>
	);
}

export function OverviewGraphView({
	projectId,
	onNavigate,
	extractApiErrorMessage,
}: OverviewGraphViewProps) {
	const { t } = useTranslation('marketing');
	const { toolbarInset } = useMarketingShellClasses();
	const graphQuery = useQuery({
		...marketingCabinetProjectGraphQueryOptions(projectId),
		enabled: Boolean(projectId),
	});

	if (graphQuery.isLoading) {
		return <LoadingGrid />;
	}

	if (graphQuery.isError) {
		return (
			<DesktopAppErrorState
				message={extractApiErrorMessage(
					graphQuery.error,
					t('overview.graph.loadErrorDefault')
				)}
				onAction={() => void graphQuery.refetch()}
			/>
		);
	}

	const graph = graphQuery.data;
	const strategyIssues = graph?.strategy_integrity_issues ?? [];
	const graphNodes = graph?.nodes ?? [];
	const graphEdges = graph?.edges ?? [];
	if (!graph || graphNodes.length === 0) {
		return (
			<DesktopAppSurface
				variant="soft"
				className="flex w-full min-w-0 flex-col"
			>
				<DesktopAppEmptyState
					className="min-h-[min(52vh,26rem)] flex-1 justify-center py-10 sm:py-14"
					icon={
						<RectangleGroupIcon
							className="h-8 w-8 text-(--mc-accent)"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					}
					title={t('overview.graph.emptyTitle')}
					description={t('overview.graph.emptyDescription')}
				/>
			</DesktopAppSurface>
		);
	}

	return (
		<div className="w-full min-w-0 space-y-4">
			<DesktopAppSurface
				variant="soft"
				className="min-w-0 space-y-2 p-4 sm:p-5"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}>
							{t('overview.graph.modeLabel')}
						</div>
						<div className="mt-1 text-lg font-medium text-(--desktop-text-primary)">
							{graph.project.name}
						</div>
						<div className={cn(DESKTOP_TYPOGRAPHY.body, 'mt-1')}>
							{t('overview.graph.modeDescription')}
						</div>
					</div>
					<div className="flex flex-wrap items-stretch gap-3">
						<div className="rounded-(--desktop-radius) border border-(--mc-accent-35) bg-(--desktop-surface-accent) px-4 py-3.5">
							<div className="text-[11px] uppercase tracking-[0.16em] text-white/85">
								{t('overview.graph.readinessMetric')}
							</div>
							<div className="mt-1 text-2xl font-semibold text-white">
								{graph.readiness_score}%
							</div>
						</div>
						<div
							className={cn(
								'rounded-(--desktop-radius) border px-4 py-3.5',
								integrityScoreClasses(graph.strategy_integrity_score ?? 0)
							)}
						>
							<div className="text-[11px] uppercase tracking-[0.16em] text-white/85">
								{t('overview.graph.integrityMetric')}
							</div>
							<div className="mt-1 text-2xl font-semibold text-white">
								{graph.strategy_integrity_score ?? 0}%
							</div>
						</div>
					</div>
				</div>
				{strategyIssues.length > 0 ? (
					<div className="flex flex-wrap gap-2 pt-1">
						{strategyIssues.slice(0, 3).map((issue) => (
							<button
								key={issue.code}
								type="button"
								onClick={() =>
									issue.target_view &&
									onNavigate(issue.target_view as MarketingView)
								}
								className={cn(
									'inline-flex min-h-10 items-center justify-center rounded-full px-3.5 py-2 text-xs font-medium transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-soft)',
									severityChipClasses(issue.severity, toolbarInset)
								)}
							>
								{localizeOverviewInsight(issue.code, 'title', issue.title)}
							</button>
						))}
					</div>
				) : null}
			</DesktopAppSurface>

			<DesktopAppSurface
				variant="soft"
				className="min-w-0 space-y-3 p-4 sm:p-5"
			>
				<DesktopAppSectionLabel
					id="mc-overview-graph-flow-legend"
					className="block text-(--desktop-text-secondary)"
				>
					{t('overview.graph.flowLabel')}
				</DesktopAppSectionLabel>
				<section
					className="-mx-1 min-w-0 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin]"
					aria-labelledby="mc-overview-graph-flow-legend"
				>
					<div className="flex w-max min-w-full flex-wrap items-center gap-x-2 gap-y-3 md:w-auto">
						{graphNodes.map((node, index) => {
							const edge = graphEdges[index];
							return (
								<React.Fragment key={`flow-${node.id}`}>
									<button
										type="button"
										onClick={() =>
											node.target_view &&
											onNavigate(node.target_view as MarketingView)
										}
										className={cn(
											'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-soft)',
											toneChipClasses(node.tone, toolbarInset),
											node.target_view
												? 'hover:brightness-110'
												: 'cursor-default'
										)}
									>
										<span
											className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-black/20 px-1.5 text-xs font-semibold tabular-nums text-white/95"
											aria-hidden
										>
											{index + 1}
										</span>
										<span className="max-w-56 truncate font-medium sm:max-w-72">
											{localizeOverviewGraphNodeText(
												node.id,
												'title',
												node.title
											)}
										</span>
									</button>
									{edge ? (
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'inline-flex shrink-0 items-center gap-2 px-1 font-medium leading-snug tracking-wide text-(--desktop-text-secondary)'
											)}
											role="presentation"
										>
											<ArrowRightIcon
												className="h-4 w-4 shrink-0 text-(--mc-accent)"
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
											<span className="max-w-48 sm:max-w-none">
												{localizeOverviewGraphEdge(
													edge.source,
													edge.target,
													edge.label
												)}
											</span>
										</div>
									) : null}
								</React.Fragment>
							);
						})}
					</div>
				</section>
			</DesktopAppSurface>

			<div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				{graphNodes.map((node) => (
					<DesktopAppSurface
						key={node.id}
						variant="soft"
						className={cn(
							'flex h-full min-h-0 flex-col border p-4 sm:p-5',
							toneClasses(node.tone)
						)}
					>
						<div className="flex min-h-0 min-w-0 flex-1 items-start gap-4">
							<RadialMetric
								percentage={node.percentage}
								tone={node.tone}
								metricLabel={localizeOverviewGraphMetricLabel(
									node.metric_label
								)}
								metricValue={node.metric_value}
							/>

							<div className="min-w-0 flex-1 space-y-3">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<div className="inline-flex max-w-full items-center gap-2 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-(--desktop-text-secondary)">
											<span className="truncate">
												{localizeOverviewGraphMetricLabel(
													node.metric_label || t('overview.graph.defaultMetric')
												)}
											</span>
											{node.metric_value != null ? (
												<span className="truncate text-(--desktop-text-secondary)">
													{node.metric_value}
												</span>
											) : null}
										</div>
										<div className="mt-2 text-base font-semibold text-(--desktop-text-primary)">
											{localizeOverviewGraphNodeText(
												node.id,
												'title',
												node.title
											)}
										</div>
										<div
											className={cn(DESKTOP_TYPOGRAPHY.body, 'mt-1 leading-6')}
										>
											{localizeOverviewGraphNodeText(
												node.id,
												'subtitle',
												node.subtitle
											)}
										</div>
									</div>

									{node.target_view ? (
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="md"
											className="min-h-10 shrink-0 px-3"
											onClick={() =>
												onNavigate(node.target_view as MarketingView)
											}
										>
											{t('overview.openAction')}
											<ChevronRightIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										</DesktopAppButton>
									) : null}
								</div>

								{(node.bullets ?? []).length > 0 ? (
									<div className="grid gap-2">
										{(node.bullets ?? [])
											.slice(0, 3)
											.map((bullet, bulletIndex) => (
												<div
													key={`${node.id}-${bullet}`}
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-3 py-2.5 text-(--desktop-text-secondary) leading-relaxed'
													)}
												>
													{localizeOverviewGraphBullet(
														node.id,
														bulletIndex,
														bullet
													)}
												</div>
											))}
									</div>
								) : null}
							</div>
						</div>
					</DesktopAppSurface>
				))}
			</div>
		</div>
	);
}
