/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve Shell chromeProfile from App Registry into typed traits (U4).
 * Apps read via useShellChrome / resolveShellChromeProfile — do not hardcode declutter rules.
 *
 * Invariants:
 * - Unregistered appComponent defaults to 'standard'.
 * - settings / iframe_launcher forbid persistence badges and dense chrome.
 * - iframe_launcher also hints portalPolicyHint: 'forbidden' (matches catalog portal.policy).
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md §C.1–C.3
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 * - shell/appRegistry.ts
 */

import './appRegistry.catalog';
import {
	getShellAppRegistration,
	type ShellChromeProfile,
} from './appRegistry';

export type ShellChromeProfileTraits = {
	denseChromeAllowed: boolean;
	allowPersistenceBadges: boolean;
	preferMinimalHeader: boolean;
	/** Diagnostic / CSS hint — iframe launchers must not open body portals. */
	portalPolicyHint?: 'forbidden';
};

const TRAITS_BY_PROFILE: Record<ShellChromeProfile, ShellChromeProfileTraits> =
	{
		standard: {
			denseChromeAllowed: true,
			allowPersistenceBadges: true,
			preferMinimalHeader: false,
		},
		settings: {
			denseChromeAllowed: false,
			allowPersistenceBadges: false,
			preferMinimalHeader: true,
		},
		iframe_launcher: {
			denseChromeAllowed: false,
			allowPersistenceBadges: false,
			preferMinimalHeader: true,
			portalPolicyHint: 'forbidden',
		},
	};

/** Resolve chromeProfile from registry; unregistered → 'standard'. */
export function resolveShellChromeProfile(
	appComponent?: string | null
): ShellChromeProfile {
	const reg = getShellAppRegistration(appComponent);
	return reg?.chromeProfile ?? 'standard';
}

export function getShellChromeProfileTraits(
	profile: ShellChromeProfile
): ShellChromeProfileTraits {
	return TRAITS_BY_PROFILE[profile];
}

/** Convenience: traits for an appComponent (registry → profile → traits). */
export function resolveShellChromeTraits(
	appComponent?: string | null
): ShellChromeProfileTraits {
	return getShellChromeProfileTraits(resolveShellChromeProfile(appComponent));
}
