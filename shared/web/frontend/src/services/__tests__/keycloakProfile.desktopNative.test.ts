/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for OIDC profile client ids including desktopNative.
 *
 * Related:
 * - keycloakProfile.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	getOidcRuntimeProfile,
	getProfileKeycloakClientId,
	getProfileTokenStorageKey,
	setOidcRuntimeProfile,
} from '../keycloakProfile';

describe('keycloakProfile desktopNative', () => {
	afterEach(() => {
		setOidcRuntimeProfile('web');
	});

	it('maps desktopNative to empery-desktop and isolated storage key', () => {
		setOidcRuntimeProfile('desktopNative');
		expect(getOidcRuntimeProfile()).toBe('desktopNative');
		expect(getProfileKeycloakClientId()).toBe('empery-desktop');
		expect(getProfileTokenStorageKey()).toContain('desktopNative');
	});

	it('does not bleed desktopNative into web default', () => {
		setOidcRuntimeProfile('web');
		expect(getProfileKeycloakClientId()).toBe('empery-web');
	});
});
