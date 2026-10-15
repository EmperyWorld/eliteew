/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Playwright helper: resolve OIDC subject (Keycloak sub) from persisted SPA tokens.
 *
 * Invariants:
 * - Does not read retired emperyworld_user / emperyworld_* localStorage keys.
 *
 * Related:
 * - documentation/product/FRONTEND-AUTH.md
 * - services/keycloak.ts KEYCLOAK_TOKEN_STORAGE_KEY
 */

import type { Page } from 'playwright/test';

const OIDC_TOKENS_KEY = 'eliteew.keycloak.oidcTokens.v1';

/** Read authenticated principal id from OIDC token storage (session or local). */
export async function readOidcSubjectFromPage(
	page: Page
): Promise<string | null> {
	return page.evaluate((storageKey) => {
		const readStore = (store: Storage): string | null => {
			try {
				const raw = store.getItem(storageKey);
				if (!raw) return null;
				const parsed = JSON.parse(raw) as { token?: string };
				const token = parsed.token?.trim();
				if (!token) return null;
				const payloadB64 = token.split('.')[1];
				if (!payloadB64) return null;
				const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
				const claims = JSON.parse(json) as { sub?: string };
				const sub = claims.sub?.trim();
				return sub || null;
			} catch {
				return null;
			}
		};
		return readStore(sessionStorage) ?? readStore(localStorage);
	}, OIDC_TOKENS_KEY);
}
