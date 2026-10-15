/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared EWA companion dialog focus trap with save/restore on open/close. Thin wrapper
 * for `role="dialog"` surfaces that opt out of `ModalAdvanced`.
 *
 * Invariants:
 * - Saves focus on activate and restores on deactivate (LIFO stack via `saveFocus`/`restoreFocus`).
 * - Tab cycles inside `rootRef`; Escape handling stays in the dialog component.
 *
 * Related:
 * - src/utils/accessibility.ts
 * - src/features/ewa/companionUx/CompanionMobileBottomSheet.tsx
 * - documentation/product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md §EWA companion focus
 */

import {
	cycleTabFocusWithinContainer,
	getFocusableElements,
	restoreFocus,
	saveFocus,
} from '@/utils/accessibility';
import { useEffect, type RefObject } from 'react';

export type UseEwaDialogFocusTrapOptions = {
	/** When false, skip save/restore (e.g. sheet opened from already-focused trigger). Default true. */
	restoreFocusOnClose?: boolean;
};

/**
 * Focus trap + restore pattern for EWA companion dialogs and bottom sheets.
 */
export function useEwaDialogFocusTrap(
	active: boolean,
	rootRef: RefObject<HTMLElement | null>,
	options?: UseEwaDialogFocusTrapOptions
): void {
	const restoreFocusOnClose = options?.restoreFocusOnClose ?? true;

	useEffect(() => {
		if (!active) return;
		if (restoreFocusOnClose) {
			saveFocus();
		}
		const root = rootRef.current;
		if (!root) {
			return () => {
				if (restoreFocusOnClose) {
					restoreFocus();
				}
			};
		}
		const raf = window.requestAnimationFrame(() => {
			const nodes = getFocusableElements(root);
			const first = nodes[0];
			if (first && !root.contains(document.activeElement)) {
				first.focus({ preventScroll: true });
			}
		});
		return () => {
			window.cancelAnimationFrame(raf);
			if (restoreFocusOnClose) {
				restoreFocus();
			}
		};
	}, [active, restoreFocusOnClose, rootRef]);

	useEffect(() => {
		if (!active) return;
		const root = rootRef.current;
		if (!root) return;

		const onKeyDown = (event: KeyboardEvent): void => {
			cycleTabFocusWithinContainer(root, event);
		};

		root.addEventListener('keydown', onKeyDown);
		return () => root.removeEventListener('keydown', onKeyDown);
	}, [active, rootRef]);
}
