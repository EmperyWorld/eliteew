/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Horizontal slide index strip for EWRP draft editor — jump to slide while scrolling long lists.
 *
 * Invariants:
 * - `indices` are 0-based draft positions (full list or search-filtered subset).
 * - IntersectionObserver tracking only when `trackScrollPosition` and scroll container are set.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpDraftSlideRow`, `VirtualVariableList`
 */

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { type RefObject, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sw } from './EwrpGeneratorChunks';

export type EwrpSlideEditorQuickNavProps = {
	/** 0-based slide indices to show (subset when search is active). */
	indices: number[];
	titles?: string[];
	activeIndex: number;
	onGoToSlide: (index: number) => void;
	onScrollActiveIndex?: (index: number) => void;
	trackScrollPosition?: boolean;
	scrollContainerRef?: RefObject<HTMLElement | null>;
	className?: string;
};

function ewrpDraftSlideDomId(index: number): string {
	return `ewrp-draft-slide-${index}`;
}

/** Numbered pills with prev/next; highlights the slide in view when DOM tracking is enabled. */
export function EwrpSlideEditorQuickNav({
	indices,
	titles,
	activeIndex,
	onGoToSlide,
	onScrollActiveIndex,
	trackScrollPosition = false,
	scrollContainerRef,
	className,
}: EwrpSlideEditorQuickNavProps) {
	const { t } = useTranslation('ewrp');

	useEffect(() => {
		if (
			!trackScrollPosition ||
			!scrollContainerRef?.current ||
			!onScrollActiveIndex
		) {
			return;
		}
		const root = scrollContainerRef.current;

		const elements: HTMLElement[] = [];
		for (const index of indices) {
			const el = document.getElementById(ewrpDraftSlideDomId(index));
			if (el) elements.push(el);
		}
		if (elements.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((e) => e.isIntersecting);
				if (visible.length === 0) return;
				const best = visible.reduce((a, b) =>
					a.intersectionRatio >= b.intersectionRatio ? a : b
				);
				const idx = elements.indexOf(best.target as HTMLElement);
				if (idx >= 0) onScrollActiveIndex(indices[idx] ?? activeIndex);
			},
			{
				root,
				rootMargin: '-12% 0px -55% 0px',
				threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
			}
		);

		for (const el of elements) observer.observe(el);
		return () => observer.disconnect();
	}, [
		trackScrollPosition,
		scrollContainerRef,
		indices,
		onScrollActiveIndex,
		activeIndex,
	]);

	if (indices.length < 2) return null;

	const activePos = indices.indexOf(activeIndex);
	const canPrev = activePos > 0;
	const canNext = activePos >= 0 && activePos < indices.length - 1;

	const navItems = indices.map((index) => ({
		index,
		number: index + 1,
		title: titles?.[index]?.trim() ?? '',
	}));

	return (
		<nav
			className={cn(
				'shrink-0 border-b border-(--desktop-border-subtle)/50 bg-(--desktop-surface-soft)/20 px-4 py-2',
				className
			)}
			aria-label={t('form.editorQuickNavAria')}
		>
			<div className="flex items-center gap-1.5">
				<button
					type="button"
					onClick={() => {
						if (canPrev) onGoToSlide(indices[activePos - 1] as number);
					}}
					disabled={!canPrev}
					className={cn(
						'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-(--desktop-border-subtle)/60 text-(--desktop-text-muted) transition-colors',
						'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary) disabled:cursor-not-allowed disabled:opacity-40',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					title={t('form.editorPrevSlide')}
					aria-label={t('form.editorPrevSlide')}
				>
					<ChevronLeftIcon className="h-4 w-4" strokeWidth={sw} />
				</button>
				<div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-(--desktop-border-subtle)/80">
					{navItems.map((item) => (
						<button
							key={`ewrp-nav-slide-${item.number}`}
							type="button"
							onClick={() => onGoToSlide(item.index)}
							className={cn(
								'inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border px-2 text-[11px] font-semibold tabular-nums transition-colors',
								item.index === activeIndex
									? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)'
									: 'border-(--desktop-border-subtle)/60 bg-(--desktop-surface-panel)/60 text-(--desktop-text-muted) hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							title={
								item.title
									? t('form.editorGoToSlideWithTitle', {
											n: item.number,
											title: item.title,
										})
									: t('form.editorGoToSlide', { n: item.number })
							}
							aria-current={item.index === activeIndex ? 'true' : undefined}
						>
							{item.number}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => {
						if (canNext) onGoToSlide(indices[activePos + 1] as number);
					}}
					disabled={!canNext}
					className={cn(
						'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-(--desktop-border-subtle)/60 text-(--desktop-text-muted) transition-colors',
						'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary) disabled:cursor-not-allowed disabled:opacity-40',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					title={t('form.editorNextSlide')}
					aria-label={t('form.editorNextSlide')}
				>
					<ChevronRightIcon className="h-4 w-4" strokeWidth={sw} />
				</button>
			</div>
		</nav>
	);
}
