/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structural lock for keycloak-auth-002 AuthOidcFacade atomization (Stage 5).
 *
 * Invariants:
 * - Facade orchestrator ≤800 LOC; each flow module ≤800 LOC.
 * - Public barrel `keycloak.ts` still re-exports facade symbols.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const servicesDir = resolve(here, '..');

function loc(rel: string): number {
	const text = readFileSync(resolve(servicesDir, rel), 'utf8');
	return text.split(/\r?\n/).length;
}

describe('keycloakAuthOidcFacade atomization (keycloak-auth-002)', () => {
	it('keeps facade and flow modules under 800 LOC', () => {
		const files = [
			'keycloakAuthOidcFacade.ts',
			'keycloakOidcSessionShared.ts',
			'keycloakOidcLoginFlow.ts',
			'keycloakOidcCallbackFlow.ts',
			'keycloakOidcRefreshFlow.ts',
			'keycloakOidcLogoutFlow.ts',
		] as const;
		for (const file of files) {
			const n = loc(file);
			expect(n, `${file} LOC=${n}`).toBeLessThanOrEqual(800);
		}
	});

	it('barrel still re-exports facade runtime symbols', () => {
		const barrel = readFileSync(resolve(servicesDir, 'keycloak.ts'), 'utf8');
		expect(barrel).toContain("from './keycloakAuthOidcFacade'");
		expect(barrel).toContain('initKeycloak');
		expect(barrel).toContain('logout');
		expect(barrel).toContain('ensureAccessTokenMinValidity');
	});
});
