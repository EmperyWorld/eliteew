/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for presentation and slide word/char statistics in the editor.
 *
 * Invariants:
 * - Word count splits on whitespace; empty tokens excluded.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import type { PresentationSlide } from '@services/api/presentations';

export function getPresentationStats(slides: PresentationSlide[]) {
	const totalSlides = slides.length;
	const totalWords = slides.reduce((acc, slide) => {
		const text = `${slide.title || ''} ${slide.content || ''}`;
		return (
			acc +
			text
				.trim()
				.split(/\s+/)
				.filter((w) => w.length > 0).length
		);
	}, 0);
	const totalChars = slides.reduce((acc, slide) => {
		const text = `${slide.title || ''} ${slide.content || ''}`;
		return acc + text.length;
	}, 0);
	const slidesWithImages = slides.filter((slide) => slide.image).length;
	const slidesWithContent = slides.filter(
		(slide) => slide.title || slide.content
	).length;

	return {
		totalSlides,
		totalWords,
		totalChars,
		slidesWithImages,
		slidesWithContent,
		emptySlides: totalSlides - slidesWithContent,
	};
}

export function getSlideStats(slide: PresentationSlide) {
	const text = `${slide.title || ''} ${slide.content || ''}`;
	const words = text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
	const chars = text.length;
	const charsNoSpaces = text.replace(/\s/g, '').length;

	return { words, chars, charsNoSpaces };
}

export type PresentationStats = ReturnType<typeof getPresentationStats>;
export type SlideStats = ReturnType<typeof getSlideStats>;
