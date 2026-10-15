/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wire desktop shell gesture + keyboard shortcuts for the workspace content surface.
 *
 * Invariants:
 * - Do not mount orphan ``useMultiSelect`` side-effects (unattached containerRef + global
 *   Ctrl+A crashed with ``Array.from(undefined)``). Selection/clipboard keys live in
 *   ``useDesktopClipboard`` / SelectionBox.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopClipboard.ts
 * - src/pages/Desktop/hooks/useGestures.ts
 */

import { useGestures } from './useGestures';
import {
	useDesktopWorkspaceKeyboardShortcuts,
	type UseDesktopWorkspaceKeyboardShortcutsParams,
} from './useDesktopWorkspaceKeyboardShortcuts';

export function useDesktopWorkspaceShellInputSurfaces(params: {
	keyboard: UseDesktopWorkspaceKeyboardShortcutsParams;
	setShowCommandPalette: (value: boolean) => void;
	minimizeAllWindows: () => void;
}) {
	const { keyboard, setShowCommandPalette, minimizeAllWindows } = params;

	useGestures({
		onSwipeLeft: () => {},
		onSwipeRight: () => {},
		onSwipeUp: () => {},
		onSwipeDown: () => {},
		onPinchZoom: () => {},
		onTwoFingerSwipe: () => {},
		onThreeFingerSwipe: (direction) => {
			if (direction === 'up') setShowCommandPalette(true);
			if (direction === 'down') minimizeAllWindows();
		},
	});
	useDesktopWorkspaceKeyboardShortcuts(keyboard);
}
