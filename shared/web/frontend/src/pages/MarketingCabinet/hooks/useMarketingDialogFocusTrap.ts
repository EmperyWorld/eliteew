import { type RefObject, useEffect } from 'react';

/**
 * Keeps Tab cycling inside a modal panel (same selector strategy as {@link DeleteConfirmModal}).
 */
export function useMarketingDialogFocusTrap(
	containerRef: RefObject<HTMLElement | null>,
	isActive: boolean
): void {
	useEffect(() => {
		if (!isActive) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Tab' || !containerRef.current) return;
			const focusable = containerRef.current.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			);
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
