/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Единая точка входа для OIDC-сессии (PKCE через `oauth4webapi`): реэкспортирует фасад,
 * token helpers и события замены сессии без default-reexport сбоев при циклах.
 *
 * Invariants:
 * - Все HTTP/WS клиенты импортируют auth state отсюда или из `services/keycloak.ts`, не из legacy storage keys.
 * - `notifySessionReplaced` clears persisted tokens but preserves PKCE state during redirect/callback.
 *
 * Related:
 * - `services/keycloak.ts`, `services/api/client.ts`, `documentation/product/FRONTEND-AUTH.md`
 */

import { keycloak, isAuthenticated } from './keycloak';

export {
	getAuthHeader,
	getToken,
	getUserInfo,
	logout,
	initKeycloak,
	ensureAccessTokenMinValidity,
	notifySessionReplaced,
	subscribeAuthRefreshSuccess,
	subscribeTokenExpired,
	keycloak,
} from './keycloak';

export const isAuthSessionAuthenticated = isAuthenticated;

export const authSession = keycloak;

export default keycloak;
