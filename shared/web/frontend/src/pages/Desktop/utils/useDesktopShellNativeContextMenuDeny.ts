/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * While the desktop shell is mounted, capture-phase default-deny for the browser
 * native context menu (editable fields still allowed). Escape hatch:
 * `[data-desktop-allow-native-context]`.
 *
 * Invariants:
 * - Does not stopPropagation — child EliteEW menus still receive the event.
 * - Does not cover iframe documents (separate browsing context).
 *
 * Related:
 * - desktopContextMenuPolicy.ts
 * - DesktopWorkspaceShellLayout.tsx
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import { useEffect } from 'react';
import { applyDesktopContextMenuPolicy } from './desktopContextMenuPolicy';

/**
 * Document-level capture suppress for native ПКМ on the desktop page.
 * Call once from the shell layout while the workspace is active.
 */
export function useDesktopShellNativeContextMenuDeny(enabled = true): void {
	useEffect(() => {
		if (!enabled || typeof document === 'undefined') return;

		const onContextMenuCapture = (event: Event): void => {
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('[data-desktop-allow-native-context]')
			) {
				return;
			}
			applyDesktopContextMenuPolicy(event, { stopPropagation: false });
		};

		document.addEventListener('contextmenu', onContextMenuCapture, true);
		return () => {
			document.removeEventListener('contextmenu', onContextMenuCapture, true);
		};
	}, [enabled]);
}
