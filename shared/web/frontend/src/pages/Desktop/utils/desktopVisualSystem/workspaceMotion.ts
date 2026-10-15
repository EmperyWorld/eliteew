/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared motion timings for workspace shell (menus, icon grid, background crossfade).
 *
 * Invariants:
 * - App component visual identities remain stable for persisted desktop items.
 * - Every DesktopWindowStyle key keeps a distinct premium look; no backdrop-filter / chameleon motion.
 * - No infinite CSS animation on window, taskbar, or widget chrome.
 * - Chrome gradient tokens (`--desktop-chrome-*-bg`) use `[background-image:var(--…)]`,
 *   never Tailwind `bg-(--…)` (that emits `background-color`, which drops gradients).
 *
 * Related:
 * - `pages/Desktop/utils/desktopVisualSystem.tsx` (public barrel)
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
/** Motion timings shared by workspace shell; keep context menus and grid enter transitions aligned. */
export const DESKTOP_WORKSPACE_MOTION = {
	/** Taskbar-adjacent / cursor-anchored menus */
	popover: {
		duration: 0.12,
		ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
	},
	/** Icon grid item appearance (see DesktopIconLayer transition) */
	iconGrid: { duration: 0.18 },
	/** Press/drag feedback on icons (DesktopIcon motion) */
	iconDrag: { duration: 0.18 },
	/** Wallpaper / solid background crossfade on workspace root */
	/** Slightly longer crossfade for wallpaper/theme changes on `#desktop-main` (still cheap: background only). */
	backgroundCrossfadeSec: 0.5,
} as const;
