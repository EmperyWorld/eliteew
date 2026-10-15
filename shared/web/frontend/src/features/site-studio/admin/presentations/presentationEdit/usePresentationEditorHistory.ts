/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Undo/redo history stack for presentation slide edits.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import type { PresentationSlide } from '@services/api/presentations';
import {
	useCallback,
	useEffect,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';

export function usePresentationEditorHistory(
	slides: PresentationSlide[],
	setSlides: (slides: PresentationSlide[]) => void,
	setSelectedSlideIndex: Dispatch<SetStateAction<number>>
) {
	const [history, setHistory] = useState<PresentationSlide[][]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);

	useEffect(() => {
		if (historyIndex === -1 || history.length === 0) return;

		const currentHistory = history[historyIndex];
		if (
			currentHistory.length === slides.length &&
			currentHistory.every(
				(slide, index) =>
					slide.id === slides[index]?.id &&
					slide.title === slides[index]?.title &&
					slide.content === slides[index]?.content &&
					slide.layout === slides[index]?.layout
			)
		) {
			return;
		}

		const newHistory = history.slice(0, historyIndex + 1);
		newHistory.push(slides.map((slide) => ({ ...slide })));
		setHistory(newHistory);
		setHistoryIndex(newHistory.length - 1);

		if (newHistory.length > 50) {
			setHistory(newHistory.slice(-50));
			setHistoryIndex(49);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [slides, history, historyIndex]);

	const handleUndo = useCallback(() => {
		if (historyIndex > 0 && history.length > 0) {
			const newIndex = historyIndex - 1;
			setHistoryIndex(newIndex);
			setSlides(history[newIndex].map((slide) => ({ ...slide })));
			setSelectedSlideIndex((currentIndex) => {
				if (currentIndex >= history[newIndex].length) {
					return Math.max(0, history[newIndex].length - 1);
				}
				return currentIndex;
			});
		}
	}, [history, historyIndex, setSlides, setSelectedSlideIndex]);

	const handleRedo = useCallback(() => {
		if (historyIndex < history.length - 1 && history.length > 0) {
			const newIndex = historyIndex + 1;
			setHistoryIndex(newIndex);
			setSlides(history[newIndex].map((slide) => ({ ...slide })));
			setSelectedSlideIndex((currentIndex) => {
				if (currentIndex >= history[newIndex].length) {
					return Math.max(0, history[newIndex].length - 1);
				}
				return currentIndex;
			});
		}
	}, [history, historyIndex, setSlides, setSelectedSlideIndex]);

	const initHistory = useCallback((initialSlides: PresentationSlide[]) => {
		setHistory([initialSlides]);
		setHistoryIndex(0);
	}, []);

	return {
		history,
		historyIndex,
		setHistory,
		setHistoryIndex,
		handleUndo,
		handleRedo,
		initHistory,
	};
}
