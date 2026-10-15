/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React SSOT for Shell chrome profile + traits + desktop theme (U4).
 * Theme reuses useDesktopShellTheme — no second theme source of truth.
 *
 * Invariants:
 * - Profile/traits come only from shellChrome + App Registry.
 * - Theme is DesktopShellTheme when readable; null only if theme hook is unavailable.
 *
 * Related:
 * - shell/shellChrome.ts
 * - hooks/useDesktopShellTheme.ts
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md §C.3
 */

import {
	useDesktopShellTheme,
	type DesktopShellTheme,
} from '@/hooks/useDesktopShellTheme';
import type { ShellChromeProfile } from './appRegistry';
import {
	getShellChromeProfileTraits,
	resolveShellChromeProfile,
	type ShellChromeProfileTraits,
} from './shellChrome';

export type UseShellChromeResult = {
	profile: ShellChromeProfile;
	traits: ShellChromeProfileTraits;
	/** Shell light/dark from `#desktop-main[data-theme]` / html.dark; null if unavailable. */
	theme: DesktopShellTheme | null;
};

/**
 * Read chrome profile for the given appComponent (defaults standard when omitted/unknown).
 */
export function useShellChrome(
	appComponent?: string | null
): UseShellChromeResult {
	const profile = resolveShellChromeProfile(appComponent);
	const traits = getShellChromeProfileTraits(profile);
	const theme = useDesktopShellTheme();
	return { profile, traits, theme };
}
