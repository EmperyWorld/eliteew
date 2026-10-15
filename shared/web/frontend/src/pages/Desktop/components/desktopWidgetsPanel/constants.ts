/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Panel anchor classes and compact-mode helper for widget slots.
 *
 * Invariants:
 * - Position classes align with shell_state widgets_panel_position anchors.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 */

import type { DesktopWidgetLayoutSlot } from '../../types/desktopExpansion.types';
import type { WidgetsPanelPosition } from '../../types/desktop.types';
import { resolveDesktopWidgetDensity } from '../../utils/desktopWidgetSurfacePolicy';

export const PANEL_POSITION_CLASS: Record<WidgetsPanelPosition, string> = {
	'top-right': 'top-4 right-4',
	'top-left': 'top-4 left-4',
	'bottom-right': 'bottom-20 right-4',
	'bottom-left': 'bottom-20 left-4',
};

export function slotEffectiveCompact(
	slot: DesktopWidgetLayoutSlot,
	compactWidgetsGlobal: boolean
): boolean {
	if (compactWidgetsGlobal) return true;
	return resolveDesktopWidgetDensity(slot.mode) === 'compact';
}
