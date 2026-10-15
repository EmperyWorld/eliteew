/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared absolute geometry for Start Menu `#start-menu-panel` across Legacy /
 * Command Console / Workspace modes — edge insets must match on all axes.
 *
 * Invariants:
 * - sm+: `top/left/right = 2cm`, `bottom = 5rem` (taskbar clearance) — panel
 *   stretches between insets (no content-capped max-height that ignores top).
 * - max-sm: full-width sheet above compact taskbar with fixed height budget.
 *
 * Related:
 * - StartMenuLegacy.tsx, StartMenuCommandConsole.tsx, StartMenuWorkspace.tsx
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 */

import { cn } from '@/utils/cn';

/** Classes after shell panel surface / flex column root. */
export const START_MENU_PANEL_GEOMETRY = cn(
	// Mobile: full-width sheet above compact taskbar (h-12)
	'max-sm:inset-x-0 max-sm:bottom-12 max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0',
	'max-sm:h-[calc(100dvh-3rem)] max-sm:max-h-[calc(100dvh-3rem)]',
	// Desktop: same ~2cm edge inset as width (top+sides); bottom clears taskbar
	'sm:top-[2cm] sm:bottom-20 sm:left-[2cm] sm:right-[2cm] sm:w-auto sm:max-w-none sm:translate-x-0',
	'max-sm:rounded-b-none max-sm:rounded-t-2xl'
);
