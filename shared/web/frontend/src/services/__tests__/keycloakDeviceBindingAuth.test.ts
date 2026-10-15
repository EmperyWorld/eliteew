/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC auth_time freshness helpers for trusted-device pairing gate.
 *
 * Invariants:
 * - Mirrors backend FRESH_AUTH_MAX_AGE_SECONDS (10 minutes).
 *
 * Related:
 * - services/keycloak.ts, MobileAppHubPanel.tsx
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	FRESH_DEVICE_BINDING_AUTH_MAX_AGE_SECONDS,
	getOidcAuthAgeSeconds,
	getOidcAuthTimeEpoch,
	isOidcAuthFreshForDeviceBinding,
	keycloak,
} from '../keycloak';

describe('keycloak device-binding auth freshness', () => {
	const originalTokenParsed = keycloak.tokenParsed;

	beforeEach(() => {
		keycloak.tokenParsed = undefined;
		vi.useRealTimers();
	});

	afterEach(() => {
		keycloak.tokenParsed = originalTokenParsed;
	});

	it('returns null when auth_time is missing', () => {
		expect(getOidcAuthTimeEpoch()).toBeNull();
		expect(isOidcAuthFreshForDeviceBinding()).toBe(false);
	});

	it('treats recent auth_time as fresh', () => {
		const now = 1_700_000_000;
		vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
		keycloak.tokenParsed = {
			auth_time: now - 120,
		};
		expect(getOidcAuthAgeSeconds()).toBe(120);
		expect(isOidcAuthFreshForDeviceBinding()).toBe(true);
	});

	it('treats stale auth_time as not fresh', () => {
		const now = 1_700_000_000;
		vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
		keycloak.tokenParsed = {
			auth_time: now - FRESH_DEVICE_BINDING_AUTH_MAX_AGE_SECONDS - 1,
		};
		expect(isOidcAuthFreshForDeviceBinding()).toBe(false);
	});
});
