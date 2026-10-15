/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for foflineNative OIDC profile client id + storage isolation (W2).
 *
 * Related:
 * - keycloakProfile.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §5
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	getOidcRuntimeProfile,
	getProfileKeycloakClientId,
	getProfilePersistencePrefKey,
	getProfileTokenStorageKey,
	profileAllowsLocalTokenStorage,
	setOidcRuntimeProfile,
} from '../keycloakProfile';

describe('keycloakProfile foflineNative', () => {
	afterEach(() => {
		setOidcRuntimeProfile('web');
	});

	it('maps foflineNative to empery-fofline and isolated storage key', () => {
		setOidcRuntimeProfile('foflineNative');
		expect(getOidcRuntimeProfile()).toBe('foflineNative');
		expect(getProfileKeycloakClientId()).toBe('empery-fofline');
		expect(getProfileTokenStorageKey()).toContain('foflineNative');
	});

	it('bans localStorage OIDC tokens for foflineNative (session only)', () => {
		setOidcRuntimeProfile('foflineNative');
		expect(profileAllowsLocalTokenStorage()).toBe(false);
		expect(getProfilePersistencePrefKey()).toBeNull();
	});

	it('does not bleed foflineNative into web or desktopNative defaults', () => {
		setOidcRuntimeProfile('web');
		expect(getProfileKeycloakClientId()).toBe('empery-web');
		setOidcRuntimeProfile('desktopNative');
		expect(getProfileKeycloakClientId()).toBe('empery-desktop');
	});
});
