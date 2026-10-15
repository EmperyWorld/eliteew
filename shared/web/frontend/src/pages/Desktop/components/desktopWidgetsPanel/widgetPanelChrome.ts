/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve widget panel frame width/radius from widgetsStyle chrome tier.
 *
 * Invariants:
 * - Uses desktopVisualSystem presets; glass fallback when unknown style.
 *
 * Related:
 * - desktopVisualSystem.ts
 */

import type { DesktopWidgetsStyle } from '../../../../types/profile';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopWindowShellTier,
} from '../../utils/desktopVisualSystem';

export function resolveWidgetPanelChrome(widgetsStyle: DesktopWidgetsStyle) {
	const tier = getDesktopWindowShellTier(widgetsStyle);
	const preset =
		DESKTOP_WINDOW_FRAME_STYLES[widgetsStyle] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass;
	const width = tier === 'minimal' ? 'w-72 min-w-72' : 'w-80 min-w-80';
	const radius =
		tier === 'minimal'
			? 'rounded-xl'
			: tier === 'framed'
				? 'rounded-2xl'
				: 'rounded-[1.35rem]';
	return { tier, preset, width, radius };
}
