/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Split FoFline product class from host I/O. Product class is the OIDC profile.
 * Tauri invoke and the EmpiierOS WebKit bridge are separate adapters.
 *
 * Invariants:
 * - `foflineNative` is not “has `__TAURI_INTERNALS__`”.
 * - EmpiierOS is `foflineNative` + `EmperyDesktopNativeOidc` and no Tauri invoke.
 * - This module does not send refresh tokens into JS.
 *
 * Related:
 * - services/keycloakDesktopNativeOidc.ts
 * - pages/Desktop/utils/videoCallNativeMeetStage.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
 */

import { getOidcRuntimeProfile } from '@/services/keycloakProfile';
import type { WindowWithEmperyDesktopNativeOidc } from '@/services/keycloakDesktopNativeOidc';

type TauriInternals = {
	invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

/** True when the page can call Tauri `invoke`. Not a product-class check. */
export function hasTauriInvoke(): boolean {
	if (typeof window === 'undefined') return false;
	const w = window as Window & { __TAURI_INTERNALS__?: TauriInternals };
	return typeof w.__TAURI_INTERNALS__?.invoke === 'function';
}

/**
 * EmpiierOS WebKit host: FoFline OIDC profile, native OIDC bridge, no Tauri.
 * Browser PKCE and Tauri FoFline are not this host.
 * This flag selects the clipped sibling Meet stage, not a nested iframe
 * and not a fullscreen FILL overlay.
 */
export function isEmpiierosFoflineHost(): boolean {
	if (typeof window === 'undefined') return false;
	if (getOidcRuntimeProfile() !== 'foflineNative') return false;
	if (hasTauriInvoke()) return false;
	const bridge = (window as WindowWithEmperyDesktopNativeOidc)
		.EmperyDesktopNativeOidc;
	if (!bridge) return false;
	return Boolean(
		bridge.getBootstrapJson ||
			bridge.refreshSessionJson ||
			bridge.logoutSessionJson
	);
}
