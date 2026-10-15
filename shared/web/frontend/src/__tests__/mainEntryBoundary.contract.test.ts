/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard the pre-React entry: no React/auth/API/i18n static imports.
 *
 * Invariants:
 * - Reload ledger is the only maintenance import allowed on this path.
 *
 * Related:
 * - `main.tsx`
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('minimal SPA entry boundary', () => {
	it('keeps main.tsx free of React, auth, i18n, and API graphs', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../main.tsx'), 'utf8');
		expect(src).toContain('bootstrapReloadLedgerFromUrl');
		expect(src).not.toMatch(/from ['"].*reloadCircuitBreaker['"]/);
		expect(src).not.toMatch(/from ['"]react['"]/);
		expect(src).not.toMatch(/from ['"].*i18n\/config['"]/);
		expect(src).not.toMatch(/from ['"].*KeycloakInit['"]/);
		expect(src).not.toMatch(/from ['"].*services\/keycloak['"]/);
		expect(src).not.toMatch(/from ['"].*axiosSetup['"]/);
	});
});
