/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memoized EWRP history list row with open/apply/retry/duplicate/delete actions.
 *
 * Invariants:
 * - Skips repaint on right-column status refresh if the row data is unchanged; per-action busy for a11y.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` barrel, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { cn } from '@/utils/cn';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { EwrpJobListItem } from '../../../services/ewrpApi';
import {
	buildEwrpHistoryRowEnergyLabels,
	type EwrpHistoryRowEnergyI18n,
} from '../ewrpHistoryRowEnergyLabels';
import { EwrpExpandableErrorText } from '../EwrpExpandableErrorText';
import { EwrpExpandableClampedText } from '../EwrpExpandableClampedText';
import { ewrpClampedTextNeedsExpand } from '../ewrpExpandableClampedText';
import { EwrpStatusPhaseChip } from '../EwrpStatusPhaseChip';
import { ewrpStatusLabel } from '../ewrpStatusPhaseIndicator';
import {
	ArrowPathIcon,
	ClipboardDocumentListIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { formatEwrpJobListDate } from './ewrpHistoryExportHelpers';
import { sw } from './EwrpFormChrome';

type HistoryRowProps = {
	row: EwrpJobListItem;
	isActive: boolean;
	shellInset: string;
	secondaryBtnClass: string;
	deletingHistoryId: string | null;
	applyingInputsId: string | null;
	duplicatingId: string | null;
	retryingId: string | null;
	onOpen: (id: string) => void;
	onApplyInputs: (id: string) => void;
	onDuplicate: (id: string) => void;
	onRetry: (id: string) => void;
	onDelete: (id: string, title: string | undefined) => void;
	/** false inside virtual list (wrapper is div role=listitem, not li). */
	asListItem?: boolean;
	/** Bottom spacing between cards in the virtual list. */
	rowSpacingClass?: string;
	/** From GET /ewrp/quote — aligns history ⚡ with server tariff. */
	creditsPerSlide?: number;
};

/** History row: skips repaint on right-column status refresh if the row data is unchanged. */
export const EwrpHistoryRow = memo(function EwrpHistoryRow({
	row,
	isActive,
	shellInset,
	secondaryBtnClass,
	deletingHistoryId,
	applyingInputsId,
	duplicatingId,
	retryingId,
	onOpen,
	onApplyInputs,
	onDuplicate,
	onRetry,
	onDelete,
	asListItem = true,
	rowSpacingClass,
	creditsPerSlide,
}: HistoryRowProps) {
	const { t } = useTranslation('ewrp');
	const energyI18n: EwrpHistoryRowEnergyI18n = {
		retryTitleFailed: (p) => t('form.retryTitleFailed', p),
		retryTitleStale: () => t('form.retryTitleStale'),
		retryEnergyFree: () => t('form.retryEnergyFree'),
		retryEnergyBilled: (p) => t('form.retryEnergyBilled', p),
		duplicateEnergyBilled: (p) => t('form.duplicateEnergyBilled', p),
		duplicateTitleWithEnergy: (p) => t('form.duplicateTitleWithEnergy', p),
	};
	const energyLabels = buildEwrpHistoryRowEnergyLabels(
		row,
		energyI18n,
		Date.now(),
		creditsPerSlide
	);
	const retryTitle = energyLabels.retryTitle ?? '';
	const retryEnergyLine = energyLabels.retryEnergyLine ?? '';
	const duplicateEnergyLine = energyLabels.duplicateEnergyLine ?? '';
	const duplicateTitle =
		energyLabels.duplicateTitle ?? t('form.duplicateTitle');
	const busy =
		applyingInputsId === row.id ||
		duplicatingId === row.id ||
		retryingId === row.id ||
		deletingHistoryId === row.id;
	const rootClass = cn(
		'rounded-xl px-3 py-2.5 transition-[border-color,box-shadow,background-color] duration-150',
		rowSpacingClass,
		isActive
			? 'border border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-(--desktop-surface-accent) shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.15)]'
			: cn(shellInset, 'hover:shadow-[0_4px_18px_rgba(0,0,0,0.14)]')
	);
	const displayTitle = row.title || t('historyList.untitled');
	const inner = (
		<div className="flex items-start justify-between gap-2">
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					{ewrpClampedTextNeedsExpand(displayTitle) ? (
						<EwrpExpandableClampedText
							text={displayTitle}
							tone="secondary"
							className="min-w-0 flex-1"
							textClassName="text-sm font-semibold text-(--desktop-text-primary)"
							expandLabelKey="historyList.titleExpand"
							collapseLabelKey="historyList.titleCollapse"
							maxLines={1}
						/>
					) : (
						<p
							className="min-w-0 truncate text-sm font-semibold text-(--desktop-text-primary)"
							title={`ID: ${row.id}`}
						>
							{displayTitle}
						</p>
					)}
					{isActive ? (
						<span className="inline-flex shrink-0 items-center rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
							{t('historyList.current')}
						</span>
					) : null}
				</div>
				{ewrpClampedTextNeedsExpand(row.topic) ? (
					<EwrpExpandableClampedText
						text={row.topic}
						tone="secondary"
						className="mt-0.5"
					/>
				) : (
					<p className="mt-0.5 text-xs text-(--desktop-text-secondary)">
						{row.topic}
					</p>
				)}
				{row.status === 'failed' && row.error_message ? (
					<EwrpExpandableErrorText message={row.error_message} />
				) : null}
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-(--desktop-text-dim)'
					)}
				>
					<EwrpStatusPhaseChip
						status={row.status}
						updatedAt={row.updated_at}
						size="sm"
						title={ewrpStatusLabel(row.status)}
					/>
					<span className="tabular-nums">
						{t('historyList.slideCount', { count: row.num_slides })}
					</span>
					{row.created_at ? (
						<>
							<span aria-hidden>·</span>
							<span className="tabular-nums">
								{formatEwrpJobListDate(row.created_at)}
							</span>
						</>
					) : null}
				</p>
			</div>
			<div
				className="flex max-w-full shrink-0 flex-col gap-1.5 sm:max-w-[min(100%,14rem)] sm:items-end"
				aria-busy={busy || undefined}
			>
				<div className="flex flex-wrap justify-end gap-1">
					<button
						type="button"
						onClick={() => void onOpen(row.id)}
						disabled={busy}
						aria-label={
							isActive ? t('historyList.openActive') : t('historyList.open')
						}
						className={cn(
							secondaryBtnClass,
							'shrink-0 px-2 py-1.5 text-[11px]'
						)}
					>
						{t('historyList.open')}
					</button>
					<button
						type="button"
						onClick={() => void onApplyInputs(row.id)}
						disabled={busy}
						aria-busy={applyingInputsId === row.id || undefined}
						title={t('form.applyInputsTitle')}
						className={cn(
							secondaryBtnClass,
							'shrink-0 px-2 py-1.5 text-[11px]'
						)}
					>
						{applyingInputsId === row.id ? (
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
					{energyLabels.showRetry ? (
						<button
							type="button"
							onClick={() => void onRetry(row.id)}
							disabled={busy}
							aria-busy={retryingId === row.id || undefined}
							title={retryTitle}
							className={cn(
								secondaryBtnClass,
								'flex shrink-0 flex-col gap-0.5 border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-200/95'
							)}
						>
							<span className="flex items-center justify-center gap-1.5">
								{retryingId === row.id ? (
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
								{retryEnergyLine}
							</span>
						</button>
					) : null}
					{energyLabels.showDuplicate ? (
						<button
							type="button"
							onClick={() => void onDuplicate(row.id)}
							disabled={busy}
							aria-busy={duplicatingId === row.id || undefined}
							title={duplicateTitle}
							className={cn(
								secondaryBtnClass,
								'flex shrink-0 flex-col gap-0.5 border-[rgb(var(--desktop-accent-rgb)/0.28)] px-2 py-1.5 text-[11px]'
							)}
						>
							<span className="flex items-center justify-center gap-1.5">
								{duplicatingId === row.id ? (
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
								{duplicateEnergyLine}
							</span>
						</button>
					) : null}
				</div>
				<button
					type="button"
					onClick={() => void onDelete(row.id, row.title)}
					disabled={deletingHistoryId === row.id || busy}
					aria-busy={deletingHistoryId === row.id || undefined}
					className={cn(
						secondaryBtnClass,
						'shrink-0 border-red-500/35 text-red-400 hover:bg-red-950/25'
					)}
				>
					{deletingHistoryId === row.id ? (
						<ArrowPathIcon
							className="h-3.5 w-3.5 animate-spin"
							strokeWidth={sw}
						/>
					) : (
						<TrashIcon className="h-3.5 w-3.5" strokeWidth={sw} />
					)}
					{t('historyList.delete')}
				</button>
			</div>
		</div>
	);
	if (asListItem) {
		return (
			<li className={rootClass} aria-busy={busy || undefined}>
				{inner}
			</li>
		);
	}
	return (
		<div className={rootClass} aria-busy={busy || undefined}>
			{inner}
		</div>
	);
});
