/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline OIDC start to request response_mode=fragment (HTTPS bridge privacy).
 *
 * Invariants:
 * - Only foflineNative sets response_mode=fragment; web stays query default.
 *
 * Related:
 * - `keycloakOidcLoginFlow.ts`
 * - `public/fofline-oidc-bridge.html`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('oauth4webapi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('oauth4webapi')>();
	return {
		...actual,
		generateRandomState: () => 'state-test',
		generateRandomNonce: () => 'nonce-test',
		generateRandomCodeVerifier: () => 'verifier-test',
		calculatePKCECodeChallenge: vi.fn(async () => 'challenge-test'),
	};
});

import { oidcStartAuthorizationRequest } from '../keycloakOidcLoginFlow';
import { setOidcRuntimeProfile } from '../keycloakProfile';
import type { AuthOidcSessionHost } from '../keycloakOidcSessionShared';

describe('keycloakOidcLoginFlow fofline fragment mode', () => {
	const assignMock = vi.fn();

	beforeEach(() => {
		setOidcRuntimeProfile('web');
		assignMock.mockReset();
		vi.stubGlobal('location', {
			assign: assignMock,
			href: 'fofline-spa://localhost/index.html?eliteewFoflineClient=1',
			protocol: 'fofline-spa:',
			origin: 'null',
			host: 'localhost',
			hostname: 'localhost',
			pathname: '/index.html',
			search: '?eliteewFoflineClient=1',
			hash: '',
		});
	});

	afterEach(() => {
		setOidcRuntimeProfile('web');
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	function hostStub(): AuthOidcSessionHost {
		const stub = {
			oidcInteractiveRedirectInFlight: false,
			tokenPersistence: 'session' as const,
			getAuthorizationServer: async () =>
				({
					authorization_endpoint:
						'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth',
				}) as never,
		};
		return stub as unknown as AuthOidcSessionHost;
	}

	it('sets response_mode=fragment for foflineNative', async () => {
		setOidcRuntimeProfile('foflineNative');
		await oidcStartAuthorizationRequest(hostStub(), undefined, false);
		expect(assignMock).toHaveBeenCalledTimes(1);
		const url = String(assignMock.mock.calls[0]?.[0] ?? '');
		expect(url).toContain('response_mode=fragment');
		expect(url).toContain('response_type=code');
		expect(url).toContain(
			'redirect_uri=' +
				encodeURIComponent('https://app.eliteew.ru/fofline-oidc-bridge.html')
		);
	});

	it('does not set response_mode for default web profile', async () => {
		setOidcRuntimeProfile('web');
		vi.stubGlobal('location', {
			assign: assignMock,
			href: 'https://app.eliteew.ru/',
			protocol: 'https:',
			origin: 'https://app.eliteew.ru',
			host: 'app.eliteew.ru',
			hostname: 'app.eliteew.ru',
			pathname: '/',
			search: '',
			hash: '',
		});
		await oidcStartAuthorizationRequest(hostStub(), undefined, false);
		const url = String(assignMock.mock.calls[0]?.[0] ?? '');
		expect(url).not.toContain('response_mode=fragment');
	});
});
