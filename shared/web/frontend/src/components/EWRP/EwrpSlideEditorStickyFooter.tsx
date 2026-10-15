/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky action bar at the bottom of the EWRP slide editor (add slide, billing hint, save/cancel, PDF preview).
 *
 * Invariants:
 * - Save respects rebuild busy state; parent handles multi-UGS confirm before persist.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpPresentationsMiniStatusBar.tsx`
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	PlusIcon,
	PresentationChartBarIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { EWRP_LEGACY_CREDITS_PER_SLIDE, sw } from './EwrpGeneratorChunks';

export type EwrpSlideEditorStickyFooterProps = {
	slideCount: number;
	maxSlides: number;
	draftIsDirty: boolean;
	saving: boolean;
	slideRebuildInProgress: boolean;
	estimatedSlidesNeedingNewUgs: number;
	estimatedNewImagesEnergy: number;
	showPdfPreview: boolean;
	onAddSlide: () => void;
	onCancel: () => void;
	onSave: () => void;
	onPreviewPdf?: () => void;
	secondaryBtnClass: string;
	primaryBtnClass: string;
	className?: string;
};

/** Always-visible editor actions while the slide list scrolls above. */
export function EwrpSlideEditorStickyFooter({
	slideCount,
	maxSlides,
	draftIsDirty,
	saving,
	slideRebuildInProgress,
	estimatedSlidesNeedingNewUgs,
	estimatedNewImagesEnergy,
	showPdfPreview,
	onAddSlide,
	onCancel,
	onSave,
	onPreviewPdf,
	secondaryBtnClass,
	primaryBtnClass,
	className,
}: EwrpSlideEditorStickyFooterProps) {
	const { t } = useTranslation('ewrp');
	const addDisabled = slideCount >= maxSlides;
	const actionsBusy = saving || slideRebuildInProgress;

	return (
		<section
			className={cn(
				'shrink-0 border-t border-(--desktop-border-subtle)/60 bg-(--desktop-surface-panel)/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm',
				className
			)}
			aria-label={t('form.editorStickyFooterAria')}
			aria-busy={actionsBusy || undefined}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<button
					type="button"
					onClick={onAddSlide}
					disabled={addDisabled}
					className={cn(secondaryBtnClass, 'text-[11px]')}
					title={t('form.maxSlidesTitle', { max: maxSlides })}
				>
					<PlusIcon className="h-3.5 w-3.5" strokeWidth={sw} />
					{t('form.addSlide')}
				</button>
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'tabular-nums text-(--desktop-text-dim)'
					)}
				>
					{slideCount} / {maxSlides}
				</span>
			</div>
			<div className="mt-2 space-y-2">
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'flex flex-wrap items-center gap-x-2 gap-y-1 text-(--desktop-text-dim)'
					)}
				>
					<span>{t('form.rebuildPdfCaption')}</span>
					<span className="line-through tabular-nums text-(--desktop-text-muted)">
						{`${slideCount * EWRP_LEGACY_CREDITS_PER_SLIDE} ⚡`}
					</span>
					<span className="text-(--desktop-text-dim)">→</span>
					<span className="font-semibold tabular-nums text-emerald-400/95">
						0 ⚡
					</span>
				</p>
				{estimatedSlidesNeedingNewUgs > 0 ? (
					<p className={cn(DESKTOP_TYPOGRAPHY.small, 'text-amber-200/90')}>
						{t('form.billingNewImagesEstimate', {
							count: estimatedSlidesNeedingNewUgs,
							energy: estimatedNewImagesEnergy,
						})}
					</p>
				) : null}
			</div>
			<div className="mt-3 flex flex-wrap items-center justify-end gap-2">
				{showPdfPreview && onPreviewPdf ? (
					<button
						type="button"
						onClick={onPreviewPdf}
						className={cn(
							secondaryBtnClass,
							'mr-auto gap-1.5 text-[11px] sm:mr-0'
						)}
					>
						<PresentationChartBarIcon
							className="h-3.5 w-3.5 shrink-0"
							strokeWidth={sw}
						/>
						{t('form.previewPdfWhileEditing')}
					</button>
				) : null}
				<button
					type="button"
					onClick={onCancel}
					disabled={actionsBusy}
					className={secondaryBtnClass}
				>
					{t('form.cancel')}
				</button>
				<button
					type="button"
					onClick={onSave}
					disabled={actionsBusy}
					aria-busy={saving || undefined}
					className={cn(
						primaryBtnClass,
						'inline-flex w-auto flex-row items-center gap-2 px-4 py-2.5 text-xs',
						draftIsDirty &&
							!actionsBusy &&
							'ring-2 ring-amber-400/35 ring-offset-1 ring-offset-transparent'
					)}
					title={t('form.editorMiniStatusSaveTitle')}
				>
					{saving ? (
						<ArrowPathIcon
							className="h-3.5 w-3.5 shrink-0 animate-spin"
							strokeWidth={sw}
						/>
					) : null}
					<span>
						{saving ? t('form.savePdfRunning') : t('form.savePdfIdle')}
					</span>
				</button>
			</div>
		</section>
	);
}
