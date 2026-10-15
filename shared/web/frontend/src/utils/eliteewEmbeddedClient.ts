/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect EliteEW embedded shells (Android / Meta Quest WebView APK) that must skip browser tab leader policy.
 *
 * Invariants:
 * - Native MobileAndroid (AppAuth, empery-mobile) does not load this SPA bundle — not handled here.
 * - WebView shells share SPA but are not multi-tab Chrome; always treated as sole client.
 *
 * Related:
 * - `EliteEWWebViewAndroid`, `documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md`
 */

const ANDROID_WEBVIEW_UA_MARKERS = [
	'EmperyWorldAndroidWebView',
	'EmperyMobileEwaWebView',
	'EmperyMobileHandbookWebView',
	'EmperyMobileSocialHubWebView',
	'EmperyMobileFeedbackHubWebView',
	'EmperyMobileNotificationsWebView',
	'EmperyMobileContentManagerWebView',
	'EmperyMobileEwDeskWebView',
	'EmperyMobileProfessionalWorldsWebView',
	'EmperyMobileAppStoreWebView',
	'EmperyMobileDesktopSettingsWebView',
] as const;
const MOBILE_EMBEDDED_FLAG_KEY = 'eliteew.mobileEmbeddedClient.v1';

/** True for EliteEW WebView APK shells (Android phone, Meta Quest, etc.). */
export function isEmbeddedEliteEWClient(): boolean {
	if (typeof navigator === 'undefined') {
		return false;
	}
	const ua = navigator.userAgent || '';
	if (ANDROID_WEBVIEW_UA_MARKERS.some((marker) => ua.includes(marker))) {
		return true;
	}
	try {
		if (localStorage.getItem(MOBILE_EMBEDDED_FLAG_KEY) === '1') {
			return true;
		}
		if (localStorage.getItem('eliteew.androidWebView.keycloakTokens.v1')) {
			return true;
		}
		if (localStorage.getItem('eliteew.keycloak.mobileEmbedded.oidcTokens.v1')) {
			return true;
		}
	} catch {
		/* ignore */
	}
	return false;
}
