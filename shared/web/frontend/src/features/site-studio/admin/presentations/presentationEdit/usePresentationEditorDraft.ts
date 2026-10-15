/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * LocalStorage draft load, periodic save, and cleanup for presentation editor.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import type { PresentationSlide } from '@services/api/presentations';
import { useEffect } from 'react';
import type { PresentationFormat } from './useOllentiTemplateBootstrap';

export type UsePresentationEditorDraftArgs = {
	id: string | undefined;
	isNew: boolean;
	title: string;
	format: PresentationFormat;
	slides: PresentationSlide[];
	setTitle: (title: string) => void;
	setFormat: (format: PresentationFormat) => void;
	setSlides: (slides: PresentationSlide[]) => void;
	setHistory: (history: PresentationSlide[][]) => void;
	setHistoryIndex: (index: number) => void;
};

export function usePresentationEditorDraft({
	id,
	isNew,
	title,
	format,
	slides,
	setTitle,
	setFormat,
	setSlides,
	setHistory,
	setHistoryIndex,
}: UsePresentationEditorDraftArgs) {
	const draftStorageKey = `presentation_draft_${id || 'new'}`;

	useEffect(() => {
		if (!isNew) return;
		const draft = localStorage.getItem(draftStorageKey);
		if (!draft) return;
		try {
			const parsed = JSON.parse(draft) as {
				title?: string;
				format?: PresentationFormat;
				slides?: PresentationSlide[];
			};
			if (parsed.title) setTitle(parsed.title);
			if (parsed.format) setFormat(parsed.format);
			if (parsed.slides && parsed.slides.length > 0) {
				setSlides(parsed.slides);
				setHistory([parsed.slides]);
				setHistoryIndex(0);
			}
		} catch (error) {
			console.error('Failed to load draft:', error);
		}
	}, [
		isNew,
		draftStorageKey,
		setTitle,
		setFormat,
		setSlides,
		setHistory,
		setHistoryIndex,
	]);

	useEffect(() => {
		const draftSaveInterval = setInterval(() => {
			if (title || slides.some((s) => s.title || s.content)) {
				const draft = {
					title,
					format,
					slides,
					updatedAt: new Date().toISOString(),
				};
				localStorage.setItem(draftStorageKey, JSON.stringify(draft));
			}
		}, 5000);

		return () => clearInterval(draftSaveInterval);
	}, [title, format, slides, draftStorageKey]);

	useEffect(() => {
		if (!isNew && id) {
			localStorage.removeItem('presentation_draft_new');
			localStorage.removeItem(`presentation_draft_${id}`);
		}
	}, [isNew, id]);

	return { draftStorageKey };
}
