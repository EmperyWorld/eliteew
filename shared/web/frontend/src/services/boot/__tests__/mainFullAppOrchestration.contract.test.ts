/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-entry orchestration must start OIDC in parallel with cold i18n and React.
 *
 * Invariants:
 * - KeycloakInit is not the auth owner.
 * - Native OIDC profile setup is not a static import on the web path.
 *
 * Related:
 * - `mainFullApp.ts`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('full SPA boot orchestration', () => {
	it('starts bounded auth before waiting on the React app graph', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../../../mainFullApp.ts'), 'utf8');
		expect(src).toContain('runAuthBootstrap()');
		expect(src).toContain("import('./i18n/config')");
		expect(src).toContain("import('./reactAppEntry')");
		expect(src).toContain('Promise.all');
		expect(src).not.toContain('KeycloakInit');
		expect(src).not.toContain('setupDesktopNativeOidcProfile');
		expect(src).not.toContain('setupMobileEmbeddedOidcProfile');
		expect(src.indexOf('runAuthBootstrap()')).toBeLessThan(
			src.indexOf("import('./reactAppEntry')")
		);
	});
});
