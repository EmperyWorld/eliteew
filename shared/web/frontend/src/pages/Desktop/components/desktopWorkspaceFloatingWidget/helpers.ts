/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Viewport sizing and context-menu hit-test helpers for the floating widget.
 *
 * Invariants:
 * - Viewport size includes taskbar height for clamp math.
 *
 * Related:
 * - utils/desktopFloatingWidgetPlacement.ts
 * - utils/desktopSnapGeometry.ts
 * - utils/desktopContextMenuPolicy.ts
 */

import type { SyntheticEvent } from 'react';
import { DESKTOP_LAYOUT } from '../../constants';
import { applyDesktopContextMenuPolicy } from '../../utils/desktopContextMenuPolicy';
import { readDesktopWorkArea } from '../../utils/desktopSnapGeometry';

export function floatingWidgetViewportSize() {
	const tb = DESKTOP_LAYOUT.TASKBAR_HEIGHT_PX;
	if (typeof window === 'undefined') {
		const wa = readDesktopWorkArea();
		return {
			width: wa.width,
			height: wa.height + tb,
			taskbarPx: tb,
			pad: 8,
		};
	}
	return {
		width: window.innerWidth,
		height: window.innerHeight,
		taskbarPx: tb,
		pad: 8,
	};
}

/**
 * True when the hit target is an interactive control (buttons open their own actions;
 * ПКМ still suppresses native via policy — custom FW menu opens only on chrome).
 */
export function isFwContextMenuBlockedTarget(
	target: EventTarget | null
): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest('button, a, input, select, textarea, [role="button"], label')
	);
}

/** Suppress native browser menu; return true when the floating-widget chrome menu may open. */
export function shouldOpenFloatingWidgetContextMenu(
	event: SyntheticEvent | Event
): boolean {
	applyDesktopContextMenuPolicy(event);
	const target = 'target' in event ? event.target : null;
	return !isFwContextMenuBlockedTarget(target);
}
