/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Keycloak admin console URL builder.
 *
 * Related:
 * - `pages/Admin/adminKeycloakConsole.ts`
 */

import { describe, expect, it } from 'vitest';
import { keycloakUsersConsoleSearchUrl } from '../adminKeycloakConsole';

describe('adminKeycloakConsole', () => {
	it('builds search url with encoded email', () => {
		const url = keycloakUsersConsoleSearchUrl('a+b@test.eliteew.ru');
		expect(url).toContain('/empery/users?search=');
		expect(url).toContain(encodeURIComponent('a+b@test.eliteew.ru'));
	});

	it('returns base without query when empty', () => {
		expect(keycloakUsersConsoleSearchUrl('')).toMatch(/\/empery\/users$/);
	});
});
