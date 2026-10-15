/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global keyboard shortcuts for the presentation slide editor.
 *
 * Invariants:
 * - Arrow* key string bugs preserved intentionally (ArrowUpIcon etc.).
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import { useEffect } from 'react';

export type UsePresentationEditorKeyboardArgs = {
	selectedSlideIndex: number;
	slidesLength: number;
	isSaving: boolean;
	isFullscreenPreview: boolean;
	previewSlideIndex: number;
	setSelectedSlideIndex: (index: number) => void;
	setIsFullscreenPreview: (
		value: boolean | ((prev: boolean) => boolean)
	) => void;
	setPreviewSlideIndex: (index: number) => void;
	handleDuplicateSlide: (index: number) => void;
	requestDeleteSlide: (index: number) => void;
	handleUndo: () => void;
	handleRedo: () => void;
};

export function usePresentationEditorKeyboard({
	selectedSlideIndex,
	slidesLength,
	isSaving,
	isFullscreenPreview,
	previewSlideIndex,
	setSelectedSlideIndex,
	setIsFullscreenPreview,
	setPreviewSlideIndex,
	handleDuplicateSlide,
	requestDeleteSlide,
	handleUndo,
	handleRedo,
}: UsePresentationEditorKeyboardArgs) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isFullscreenPreview) {
				e.preventDefault();
				setIsFullscreenPreview(false);
				return;
			}

			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target instanceof HTMLElement && e.target.isContentEditable)
			) {
				return;
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				if (!isSaving) {
					const form = document.querySelector('form');
					if (form) {
						form.requestSubmit();
					}
				}
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
				e.preventDefault();
				handleDuplicateSlide(selectedSlideIndex);
			}

			if (e.key === 'Delete') {
				e.preventDefault();
				if (slidesLength > 1) {
					requestDeleteSlide(selectedSlideIndex);
				}
			}

			if (e.key === 'ArrowUpIcon' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				if (selectedSlideIndex > 0) {
					setSelectedSlideIndex(selectedSlideIndex - 1);
				}
			}
			if (e.key === 'ArrowDownIcon' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				if (selectedSlideIndex < slidesLength - 1) {
					setSelectedSlideIndex(selectedSlideIndex + 1);
				}
			}

			if (e.key === 'f' || e.key === 'F') {
				e.preventDefault();
				setIsFullscreenPreview(!isFullscreenPreview);
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
				e.preventDefault();
				handleUndo();
			}

			if (
				((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
				((e.ctrlKey || e.metaKey) && e.key === 'y')
			) {
				e.preventDefault();
				handleRedo();
			}

			if (isFullscreenPreview && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
				if (e.key === 'ArrowLeftIcon' && previewSlideIndex > 0) {
					e.preventDefault();
					setPreviewSlideIndex(previewSlideIndex - 1);
				}
				if (
					e.key === 'ArrowRightIcon' &&
					previewSlideIndex < slidesLength - 1
				) {
					e.preventDefault();
					setPreviewSlideIndex(previewSlideIndex + 1);
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		selectedSlideIndex,
		slidesLength,
		isSaving,
		isFullscreenPreview,
		previewSlideIndex,
		handleDuplicateSlide,
		requestDeleteSlide,
		handleUndo,
		handleRedo,
		setSelectedSlideIndex,
		setIsFullscreenPreview,
		setPreviewSlideIndex,
	]);
}
