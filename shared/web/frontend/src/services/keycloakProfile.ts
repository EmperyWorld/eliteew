/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime OIDC profile switch (main SPA vs APK / mobileEmbedded / desktopNative / foflineNative).
 *
 * Invariants:
 * - APK profile uses separate client id + storage keys; never reads empery-web localStorage tokens.
 * - mobileEmbedded profile uses empery-mobile client id for MobileAndroid EWA WebView bootstrap.
 * - desktopNative profile uses empery-desktop; not mobileEmbedded / not kiosk extras.
 * - foflineNative uses empery-fofline; storage keys isolated; **sessionStorage only** (no LS tokens).
 *
 * Related:
 * - `services/keycloak.ts`, `entries/mobileAppStandalone.tsx`,
 *   `entries/setupDesktopNativeOidcProfile.ts`,
 *   `entries/setupFoflineOidcProfile.ts`
 */

export type OidcRuntimeProfile =
	| 'web'
	| 'apk'
	| 'mobileEmbedded'
	| 'desktopNative'
	| 'foflineNative';

let activeProfile: OidcRuntimeProfile = 'web';

export function setOidcRuntimeProfile(profile: OidcRuntimeProfile): void {
	activeProfile = profile;
}

export function getOidcRuntimeProfile(): OidcRuntimeProfile {
	return activeProfile;
}

export function getProfileKeycloakClientId(): string {
	if (activeProfile === 'apk') {
		return (
			import.meta.env.VITE_KEYCLOAK_APK_DOWNLOAD_CLIENT_ID ||
			'empery-apk-distro'
		);
	}
	if (activeProfile === 'mobileEmbedded') {
		return import.meta.env.VITE_KEYCLOAK_MOBILE_CLIENT_ID || 'empery-mobile';
	}
	if (activeProfile === 'desktopNative') {
		return import.meta.env.VITE_KEYCLOAK_DESKTOP_CLIENT_ID || 'empery-desktop';
	}
	if (activeProfile === 'foflineNative') {
		return import.meta.env.VITE_KEYCLOAK_FOFLINE_CLIENT_ID || 'empery-fofline';
	}
	return import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'empery-web';
}

export function getProfileTokenStorageKey(): string {
	if (activeProfile === 'apk') {
		return 'eliteew.keycloak.apkDownload.oidcTokens.v1';
	}
	if (activeProfile === 'mobileEmbedded') {
		return 'eliteew.keycloak.mobileEmbedded.oidcTokens.v1';
	}
	if (activeProfile === 'desktopNative') {
		return 'eliteew.keycloak.desktopNative.oidcTokens.v1';
	}
	if (activeProfile === 'foflineNative') {
		return 'eliteew.keycloak.foflineNative.oidcTokens.v1';
	}
	return 'eliteew.keycloak.oidcTokens.v1';
}

export function getProfileAuthStateStorageKey(): string {
	if (activeProfile === 'apk') {
		return 'eliteew.keycloak.apkDownload.oidcAuthState.v1';
	}
	if (activeProfile === 'mobileEmbedded') {
		return 'eliteew.keycloak.mobileEmbedded.oidcAuthState.v1';
	}
	if (activeProfile === 'desktopNative') {
		return 'eliteew.keycloak.desktopNative.oidcAuthState.v1';
	}
	if (activeProfile === 'foflineNative') {
		return 'eliteew.keycloak.foflineNative.oidcAuthState.v1';
	}
	return 'eliteew.keycloak.oidcAuthState.v1';
}

export function getProfilePersistencePrefKey(): string | null {
	if (activeProfile === 'apk' || activeProfile === 'foflineNative') {
		return null;
	}
	return 'eliteew.keycloak.persistencePref.v1';
}

/**
 * APK + FoFline: sessionStorage only — must not persist OIDC tokens on host localStorage
 * (XSS / sterile isolation bar for foflineNative).
 */
export function profileAllowsLocalTokenStorage(): boolean {
	return activeProfile !== 'apk' && activeProfile !== 'foflineNative';
}
