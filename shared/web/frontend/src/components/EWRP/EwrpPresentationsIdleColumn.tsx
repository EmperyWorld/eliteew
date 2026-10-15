/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Idle Presentations column when no status payload: poll error/skeleton, history load error, loading, and empty CTAs.
 *
 * Invariants:
 * - Props-driven presentational extract — no local orchestration SoT.
 * - Parent `EwrpPresentationsTabPanel` remains the Presentations tab orchestrator.
 *
 * Related:
 * - `EwrpPresentationsTabPanel.tsx`
 * - `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 * - `documentation/product/EWRP-EDITOR.md`
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import type { Dispatch, SetStateAction } from 'react';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { EwrpJobListItem } from '../../services/ewrpApi';
import { sw } from './EwrpGeneratorChunks';
import { EwrpInlineErrorAlert } from './EwrpInlineErrorAlert';
import { EwrpStatusColumnSkeleton } from './EwrpStatusColumnSkeleton';
import {
	ArrowPathIcon,
	ClockIcon,
	PresentationChartBarIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';

export type EwrpPresentationsIdleColumnProps = {
	shellPanel: string;
	secondaryBtnClass: string;
	primaryBtnClass: string;
	jobId: string | null;
	statusPollError: string | null;
	setStatusPollError: Dispatch<SetStateAction<string | null>>;
	setStatusManualPollPending: Dispatch<SetStateAction<boolean>>;
	statusManualPollPending: boolean;
	pollStatus: (id: string) => Promise<unknown>;
	historyError: string | null;
	historyJobs: EwrpJobListItem[];
	historyLoading: boolean;
	refreshHistory: () => void | Promise<void>;
	setMainTab: Dispatch<SetStateAction<'generate' | 'presentations'>>;
	setIsHistoryModalOpen: Dispatch<SetStateAction<boolean>>;
};

export function EwrpPresentationsIdleColumn(
	props: EwrpPresentationsIdleColumnProps
) {
	const { t } = useTranslation('ewrp');
	const {
		shellPanel,
		secondaryBtnClass,
		primaryBtnClass,
		jobId,
		statusPollError,
		setStatusPollError,
		setStatusManualPollPending,
		statusManualPollPending,
		pollStatus,
		historyError,
		historyJobs,
		historyLoading,
		refreshHistory,
		setMainTab,
		setIsHistoryModalOpen,
	} = props;

	return jobId ? (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
			{statusPollError ? (
				<EwrpInlineErrorAlert
					message={statusPollError}
					retryLabel={t('form.statusLoadRetry')}
					onRetry={() => {
						if (!jobId) return;
						setStatusPollError(null);
						setStatusManualPollPending(true);
						void pollStatus(jobId).finally(() => {
							setStatusManualPollPending(false);
						});
					}}
					retryLoading={statusManualPollPending}
				/>
			) : (
				<EwrpStatusColumnSkeleton />
			)}
		</div>
	) : historyError && historyJobs.length === 0 ? (
		<div
			className={cn(
				shellPanel,
				'flex min-h-[280px] flex-1 flex-col items-center justify-center gap-4 px-6 text-center',
				'bg-linear-to-b from-[rgb(var(--desktop-accent-rgb)/0.08)] via-transparent to-transparent',
				'ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.08)]'
			)}
		>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.body,
					'font-semibold text-(--desktop-text-primary)'
				)}
			>
				{t('form.presentationsEmptyTitle')}
			</p>
			<EwrpInlineErrorAlert
				message={historyError}
				retryLabel={t('form.historyRetryLoad')}
				onRetry={() => void refreshHistory()}
				retryLoading={historyLoading}
				retryButtonClassName={cn(
					secondaryBtnClass,
					'self-center gap-2 text-[11px]'
				)}
			/>
			<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
				<button
					type="button"
					onClick={() => setMainTab('generate')}
					className={cn(primaryBtnClass, 'gap-2 text-[11px]')}
				>
					<SparklesIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
					{t('form.presentationsEmptyNewButton')}
				</button>
				<button
					type="button"
					onClick={() => setIsHistoryModalOpen(true)}
					className={cn(secondaryBtnClass, 'gap-2 text-[11px]')}
				>
					<ClockIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
					{t('form.historyOpenModal')}
				</button>
			</div>
		</div>
	) : historyLoading && historyJobs.length === 0 ? (
		<div
			className={cn(
				shellPanel,
				'flex min-h-[280px] flex-1 flex-col items-center justify-center gap-3 px-6 text-center',
				'bg-linear-to-b from-[rgb(var(--desktop-accent-rgb)/0.08)] via-transparent to-transparent',
				'ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.08)]'
			)}
			role="status"
			aria-busy
			aria-live="polite"
		>
			<ArrowPathIcon
				className="h-8 w-8 animate-spin text-[rgb(var(--desktop-accent-rgb)/0.75)]"
				strokeWidth={sw}
				aria-hidden
			/>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.body,
					'font-semibold text-(--desktop-text-primary)'
				)}
			>
				{t('form.presentationsEmptyLoading')}
			</p>
		</div>
	) : (
		<div
			className={cn(
				shellPanel,
				'flex min-h-[280px] flex-1 flex-col items-center justify-center text-center px-6',
				'bg-linear-to-b from-[rgb(var(--desktop-accent-rgb)/0.08)] via-transparent to-transparent',
				'ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.08)]'
			)}
		>
			<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgb(var(--desktop-accent-rgb)/0.1)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.18)]">
				<PresentationChartBarIcon
					className="h-9 w-9 text-[rgb(var(--desktop-accent-rgb)/0.55)]"
					strokeWidth={sw}
				/>
			</div>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.body,
					'font-semibold text-(--desktop-text-primary)'
				)}
			>
				{t('form.presentationsEmptyTitle')}
			</p>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.meta,
					'mt-2 max-w-md leading-relaxed text-(--desktop-text-secondary)'
				)}
			>
				{t('form.presentationsEmptyBody')}
			</p>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.meta,
					'mt-3 max-w-md text-(--desktop-text-dim)'
				)}
			>
				{historyJobs.length > 0
					? t('form.presentationsEmptyHistoryAvailable', {
							count: historyJobs.length,
						})
					: t('form.presentationsEmptyHint')}
			</p>
			<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
				<button
					type="button"
					onClick={() => setMainTab('generate')}
					className={cn(primaryBtnClass, 'gap-2 text-[11px]')}
				>
					<SparklesIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
					{t('form.presentationsEmptyNewButton')}
				</button>
				<button
					type="button"
					onClick={() => setIsHistoryModalOpen(true)}
					className={cn(secondaryBtnClass, 'gap-2 text-[11px]')}
				>
					<ClockIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
					{t('form.historyOpenModal')}
					{historyJobs.length > 0 ? (
						<span className="rounded-md bg-(--desktop-surface-soft) px-1.5 py-px text-[10px] font-semibold tabular-nums text-(--desktop-text-dim)">
							{historyJobs.length}
						</span>
					) : null}
				</button>
			</div>
		</div>
	);
}
