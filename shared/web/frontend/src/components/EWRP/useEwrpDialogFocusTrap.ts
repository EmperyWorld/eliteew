/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tab focus trap for EWRP modal dialogs (UGS slide regen, history, doc picker).
 *
 * Invariants:
 * - Active only while modal is open; mirrors desktop AI dialog trap pattern.
 *
 * Related:
 * - `EwrpSlideEditorPanel.tsx`, `EWRPGeneratorMain.tsx`, `EwrpPdfPresentationViewer.tsx`
 */

import { type RefObject, useEffect } from 'react';

const FOCUSABLE =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab cycling inside an EWRP modal panel. */
export function useEwrpDialogFocusTrap(
	containerRef: RefObject<HTMLElement | null>,
	isActive: boolean
): void {
	useEffect(() => {
		if (!isActive) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Tab' || !containerRef.current) return;
			const focusable =
				containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isActive, containerRef]);
}
