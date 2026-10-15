/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-only slides outline (copy/export) and not-ready / failed empty states for the
 * EWRP Presentations status column outside edit mode.
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
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { EwrpStatusResponse } from '../../services/ewrpApi';
import { sw, EwrpSlideOutlineRow } from './EwrpGeneratorChunks';
import { EwrpStatusPhaseChip } from './EwrpStatusPhaseChip';
import {
	ArrowDownTrayIcon,
	DocumentDuplicateIcon,
	ExclamationTriangleIcon,
	PresentationChartBarIcon,
} from '@heroicons/react/24/outline';

export type EwrpPresentationsStatusOutlineProps = {
	isEditing: boolean;
	status: EwrpStatusResponse;
	jobId: string | null;
	shellPanel: string;
	shellInset: string;
	secondaryBtnClass: string;
	slidesListKey: string;
	copyDone: boolean;
	handleCopyOutline: () => void | Promise<void>;
	handleExportOutlineMarkdown: () => void;
};

export function EwrpPresentationsStatusOutline({
	isEditing,
	status,
	jobId,
	shellPanel,
	shellInset,
	secondaryBtnClass,
	slidesListKey,
	copyDone,
	handleCopyOutline,
	handleExportOutlineMarkdown,
}: EwrpPresentationsStatusOutlineProps) {
	const { t } = useTranslation('ewrp');

	return (
		<div className={cn('flex shrink-0 flex-col')}>
			{!isEditing &&
				Array.isArray(status.slides) &&
				status.slides.length > 0 && (
					<>
						<div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
							<p className="flex items-baseline gap-2">
								<span className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
									{t('form.slidesHeading')}
								</span>
								<span className="text-lg font-semibold tabular-nums text-(--desktop-text-primary)">
									{status.slides.length}
								</span>
							</p>
							{!isEditing &&
							Array.isArray(status.slides) &&
							status.slides.length > 0 ? (
								<div className="flex flex-wrap items-center justify-end gap-2">
									<button
										type="button"
										onClick={() => void handleCopyOutline()}
										className={cn(
											secondaryBtnClass,
											copyDone && 'border-emerald-500/35 text-emerald-200/95'
										)}
									>
										<DocumentDuplicateIcon
											className="h-3.5 w-3.5"
											strokeWidth={sw}
										/>
										{copyDone
											? t('form.copyOutlineCopied')
											: t('form.copyOutlineIdle')}
									</button>
									<button
										type="button"
										onClick={handleExportOutlineMarkdown}
										className={cn(secondaryBtnClass, 'text-[11px]')}
										title={t('form.exportMdTitle')}
									>
										<ArrowDownTrayIcon
											className="h-3.5 w-3.5"
											strokeWidth={sw}
										/>
										.md
									</button>
								</div>
							) : null}
						</div>
						{!isEditing && (
							<div
								className={cn(
									shellPanel,
									'mt-3 min-h-0 flex-1 overflow-hidden rounded-xl ring-1 ring-black/4'
								)}
							>
								<div className="border-b border-(--desktop-border-subtle) bg-[linear-gradient(180deg,rgb(var(--desktop-accent-rgb)/0.1)_0%,rgb(var(--desktop-accent-rgb)/0.04)_100%)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
									{t('form.draftStructureTitle')}
								</div>
								<ul className="divide-y divide-(--desktop-border-subtle) text-xs [contain-intrinsic-size:auto_3rem] [content-visibility:auto]">
									{status.slides.map((slide, idx) => (
										<EwrpSlideOutlineRow
											// biome-ignore lint/suspicious/noArrayIndexKey: API slides have no stable id; draft order is fixed
											key={`${slidesListKey}-${idx}`}
											index={idx}
											slide={slide}
											jobId={jobId}
										/>
									))}
								</ul>
							</div>
						)}
					</>
				)}
			{status &&
				status.status !== 'failed' &&
				(!Array.isArray(status.slides) || status.slides.length === 0) && (
					<div
						className={cn(
							shellInset,
							'mt-4 rounded-2xl border-dashed px-4 py-7 text-center',
							DESKTOP_TYPOGRAPHY.body
						)}
					>
						<div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--desktop-accent-rgb)/0.08)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.15)]">
							<PresentationChartBarIcon
								className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.65)]"
								strokeWidth={sw}
								aria-hidden
							/>
						</div>
						<p className="font-semibold text-(--desktop-text-secondary)">
							{t('form.slidesNotReadyTitle')}
						</p>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'mt-2 leading-relaxed text-(--desktop-text-dim)'
							)}
						>
							{t('form.slidesNotReadyBody')}
						</p>
						{status ? (
							<EwrpStatusPhaseChip
								status={status.status}
								updatedAt={status.updated_at}
								size="sm"
							/>
						) : null}
					</div>
				)}
			{status.status === 'failed' &&
				(!Array.isArray(status.slides) || status.slides.length === 0) && (
					<div
						className={cn(
							shellInset,
							'mt-4 rounded-2xl border border-red-500/35 bg-red-950/15 px-4 py-7 text-center',
							DESKTOP_TYPOGRAPHY.body
						)}
						role="status"
					>
						<div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/25">
							<ExclamationTriangleIcon
								className="h-5 w-5 text-red-300"
								strokeWidth={sw}
								aria-hidden
							/>
						</div>
						<p className="font-semibold text-red-100/95">
							{t('form.failedNoSlidesTitle')}
						</p>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'mt-2 leading-relaxed text-red-200/85'
							)}
						>
							{t('form.failedNoSlidesBody')}
						</p>
					</div>
				)}
		</div>
	);
}
