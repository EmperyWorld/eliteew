/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Keycloak reset-credentials URL builder.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildKeycloakPasswordResetUrl } from '@/services/keycloak';

describe('buildKeycloakPasswordResetUrl', () => {
	const originalEnv = { ...import.meta.env };

	beforeEach(() => {
		vi.stubEnv('VITE_KEYCLOAK_URL', 'https://auth.eliteew.ru');
		vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', 'empery-web');
	});

	afterEach(() => {
		Object.assign(import.meta.env, originalEnv);
		vi.unstubAllEnvs();
	});

	it('builds reset-credentials URL with client_id', () => {
		const url = new URL(buildKeycloakPasswordResetUrl());
		expect(url.origin + url.pathname).toBe(
			'https://auth.eliteew.ru/realms/empery/login-actions/reset-credentials'
		);
		expect(url.searchParams.get('client_id')).toBe('empery-web');
		expect(url.searchParams.has('redirect_uri')).toBe(false);
	});

	it('includes normalized redirect_uri when provided', () => {
		const url = new URL(
			buildKeycloakPasswordResetUrl({
				redirectUri: 'https://app.eliteew.ru/desktop#profile',
			})
		);
		expect(url.searchParams.get('redirect_uri')).toBe(
			'https://app.eliteew.ru/desktop'
		);
	});
});
