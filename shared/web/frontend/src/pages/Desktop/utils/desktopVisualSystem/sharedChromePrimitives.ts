/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared desktop chrome inventory reminder for leaf components.
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
/**
 * Shared desktop chrome inventory.
 * Use this as a reminder that new desktop UI should reuse system primitives
 * instead of composing fresh slate/white glass bundles in leaf components.
 */
export const DESKTOP_SHARED_CHROME_PRIMITIVES = [
	'DesktopAppSurface',
	'DesktopAppToolbar',
	'DesktopAppPanel',
	'DesktopAppSectionLabel',
	'DesktopAppButton',
	'DesktopAppInput',
	'DesktopAppListRow',
	'DesktopAppEmptyState',
	'DesktopAppErrorState',
	'DesktopAppModalFrame',
	'DesktopAppSkeleton',
] as const;
