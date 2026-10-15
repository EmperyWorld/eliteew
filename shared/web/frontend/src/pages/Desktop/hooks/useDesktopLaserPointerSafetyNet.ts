/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global pointer safety net for desktop hover chrome (styled tooltips, taskbar previews):
 * dismiss when pointer leaves protected taskbar zones, hits viewport edges, or tab hides.
 *
 * Invariants:
 * - Active whenever `#desktop-main` is mounted (all fine-pointer desktops, not Quest-only).
 * - Dispatches unified hover dismiss (tooltip coordinator + taskbar flyout listeners).
 * - Does not dismiss click-toggle panels on pointerup — only move / blur / visibility.
 *
 * Related:
 * - utils/desktopLaserPointerEnvironment.ts
 * - utils/desktopTaskbarDismissSafeZone.ts
 * - components/ui/tooltipCoordinator.ts
 */

import { useEffect, useRef } from 'react';
import { dismissDesktopHoverChrome } from '@/pages/Desktop/utils/desktopLaserPointerEnvironment';
import { subscribeDocumentHiddenSync } from '@/pages/Desktop/utils/subscribeDocumentVisibleSync';
import { isOverDesktopTaskbarDismissSafeZone } from '@/pages/Desktop/utils/desktopTaskbarDismissSafeZone';

function isPointerAtViewportEdge(event: PointerEvent): boolean {
	return (
		event.clientX <= 0 ||
		event.clientY <= 0 ||
		event.clientX >= window.innerWidth - 1 ||
		event.clientY >= window.innerHeight - 1
	);
}

/** Mount once on the desktop shell (`DesktopWorkspaceShellLayout`). */
export function useDesktopHoverChromeSafetyNet(): void {
	const wasOverTaskbarSafeZoneRef = useRef(false);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		if (!document.getElementById('desktop-main')) {
			return;
		}

		const dismissHoverChrome = () => {
			dismissDesktopHoverChrome();
		};

		const onPointerMove = (event: PointerEvent) => {
			const target = document.elementFromPoint(event.clientX, event.clientY);
			const overTaskbarSafeZone = isOverDesktopTaskbarDismissSafeZone(target);
			if (wasOverTaskbarSafeZoneRef.current && !overTaskbarSafeZone) {
				dismissHoverChrome();
			}
			wasOverTaskbarSafeZoneRef.current = overTaskbarSafeZone;

			if (isPointerAtViewportEdge(event)) {
				dismissHoverChrome();
			}
		};

		window.addEventListener('pointermove', onPointerMove, { passive: true });
		window.addEventListener('blur', dismissHoverChrome);
		const unsubHidden = subscribeDocumentHiddenSync(dismissHoverChrome);

		return () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('blur', dismissHoverChrome);
			unsubHidden();
		};
	}, []);
}

/** @deprecated Prefer `useDesktopHoverChromeSafetyNet` — kept for imports. */
export const useDesktopLaserPointerSafetyNet = useDesktopHoverChromeSafetyNet;
