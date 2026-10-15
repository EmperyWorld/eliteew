/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical path constant for MobileAndroid JSON token refresh (not SPA OIDC).
 *
 * Invariants:
 * - SPA / BaseService must not POST this path; MobileAndroid AuthApi owns it.
 * - Mounted only under `/api/auth` (no `/api/v1` mirror) — see domains/auth.py.
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 * - MobileAndroid AuthApiContracts.kt
 */

/** POST JSON `{ refresh_token }` — MobileAndroid + Keycloak via AuthProviderService. */
export const MOBILE_AUTH_REFRESH_URL = '/api/auth/refresh' as const;
