/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for FoFline OIDC bootstrap query/sticky keys (W2).
 *
 * Related:
 * - setupFoflineOidcProfile.ts
 */

import { describe, expect, it } from 'vitest';
import {
	FOFLINE_CLIENT_QUERY,
	FOFLINE_NATIVE_FLAG_KEY,
} from '../setupFoflineOidcProfile';

describe('fofline OIDC bootstrap constants', () => {
	it('uses stable query and storage keys', () => {
		expect(FOFLINE_CLIENT_QUERY).toBe('eliteewFoflineClient');
		expect(FOFLINE_NATIVE_FLAG_KEY).toBe('eliteew.foflineClient.v1');
	});
});
