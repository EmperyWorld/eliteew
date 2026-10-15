/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Slide preview panel with fullscreen mode and CSS-var layout effects.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationDomCssVars.ts
 */

import { Button } from '@components/atoms/Button';
import type { PresentationSlide } from '@services/api/presentations';
import { getUploadedImageUrl } from '@utils/imageUrl';
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	ArrowsPointingInIcon,
	ArrowsPointingOutIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { assignDomCssVars } from './presentationDomCssVars';

export type PresentationEditSlidePreviewProps = {
	selectedSlide: PresentationSlide;
	slides: PresentationSlide[];
	isFullscreenPreview: boolean;
	previewSlideIndex: number;
	embeddedModalZ: { backdrop: number; content: number };
	onToggleFullscreen: () => void;
	onCloseFullscreen: () => void;
	onPreviewSlideIndexChange: (index: number) => void;
};

export function PresentationEditSlidePreview({
	selectedSlide,
	slides,
	isFullscreenPreview,
	previewSlideIndex,
	embeddedModalZ,
	onToggleFullscreen,
	onCloseFullscreen,
	onPreviewSlideIndexChange,
}: PresentationEditSlidePreviewProps) {
	const slidePreviewContainerRef = useRef<HTMLDivElement>(null);
	const slidePreviewTitleRef = useRef<HTMLHeadingElement>(null);
	const slidePreviewContentRef = useRef<HTMLParagraphElement>(null);

	const previewDisplaySlide = useMemo(() => {
		return isFullscreenPreview
			? slides[previewSlideIndex] || selectedSlide
			: selectedSlide;
	}, [isFullscreenPreview, previewSlideIndex, selectedSlide, slides]);

	useLayoutEffect(() => {
		const el = slidePreviewContainerRef.current;
		const slide = previewDisplaySlide;
		if (!el || !slide) return;
		assignDomCssVars(el, {
			'--preview-bg-color': slide.backgroundColor || '#ffffff',
			'--preview-text-color': slide.textColor || '#000000',
			'--preview-bg-gradient': slide.backgroundGradient || undefined,
			'--preview-content-align': slide.textAlign || 'left',
		});
		if (slide.backgroundGradient) {
			el.classList.add('has-gradient');
		} else {
			el.classList.remove('has-gradient');
		}
	}, [previewDisplaySlide]);

	useLayoutEffect(() => {
		const el = slidePreviewTitleRef.current;
		const slide = previewDisplaySlide;
		if (!el || !slide) return;
		assignDomCssVars(el, {
			'--preview-title-font-size': slide.titleFontSize || '2.5em',
			'--preview-title-color': slide.titleColor || slide.textColor || '#000000',
			'--preview-title-align': slide.titleAlign || 'center',
		});
	}, [previewDisplaySlide]);

	useLayoutEffect(() => {
		const el = slidePreviewContentRef.current;
		const slide = previewDisplaySlide;
		if (!el || !slide) return;
		assignDomCssVars(el, {
			'--preview-content-font-size': slide.contentFontSize || '1.1em',
			'--preview-content-color':
				slide.contentColor || slide.textColor || '#000000',
			'--preview-content-align': slide.textAlign || 'left',
			'--preview-line-height': slide.lineHeight || '1.6',
		});
	}, [previewDisplaySlide]);

	const displaySlide = previewDisplaySlide;

	return (
		<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
					Предпросмотр слайда
				</h2>
				<Button
					variant="ghost"
					size="sm"
					type="button"
					onClick={onToggleFullscreen}
					title="Полноэкранный предпросмотр (F)"
				>
					{isFullscreenPreview ? (
						<ArrowsPointingInIcon width={16} height={16} />
					) : (
						<ArrowsPointingOutIcon width={16} height={16} />
					)}
				</Button>
			</div>
			<div
				ref={slidePreviewContainerRef}
				className={`slide-preview-container ${
					isFullscreenPreview
						? 'fixed inset-0 rounded-none w-screen h-screen'
						: 'border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900'
				}`}
				style={
					isFullscreenPreview ? { zIndex: embeddedModalZ.content } : undefined
				}
			>
				{isFullscreenPreview && (
					<>
						<button
							type="button"
							onClick={onCloseFullscreen}
							className="absolute top-4 right-4 p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border border-neutral-200 dark:border-slate-700 z-10"
							title="Закрыть (Esc)"
						>
							<XMarkIcon width={20} height={20} />
						</button>
						<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 rounded-lg px-4 py-2 border border-neutral-200 dark:border-slate-700 z-10">
							<button
								type="button"
								onClick={() =>
									onPreviewSlideIndexChange(Math.max(0, previewSlideIndex - 1))
								}
								disabled={previewSlideIndex === 0}
								className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
								title="Предыдущий слайд (←)"
							>
								<ArrowLeftIcon width={18} height={18} />
							</button>
							<span className="text-sm font-medium text-neutral-700 dark:text-slate-300 min-w-[80px] text-center">
								{previewSlideIndex + 1} / {slides.length}
							</span>
							<button
								type="button"
								onClick={() =>
									onPreviewSlideIndexChange(
										Math.min(slides.length - 1, previewSlideIndex + 1)
									)
								}
								disabled={previewSlideIndex === slides.length - 1}
								className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
								title="Следующий слайд (→)"
							>
								<ArrowRightIcon width={18} height={18} />
							</button>
						</div>
					</>
				)}
				{displaySlide.layout === 'full-image' && displaySlide.image ? (
					<img
						src={getUploadedImageUrl(displaySlide.image)}
						alt={displaySlide.title || 'Slide'}
						className="w-full h-full object-cover rounded-lg"
					/>
				) : (
					<>
						{displaySlide.title && (
							<h3 ref={slidePreviewTitleRef} className="slide-preview-title">
								{displaySlide.title}
							</h3>
						)}
						{(displaySlide.layout === 'image-content' ||
							displaySlide.layout === 'title-image-content') &&
							displaySlide.image && (
								<img
									src={getUploadedImageUrl(displaySlide.image)}
									alt={displaySlide.title || 'Slide'}
									className={`object-contain mb-4 rounded-lg ${
										displaySlide.imageSize === 'small'
											? 'max-h-32'
											: displaySlide.imageSize === 'large'
												? 'max-h-64'
												: displaySlide.imageSize === 'full'
													? 'w-full h-full'
													: 'max-h-48'
									}`}
								/>
							)}
						{displaySlide.content && (
							<p
								ref={slidePreviewContentRef}
								className="whitespace-pre-wrap slide-preview-content"
							>
								{displaySlide.content}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	);
}
