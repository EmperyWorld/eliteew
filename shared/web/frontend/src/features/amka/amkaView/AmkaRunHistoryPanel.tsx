/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AMKA run history list with recent digest spoiler.
 *
 * Related:
 * - AmkaView.tsx, useAmkaViewQueries.ts
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppEmptyState,
	DesktopAppErrorState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_INTERACTIVE, DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	extractApiErrorMessage,
	ImcResearchResultMarkdown,
	SectionPanel,
	type AmkaRun,
	type AmkaRunListResponse,
} from '@/services/amka/marketingCabinetAmkaBridge';
import {
	amkaRunStatusClass,
	formatShortDate,
} from '@/features/amka/amkaViewUtils';
import { cn } from '@/utils/cn';

type RunsQueryState = {
	isLoading: boolean;
	isError: boolean;
	error: unknown;
	refetch: () => void;
	data?: AmkaRunListResponse;
};

type AmkaRunHistoryPanelProps = {
	runsQuery: RunsQueryState;
	runs: AmkaRun[];
	selectedRunId: string | null;
	preferRunIdRef: MutableRefObject<string | null>;
	onSelectRun: (runId: string) => void;
};

export function AmkaRunHistoryPanel({
	runsQuery,
	runs,
	selectedRunId,
	preferRunIdRef,
	onSelectRun,
}: AmkaRunHistoryPanelProps) {
	const { t } = useTranslation('marketing');

	return (
		<SectionPanel
			title={t('amkaView.historyTitle')}
			description={t('amkaView.historyDescription')}
		>
			{runsQuery.isLoading ? (
				<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
					<ArrowPathIcon
						className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('amkaView.loadingRuns')}
				</div>
			) : runsQuery.isError ? (
				<DesktopAppErrorState
					message={
						<>
							<span className="block font-medium">
								{t('amkaView.loadError')}
							</span>
							<span className="mt-1 block text-(--desktop-text-muted)">
								{extractApiErrorMessage(
									runsQuery.error,
									t('amkaView.loadError')
								)}
							</span>
						</>
					}
					actionLabel={t('amkaView.retry')}
					onAction={() => void runsQuery.refetch()}
				/>
			) : runs.length === 0 ? (
				<DesktopAppEmptyState
					title={t('amkaView.emptyTitle')}
					description={t('amkaView.emptyDescription')}
				/>
			) : (
				<div className="space-y-2">
					{runs.map((run) => (
						<button
							key={run.id}
							type="button"
							onClick={() => {
								preferRunIdRef.current = null;
								onSelectRun(run.id);
							}}
							className={cn(
								'flex w-full flex-col gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 px-3 py-2.5 text-left transition-colors',
								DESKTOP_INTERACTIVE.btn,
								selectedRunId === run.id &&
									'border-(--desktop-border-strong) bg-(--desktop-surface-elevated)'
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-semibold text-(--desktop-text-primary)">
									{formatShortDate(run.created_at)}
								</span>
								<div className="flex flex-wrap items-center justify-end gap-1.5">
									{run.run_mode === 'auto' &&
									run.auto_cycle_total &&
									run.auto_cycle_total > 1 &&
									run.auto_cycle_index ? (
										<span className="rounded-full bg-(--desktop-surface-elevated) px-2 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary) ring-1 ring-(--desktop-border-subtle)">
											{t('amkaView.cycleBadge', {
												current: run.auto_cycle_index,
												total: run.auto_cycle_total,
											})}
										</span>
									) : null}
									{run.plan_source ? (
										<span className="rounded-full bg-(--desktop-surface-panel) px-2 py-0.5 text-[10px] font-medium text-(--desktop-text-muted) ring-1 ring-(--desktop-border-subtle)">
											{run.plan_source === 'llm'
												? t('amkaView.planSourceLlm')
												: run.plan_llm_status === 'heuristic_fallback'
													? t('amkaView.planSourceHeuristicFallback')
													: t('amkaView.planSourceHeuristic')}
										</span>
									) : null}
									<span
										className={cn(
											'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
											amkaRunStatusClass(run.status)
										)}
									>
										{t(`amkaView.status.${run.status}`)}
									</span>
								</div>
							</div>
							<p className="text-xs text-(--desktop-text-secondary)">
								{run.progress_message ||
									run.master_plan_summary ||
									t('amkaView.noSummary')}
							</p>
							<div className="h-1.5 rounded-full bg-(--desktop-surface-panel)">
								<div
									className="h-1.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.72)]"
									style={{ width: `${Math.max(4, run.progress)}%` }}
								/>
							</div>
						</button>
					))}
				</div>
			)}
			{runsQuery.data?.recent_runs_digest_markdown?.trim() ? (
				<details className="mt-3 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-3 py-2.5">
					<summary
						className="cursor-pointer list-none text-xs font-semibold text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden"
						aria-label={t('amkaView.spoilerRecentDigestAria')}
					>
						{t('amkaView.spoilerRecentDigestSummary')}
					</summary>
					<article className="mt-2 rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-2">
						<ImcResearchResultMarkdown
							markdown={runsQuery.data.recent_runs_digest_markdown}
						/>
					</article>
				</details>
			) : null}
		</SectionPanel>
	);
}
