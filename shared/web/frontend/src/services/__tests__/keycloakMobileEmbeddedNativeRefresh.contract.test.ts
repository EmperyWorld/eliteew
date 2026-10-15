/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock: mobileEmbedded OIDC refresh owns via native bridge, not /api/auth/refresh.
 *
 * Invariants:
 * - Barrel `keycloak.ts` re-exports embedded leaf; refresh flow owns native bridge call.
 * - Bridge leaf `keycloakEmbeddedOidc.ts` owns refreshSessionJson / EmperyMobileNativeOidc.
 *
 * Related:
 * - services/keycloak.ts (barrel), services/keycloakOidcRefreshFlow.ts,
 *   services/keycloakAuthOidcFacade.ts, services/keycloakEmbeddedOidc.ts,
 *   EmperyMobileEmbeddedSpaWebViewActivity.kt
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('keycloak mobileEmbedded native refresh contract', () => {
	const barrelSrc = readFileSync(resolve(__dirname, '../keycloak.ts'), 'utf8');
	const facadeSrc = readFileSync(
		resolve(__dirname, '../keycloakAuthOidcFacade.ts'),
		'utf8'
	);
	const refreshFlowSrc = readFileSync(
		resolve(__dirname, '../keycloakOidcRefreshFlow.ts'),
		'utf8'
	);
	const embeddedSrc = readFileSync(
		resolve(__dirname, '../keycloakEmbeddedOidc.ts'),
		'utf8'
	);

	it('barrel re-exports embedded leaf; refresh flow routes via native bridge', () => {
		expect(barrelSrc).toContain("from './keycloakEmbeddedOidc'");
		expect(barrelSrc).toMatch(
			/export\s*\{[\s\S]*refreshAccessTokenViaNativeBridge[\s\S]*\}\s*from\s*'\.\/keycloakEmbeddedOidc'/
		);
		expect(facadeSrc).toContain('oidcRefreshAccessToken');
		expect(facadeSrc).toContain("from './keycloakOidcRefreshFlow'");
		expect(refreshFlowSrc).toContain('refreshAccessTokenViaNativeBridge');
		expect(refreshFlowSrc).toContain("from './keycloakEmbeddedOidc'");
		expect(embeddedSrc).toContain('refreshSessionJson');
		expect(embeddedSrc).toContain('EmperyMobileNativeOidc');
		expect(refreshFlowSrc).toMatch(
			/isMobileEmbeddedOidcContext\(\)[\s\S]*refreshAccessTokenViaNativeBridge/
		);
	});

	it('does not call backend refresh from mobileEmbedded refresh path', () => {
		const refreshFn = refreshFlowSrc.match(
			/export async function oidcRefreshAccessToken\([\s\S]*?^\}$/m
		)?.[0];
		expect(refreshFn).toBeTruthy();
		expect(refreshFn).toContain('refreshAccessTokenViaNativeBridge');
		expect(refreshFn).toContain('refreshAccessTokenViaDesktopNativeBridge');
		expect(refreshFn).not.toContain('/api/auth/refresh');
		expect(refreshFn).not.toMatch(/refreshAccessTokenViaBackend(?!Sso)/);
	});
});
