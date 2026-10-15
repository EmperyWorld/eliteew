/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Class contract for the desktop zoom-root clip wrapper — must not be a scrollport.
 *
 * Invariants:
 * - Uses `overflow-clip` (not `overflow-hidden`) so focus/scrollIntoView cannot
 *   scroll the layer and shift maximized windows into the taskbar.
 *
 * Related:
 * - DesktopWorkspaceShellLayout.tsx
 * - documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md
 */

/** Clip wrapper around `[data-desktop-ui-scale]` inside `#desktop-main`. */
export const DESKTOP_UI_SCALE_CLIP_CLASSNAME =
	'absolute inset-0 min-h-0 overflow-clip overscroll-none';
