/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mini thumbnail for a slide in the presentation editor slide list sidebar.
 *
 * Invariants:
 * - Falls back to slide index when no image or title is present.
 *
 * Related:
 * - presentationEdit/presentationDomCssVars.ts
 * - PresentationEditPage.tsx
 */

import type { PresentationSlide } from '@services/api/presentations';
import { getUploadedImageUrl } from '@utils/imageUrl';
import { useLayoutEffect, useRef } from 'react';
import { assignDomCssVars } from './presentationDomCssVars';

export type PresentationEditSlideListThumbnailProps = {
	slide: PresentationSlide;
	actualIndex: number;
};

export function PresentationEditSlideListThumbnail({
	slide,
	actualIndex,
}: PresentationEditSlideListThumbnailProps) {
	const thumbRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);

	useLayoutEffect(() => {
		const el = thumbRef.current;
		if (!el) return;
		assignDomCssVars(el, {
			'--thumbnail-bg-color': slide.backgroundColor || '#ffffff',
			'--thumbnail-bg-gradient': slide.backgroundGradient || undefined,
		});
		el.classList.toggle('has-gradient', Boolean(slide.backgroundGradient));
	}, [slide.backgroundColor, slide.backgroundGradient]);

	useLayoutEffect(() => {
		assignDomCssVars(textRef.current, {
			'--thumbnail-text-color': slide.textColor || '#000000',
		});
	}, [slide.textColor]);

	return (
		<div
			ref={thumbRef}
			className="shrink-0 w-16 h-12 rounded-lg border border-neutral-200 dark:border-slate-700 overflow-hidden slide-thumbnail"
		>
			{slide.image ? (
				<img
					src={getUploadedImageUrl(slide.image)}
					alt=""
					className="w-full h-full object-cover"
					onError={(e) => {
						(e.target as HTMLImageElement).style.display = 'none';
					}}
				/>
			) : slide.title ? (
				<div className="w-full h-full flex items-center justify-center p-1">
					<span
						ref={textRef}
						className="text-xs font-bold truncate slide-thumbnail-text"
					>
						{slide.title.charAt(0).toUpperCase()}
					</span>
				</div>
			) : (
				<div className="w-full h-full flex items-center justify-center">
					<span className="text-xs text-neutral-400 dark:text-slate-500">
						{actualIndex + 1}
					</span>
				</div>
			)}
		</div>
	);
}
