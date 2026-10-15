/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 4 SSOT for desktop-only chrome that must not appear on `#/mobile-*`
 * embedded SPA routes (taskbar / Start / dual-header chrome, etc.).
 *
 * Invariants:
 * - Mark full-shell-only controls with `data-desktop-chrome="full-shell-only"`.
 * - CSS under `mobileEmbeddedTheme.css` hides marked nodes inside embedded hosts.
 * - Prefer not rendering via `shouldRenderFullShellOnlyChrome` when the app
 *   already knows `embeddedMobileLayout`.
 *
 * Related:
 * - utils/mobileEmbeddedSpaRoute.ts
 * - components/mobileEmbedded/mobileEmbeddedTheme.css
 * - documentation/product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md
 */

import { isMobileEmbeddedSpaRoute } from '@/utils/mobileEmbeddedSpaRoute';

export const DESKTOP_CHROME_FULL_SHELL_ONLY = 'full-shell-only' as const;

export type DesktopChromeFullShellOnlyAttr = {
	'data-desktop-chrome': typeof DESKTOP_CHROME_FULL_SHELL_ONLY;
};

/** Props for controls that exist only on the full Desktop shell host. */
export function desktopFullShellOnlyChromeProps(): DesktopChromeFullShellOnlyAttr {
	return { 'data-desktop-chrome': DESKTOP_CHROME_FULL_SHELL_ONLY };
}

/**
 * Whether full-shell-only chrome may render.
 * Explicit `embeddedMobileLayout` wins; otherwise hash route detection.
 */
export function shouldRenderFullShellOnlyChrome(
	embeddedMobileLayout?: boolean
): boolean {
	if (embeddedMobileLayout === true) {
		return false;
	}
	if (embeddedMobileLayout === false) {
		return true;
	}
	return !isMobileEmbeddedSpaRoute();
}
