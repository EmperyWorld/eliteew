/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memoized EWRP slide outline row for the presentations status column.
 *
 * Invariants:
 * - Long lists avoid repainting the whole column on status changes via memo.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` barrel, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { useTranslation } from 'react-i18next';
import { memo } from 'react';
import type { EwrpSlide } from '../../../services/ewrpApi';
import { EwrpExpandableClampedText } from '../EwrpExpandableClampedText';
import { ewrpClampedTextNeedsExpand } from '../ewrpExpandableClampedText';
import { EwrpSlideImagePreview } from '../EwrpSlideImagePreview';
import { ewrpShouldFetchSlideImage } from '../ewrpSlideImageReadiness';
import {
	EWRP_SLIDE_LAYOUT_VALUES,
	ewrpSlideLayoutI18nKey,
} from './ewrpGeneratorConstants';

type SlideOutlineRowProps = {
	index: number;
	slide: EwrpSlide;
	jobId?: string | null;
};

/** Isolated outline row — long lists avoid repainting the whole column on status changes. */
export const EwrpSlideOutlineRow = memo(function EwrpSlideOutlineRow({
	index,
	slide,
	jobId,
}: SlideOutlineRowProps) {
	const { t } = useTranslation('ewrp');
	const fallback = t('outline.slideTitle', { n: index + 1 });
	const rawLayout = slide.layout ?? '';
	const layoutKnown =
		rawLayout === '' ||
		(EWRP_SLIDE_LAYOUT_VALUES as readonly string[]).includes(rawLayout);
	const layoutLabel =
		index > 0 && rawLayout
			? layoutKnown
				? t(`slideLayouts.${ewrpSlideLayoutI18nKey(rawLayout)}`)
				: rawLayout
			: null;
	const titleText = slide.title || fallback;
	const bulletsText =
		slide.bullets && slide.bullets.length > 0
			? slide.bullets.join(' • ')
			: null;
	return (
		<li className="px-2 py-2.5 transition-colors duration-150 last:rounded-b-xl hover:bg-(--desktop-surface-soft-hover)/60 sm:px-3">
			<div className="flex items-start gap-3">
				<span
					className="mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-[11px] font-bold tabular-nums text-(--desktop-text-secondary) ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.2)]"
					aria-hidden
				>
					{index + 1}
				</span>
				<div className="flex min-w-0 flex-1 items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						{ewrpClampedTextNeedsExpand(titleText) ? (
							<EwrpExpandableClampedText
								text={titleText}
								tone="secondary"
								className="mt-0"
								textClassName="text-sm font-semibold leading-snug text-(--desktop-text-primary)"
								expandLabelKey="outline.detailExpand"
								collapseLabelKey="outline.detailCollapse"
							/>
						) : (
							<p className="font-semibold leading-snug text-(--desktop-text-primary)">
								{titleText}
							</p>
						)}
						{bulletsText ? (
							ewrpClampedTextNeedsExpand(bulletsText) ? (
								<EwrpExpandableClampedText
									text={bulletsText}
									tone="secondary"
									className="mt-1"
									expandLabelKey="outline.detailExpand"
									collapseLabelKey="outline.detailCollapse"
								/>
							) : (
								<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-secondary)">
									{bulletsText}
								</p>
							)
						) : null}
					</div>
					<div className="flex shrink-0 flex-col items-end gap-1">
						{ewrpShouldFetchSlideImage(jobId, slide) ? (
							<EwrpSlideImagePreview
								jobId={jobId}
								slideIndex={index}
								compact
								alt={titleText}
							/>
						) : slide.image_filename ? (
							<span className="rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-(--desktop-surface-accent) px-2 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)">
								IMG
							</span>
						) : null}
						{layoutLabel ? (
							<span
								className="max-w-40 truncate rounded-md border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-(--desktop-text-muted)"
								title={layoutLabel}
							>
								{layoutLabel}
							</span>
						) : null}
					</div>
				</div>
			</div>
		</li>
	);
});
