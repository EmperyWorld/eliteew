/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared capture keyboard handler for spotlight guide tour modals.
 *
 * Invariants:
 * - Escape and step navigation use capture + stopPropagation so parent shells defer.
 *
 * Related:
 * - SpotlightGuideModal.tsx, CreativeStudioGuideTourModal.tsx
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react';

/** Capture keyboard shortcuts for guided tour overlays. */
export function useGuideTourCaptureKeyboard(
	open: boolean,
	stepCount: number,
	onClose: () => void,
	setStepIndex: Dispatch<SetStateAction<number>>
): void {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				onClose();
				return;
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				e.stopPropagation();
				setStepIndex((i) => (i < stepCount - 1 ? i + 1 : i));
				return;
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				e.stopPropagation();
				setStepIndex((i) => (i > 0 ? i - 1 : i));
				return;
			}
			if (e.key === 'Home') {
				e.preventDefault();
				e.stopPropagation();
				setStepIndex(0);
				return;
			}
			if (e.key === 'End') {
				e.preventDefault();
				e.stopPropagation();
				setStepIndex(stepCount - 1);
			}
		};
		window.addEventListener('keydown', onKey, { capture: true });
		return () =>
			window.removeEventListener('keydown', onKey, { capture: true });
	}, [open, onClose, setStepIndex, stepCount]);
}
