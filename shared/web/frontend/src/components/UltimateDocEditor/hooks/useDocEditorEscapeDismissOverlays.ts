/**
 * Escape: закрытие тура, quick-start карточки и оверлеев док-редактора (capture phase).
 */

import { useEffect } from 'react';

export interface UseDocEditorEscapeDismissOverlaysParams {
	docGuideOpen: boolean;
	showGuide: boolean;
	anyDocOverlayOpen: boolean;
	setDocGuideOpen: (open: boolean) => void;
	setShowGuide: (open: boolean) => void;
	closeAllOverlays: () => void;
}

export function useDocEditorEscapeDismissOverlays(
	params: UseDocEditorEscapeDismissOverlaysParams
): void {
	const {
		docGuideOpen,
		showGuide,
		anyDocOverlayOpen,
		setDocGuideOpen,
		setShowGuide,
		closeAllOverlays,
	} = params;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			if (docGuideOpen) {
				e.preventDefault();
				setDocGuideOpen(false);
				return;
			}
			if (showGuide) {
				e.preventDefault();
				setShowGuide(false);
				return;
			}
			if (!anyDocOverlayOpen) return;
			e.preventDefault();
			closeAllOverlays();
		};
		document.addEventListener('keydown', onKeyDown, true);
		return () => document.removeEventListener('keydown', onKeyDown, true);
	}, [
		docGuideOpen,
		showGuide,
		anyDocOverlayOpen,
		closeAllOverlays,
		setDocGuideOpen,
		setShowGuide,
	]);
}
