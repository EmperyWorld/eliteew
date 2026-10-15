/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single policy for desktop shell contextmenu events: allow native browser menu
 * only on editable fields; otherwise suppress so EliteEW handlers own ПКМ.
 *
 * Invariants:
 * - Editable allowlist wins over shell suppress (`isBrowserContextMenuAllowedTarget`).
 * - Opt-outs (`data-desktop-window-ignore-context`, `data-taskbar-interactive`) must
 *   still call this (or equivalent preventDefault) on non-editable targets.
 *
 * Related:
 * - desktopUi.ts (isBrowserContextMenuAllowedTarget)
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from 'react';
import { isBrowserContextMenuAllowedTarget } from './desktopUi';

export type DesktopContextMenuPolicyResult = 'allow-native' | 'suppressed';

export type ApplyDesktopContextMenuPolicyOptions = {
	/** Also stopPropagation when suppressing (default true for shell chrome). */
	stopPropagation?: boolean;
};

/**
 * Apply shell ПКМ policy to a contextmenu event.
 * @returns `allow-native` when the target is an editable control; otherwise suppresses.
 */
export function applyDesktopContextMenuPolicy(
	event: SyntheticEvent | Event,
	options?: ApplyDesktopContextMenuPolicyOptions
): DesktopContextMenuPolicyResult {
	const target =
		'target' in event ? (event.target as EventTarget | null) : null;
	if (isBrowserContextMenuAllowedTarget(target)) {
		return 'allow-native';
	}
	if (typeof (event as Event).preventDefault === 'function') {
		(event as Event).preventDefault();
	}
	const stop = options?.stopPropagation !== false;
	if (stop && typeof (event as Event).stopPropagation === 'function') {
		(event as Event).stopPropagation();
	}
	return 'suppressed';
}

/** React onContextMenu convenience: returns true when shell may open a custom menu. */
export function shouldOpenDesktopCustomContextMenu(
	event: ReactMouseEvent,
	options?: ApplyDesktopContextMenuPolicyOptions
): boolean {
	return applyDesktopContextMenuPolicy(event, options) === 'suppressed';
}
