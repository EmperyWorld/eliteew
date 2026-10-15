/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public OIDC facade barrel: re-exports Stage 1–3 leaf modules and
 * `keycloakAuthOidcFacade` (AuthOidcFacade orchestrator + Stage 5 flow modules).
 * Stable import path: `services/keycloak`.
 *
 * Invariants:
 * - Export names from this path remain stable for app / AuthContext / authSession.
 * - Leaf modules must not import this barrel or the facade (no cycles).
 * - Facade owns session runtime; this file is re-export only.
 *
 * Related:
 * - `keycloakOidcDiscovery.ts`, `keycloakTokenStorage.ts`, `keycloakPkceState.ts`,
 *   `keycloakSessionEvents.ts`, `keycloakEmbeddedOidc.ts`,
 *   `keycloakDesktopNativeOidc.ts`,
 *   `keycloakOidcLoginFlow.ts`, `keycloakOidcCallbackFlow.ts`,
 *   `keycloakOidcRefreshFlow.ts`, `keycloakOidcLogoutFlow.ts`,
 *   `keycloakAuthOidcFacade.ts`, `documentation/product/FRONTEND-AUTH.md`
 */

export {
	buildBakedPublicOidcDiscoveryDocument,
	buildKeycloakPasswordResetUrl,
	getBackendSsoCallbackUrl,
	getBackendSsoRefreshUrl,
	isLoopbackAuthProxyBase,
	resolveBackendSsoCallbackUrl,
	resolveLoopbackAuthProxyDiscoveryUrl,
	resolvePublicBrowserAuthorizationUrl,
	restorePublicIdpDiscoveryDocument,
	rewriteAuthProxyDiscoveryDocument,
	shouldBakePublicOidcDiscovery,
} from './keycloakOidcDiscovery';

export { hasPendingAuthorizationCallbackInUrl } from './keycloakPkceState';

export {
	accessTokenStillValid,
	hydrateMobileEmbeddedTokensFromNativeBridge,
	isMobileEmbeddedOidcContext,
	refreshAccessTokenViaNativeBridge,
	type EmperyMobileNativeOidc,
	type NativeBridgeRefreshTokens,
	type WindowWithEmperyMobileNativeOidc,
} from './keycloakEmbeddedOidc';

export {
	hasDesktopNativeOidcBridge,
	hydrateDesktopNativeTokensFromNativeBridge,
	refreshAccessTokenViaDesktopNativeBridge,
	type DesktopNativeBridgeTokens,
	type EmperyDesktopNativeOidc,
	type WindowWithEmperyDesktopNativeOidc,
} from './keycloakDesktopNativeOidc';

export {
	type KeycloakTokenParsed,
	subscribeTokenExpired,
	subscribeAuthRefreshSuccess,
	__keycloakTokenStorageForTests,
	keycloak,
	resetOidcInteractiveRedirectInFlight,
	notifySessionReplaced,
	recoverMobileEmbeddedSession,
	initKeycloak,
	ensureAccessTokenMinValidity,
	getToken,
	FRESH_DEVICE_BINDING_AUTH_MAX_AGE_SECONDS,
	getOidcAuthTimeEpoch,
	getOidcAuthAgeSeconds,
	isOidcAuthFreshForDeviceBinding,
	getUserInfo,
	logout,
	isAuthenticated,
	updateProfile,
	getAuthHeader,
} from './keycloakAuthOidcFacade';

export { default } from './keycloakAuthOidcFacade';
