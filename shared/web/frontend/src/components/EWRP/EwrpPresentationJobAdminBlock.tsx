/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Job metadata and admin actions (ID, chips, extra context, retry/duplicate) for EWRP presentations tab.
 *
 * Invariants:
 * - Presentational only; parent owns mutations and busy state.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpCollapsibleSection.tsx`
 */

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	CheckIcon,
	ClipboardDocumentListIcon,
	DocumentDuplicateIcon,
	DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { EwrpStatusResponse } from '../../services/ewrpApi';
import { EwrpExpandableClampedText } from './EwrpExpandableClampedText';
import { formatEwrpJobListDate, sw } from './EwrpGeneratorChunks';
import type { EwrpHistoryRowEnergyLabels } from './ewrpHistoryRowEnergyLabels';

export type EwrpPresentationJobAdminBlockProps = {
	jobId: string;
	status: EwrpStatusResponse;
	statusMetaSlideCount: number | null;
	statusMetaThemeLabel: string | null;
	statusSourceLabel: string | null;
	statusSourcePending: boolean;
	statusExtraContextText: string | null;
	statusActionLabels: EwrpHistoryRowEnergyLabels | null;
	statusActionsBusy: boolean;
	jobIdExpanded: boolean;
	jobIdCopied: boolean;
	applyingInputsId: string | null;
	duplicatingId: string | null;
	retryingId: string | null;
	secondaryBtnClass: string;
	onCopyJobId: () => void | Promise<void>;
	onToggleJobIdExpanded: () => void;
	onApplyInputs: () => void;
	onRetry: () => void;
	onDuplicate: () => void;
};

export function EwrpPresentationJobAdminBlock({
	jobId,
	status,
	statusMetaSlideCount,
	statusMetaThemeLabel,
	statusSourceLabel,
	statusSourcePending,
	statusExtraContextText,
	statusActionLabels,
	statusActionsBusy,
	jobIdExpanded,
	jobIdCopied,
	applyingInputsId,
	duplicatingId,
	retryingId,
	secondaryBtnClass,
	onCopyJobId,
	onToggleJobIdExpanded,
	onApplyInputs,
	onRetry,
	onDuplicate,
}: EwrpPresentationJobAdminBlockProps) {
	const { t } = useTranslation('ewrp');

	return (
		<>
			<div className="flex min-w-0 flex-col gap-2 rounded-xl border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/35 px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					<span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
						ID
					</span>
					<code
						className={cn(
							'min-w-0 flex-1 font-mono text-[11px] text-(--desktop-text-secondary) tabular-nums',
							!jobIdExpanded && 'truncate'
						)}
						title={jobId}
					>
						{jobId}
					</code>
					<button
						type="button"
						onClick={() => void onCopyJobId()}
						className={cn(
							'shrink-0 rounded-lg p-1.5 text-(--desktop-text-muted) transition-colors',
							'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						title={t('form.jobIdCopyTitle')}
						aria-label={
							jobIdCopied ? t('form.jobIdCopiedAria') : t('form.jobIdCopyAria')
						}
					>
						{jobIdCopied ? (
							<CheckIcon
								className="h-3.5 w-3.5 text-emerald-400"
								strokeWidth={sw}
							/>
						) : (
							<DocumentDuplicateIcon className="h-3.5 w-3.5" strokeWidth={sw} />
						)}
					</button>
				</div>
				{jobId.length > 24 ? (
					<button
						type="button"
						className={cn(
							'self-start text-[11px] font-medium text-(--desktop-text-dim) underline-offset-2 hover:text-(--desktop-text-secondary) hover:underline',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-expanded={jobIdExpanded}
						onClick={onToggleJobIdExpanded}
					>
						{jobIdExpanded ? t('form.jobIdCollapse') : t('form.jobIdExpand')}
					</button>
				) : null}
			</div>
			{statusMetaSlideCount ||
			status?.updated_at ||
			statusMetaThemeLabel ||
			statusSourceLabel ||
			statusSourcePending ? (
				<div className="flex flex-wrap items-center gap-1.5">
					{statusMetaSlideCount ? (
						<span className="inline-flex items-center rounded-full border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/55 px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-(--desktop-text-secondary)">
							{t('form.statusMetaSlides', { count: statusMetaSlideCount })}
						</span>
					) : null}
					{status?.updated_at ? (
						<span className="inline-flex items-center rounded-full border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/55 px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-(--desktop-text-secondary)">
							{t('form.statusMetaUpdated', {
								date: formatEwrpJobListDate(status.updated_at),
							})}
						</span>
					) : null}
					{statusMetaThemeLabel ? (
						<span className="inline-flex max-w-full items-center rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-2.5 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)">
							<span className="truncate">
								{t('form.statusMetaTheme', { theme: statusMetaThemeLabel })}
							</span>
						</span>
					) : null}
					{statusSourcePending ? (
						<span
							className="inline-flex max-w-full items-center gap-1 rounded-full border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/55 px-2.5 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)"
							aria-busy
						>
							<ArrowPathIcon
								className="h-3 w-3 shrink-0 animate-spin text-(--desktop-text-dim)"
								strokeWidth={sw}
								aria-hidden
							/>
							<span className="truncate">
								{t('form.statusMetaSourceLoading')}
							</span>
						</span>
					) : statusSourceLabel ? (
						<span
							className="inline-flex max-w-full items-center gap-1 rounded-full border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/55 px-2.5 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)"
							title={statusSourceLabel}
						>
							<DocumentTextIcon
								className="h-3 w-3 shrink-0 text-(--desktop-text-dim)"
								strokeWidth={sw}
								aria-hidden
							/>
							<span className="truncate">
								{t('form.statusMetaSource', { name: statusSourceLabel })}
							</span>
						</span>
					) : null}
				</div>
			) : null}
			{statusExtraContextText ? (
				<div className="rounded-xl border border-(--desktop-border-subtle)/55 bg-(--desktop-surface-soft)/30 px-3 py-2.5">
					<p className="text-[10px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
						{t('form.statusExtraContextLabel')}
					</p>
					<EwrpExpandableClampedText
						text={statusExtraContextText}
						tone="secondary"
						className="mt-1"
						textClassName="text-xs leading-relaxed text-(--desktop-text-secondary)"
						expandLabelKey="form.statusExtraContextExpand"
						collapseLabelKey="form.statusExtraContextCollapse"
					/>
				</div>
			) : null}
			<div
				className="flex flex-wrap gap-2 border-b border-(--desktop-border-subtle)/40 pb-3"
				aria-busy={statusActionsBusy || undefined}
			>
				<button
					type="button"
					onClick={onApplyInputs}
					disabled={
						applyingInputsId != null ||
						duplicatingId !== null ||
						retryingId !== null
					}
					aria-busy={applyingInputsId === jobId || undefined}
					className={cn(
						secondaryBtnClass,
						'border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-(--desktop-surface-accent)/50 text-[11px]'
					)}
					title={t('form.applyInputsTitle')}
				>
					{applyingInputsId === jobId ? (
						<ArrowPathIcon
							className="h-3.5 w-3.5 animate-spin"
							strokeWidth={sw}
						/>
					) : (
						<ClipboardDocumentListIcon
							className="h-3.5 w-3.5"
							strokeWidth={sw}
						/>
					)}
					{t('form.applyInputsButton')}
				</button>
				{statusActionLabels?.showRetry ? (
					<button
						type="button"
						onClick={onRetry}
						disabled={retryingId === jobId}
						aria-busy={retryingId === jobId || undefined}
						className={cn(
							secondaryBtnClass,
							'flex flex-col gap-0.5 border-emerald-500/35 bg-emerald-500/10 text-[11px] text-emerald-200/95'
						)}
						title={statusActionLabels.retryTitle ?? ''}
					>
						<span className="flex items-center justify-center gap-1.5">
							{retryingId === jobId ? (
								<ArrowPathIcon
									className="h-3.5 w-3.5 animate-spin"
									strokeWidth={sw}
								/>
							) : (
								<ArrowPathIcon className="h-3.5 w-3.5" strokeWidth={sw} />
							)}
							{t('form.retryGeneration')}
						</span>
						<span className="text-[10px] font-normal tabular-nums leading-tight opacity-90">
							{statusActionLabels.retryEnergyLine}
						</span>
					</button>
				) : null}
				{statusActionLabels?.showDuplicate ? (
					<button
						type="button"
						onClick={onDuplicate}
						disabled={duplicatingId === jobId || retryingId === jobId}
						aria-busy={duplicatingId === jobId || undefined}
						className={cn(
							secondaryBtnClass,
							'flex flex-col gap-0.5 border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] text-[11px]'
						)}
						title={
							statusActionLabels.duplicateTitle ?? t('form.duplicateTitle')
						}
					>
						<span className="flex items-center justify-center gap-1.5">
							{duplicatingId === jobId ? (
								<ArrowPathIcon
									className="h-3.5 w-3.5 animate-spin"
									strokeWidth={sw}
								/>
							) : (
								<ArrowPathIcon className="h-3.5 w-3.5" strokeWidth={sw} />
							)}
							{t('form.duplicateAgain')}
						</span>
						<span className="text-[10px] font-normal tabular-nums leading-tight opacity-90">
							{statusActionLabels.duplicateEnergyLine}
						</span>
					</button>
				) : null}
			</div>
		</>
	);
}
