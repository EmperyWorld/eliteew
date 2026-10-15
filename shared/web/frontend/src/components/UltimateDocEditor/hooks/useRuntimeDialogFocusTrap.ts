import { type RefObject, useEffect } from 'react';

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
	return Array.from(
		root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
	).filter(
		(el) =>
			!el.hasAttribute('disabled') &&
			!el.hidden &&
			el.getClientRects().length > 0
	);
}

/**
 * Keeps Tab cycles inside the dialog while open (paired with Esc handlers on the dialogs).
 */
export function useRuntimeDialogFocusTrap(
	isOpen: boolean,
	rootRef: RefObject<HTMLElement | null>
): void {
	useEffect(() => {
		if (!isOpen || !rootRef.current) {
			return;
		}
		const root = rootRef.current;

		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key !== 'Tab') {
				return;
			}
			const nodes = getFocusable(root);
			if (nodes.length === 0) {
				return;
			}
			const first = nodes[0];
			const last = nodes[nodes.length - 1];
			const active = document.activeElement as HTMLElement | null;

			if (event.shiftKey) {
				if (active === first || !root.contains(active)) {
					event.preventDefault();
					last?.focus();
				}
			} else if (active === last || !root.contains(active)) {
				event.preventDefault();
				first?.focus();
			}
		};

		document.addEventListener('keydown', onKeyDown, true);
		return (): void => {
			document.removeEventListener('keydown', onKeyDown, true);
		};
	}, [isOpen, rootRef]);
}
