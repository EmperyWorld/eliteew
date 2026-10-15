/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * PKCE authorization state must survive session_replaced storms while login redirect is in flight.
 *
 * Invariants:
 * - notifySessionReplaced must not wipe sessionStorage PKCE state during oidcInteractiveRedirectInFlight.
 *
 * Related:
 * - `services/keycloak.ts`, `services/api/client.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	notifySessionReplaced,
	__keycloakTokenStorageForTests,
} from '../keycloak';
import {
	markSessionReplaceConfirmedWindow,
	resetSessionReplaceConfirmationStateForTests,
} from '../auth/ssoSessionReplaceConfirm';
import { hasSessionReplacedPending } from '../../utils/authRedirect';

const {
	KEYCLOAK_AUTH_STATE_STORAGE_KEY,
	writeOidcAuthorizationState,
	readOidcAuthorizationState,
	clearOidcAuthorizationState,
	exchangeAuthorizationCodeViaBackendForTests,
	setOidcInteractiveRedirectInFlightForTests,
} = __keycloakTokenStorageForTests;

const sampleAuthState = {
	state: 'state-abc',
	nonce: 'nonce-xyz',
	codeVerifier: 'verifier-123',
	redirectUri: 'https://app.eliteew.ru/',
	register: false,
	savedAt: Date.now(),
};

describe('OIDC authorization state preservation', () => {
	beforeEach(() => {
		sessionStorage.clear();
		setOidcInteractiveRedirectInFlightForTests(false);
		resetSessionReplaceConfirmationStateForTests();
	});

	afterEach(() => {
		clearOidcAuthorizationState();
		setOidcInteractiveRedirectInFlightForTests(false);
		resetSessionReplaceConfirmationStateForTests();
		vi.restoreAllMocks();
	});

	it('clears PKCE state on notifySessionReplaced when login redirect is idle', () => {
		writeOidcAuthorizationState(sampleAuthState);
		notifySessionReplaced('test');
		expect(readOidcAuthorizationState()).toBeNull();
		expect(sessionStorage.getItem(KEYCLOAK_AUTH_STATE_STORAGE_KEY)).toBeNull();
	});

	it('preserves PKCE state on notifySessionReplaced during interactive redirect', () => {
		writeOidcAuthorizationState(sampleAuthState);
		setOidcInteractiveRedirectInFlightForTests(true);
		notifySessionReplaced('test');
		expect(readOidcAuthorizationState()?.state).toBe('state-abc');
	});

	it('exchanges web authorization code through backend SSO callback', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					tokens: {
						access_token: 'access-token',
						refresh_token: 'refresh-token',
						expires_in: 300,
						token_type: 'Bearer',
						id_token: 'id-token',
					},
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		const result = await exchangeAuthorizationCodeViaBackendForTests({
			code: 'auth-code',
			state: 'state-abc',
			redirectUri: 'https://app.eliteew.ru/',
			codeVerifier: 'verifier-123',
		});

		expect(result.tokens?.access_token).toBe('access-token');
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/api/v1/auth/sso/callback'),
			expect.objectContaining({
				method: 'POST',
				credentials: 'include',
				body: JSON.stringify({
					code: 'auth-code',
					state: 'state-abc',
					redirect_uri: 'https://app.eliteew.ru/',
					code_verifier: 'verifier-123',
					client_id: 'empery-web',
				}),
			})
		);
	});

	it('FoFline local ?code= handoff exchanges stored HTTPS bridge redirect_uri', async () => {
		const bridgeRedirect = 'https://app.eliteew.ru/fofline-oidc-bridge.html';
		writeOidcAuthorizationState({
			...sampleAuthState,
			redirectUri: bridgeRedirect,
		});
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					tokens: {
						access_token: 'access-token',
						refresh_token: 'refresh-token',
						expires_in: 300,
						token_type: 'Bearer',
						id_token: 'id-token',
					},
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await exchangeAuthorizationCodeViaBackendForTests({
			code: 'auth-code-from-local-handoff',
			state: 'state-abc',
			redirectUri: readOidcAuthorizationState()?.redirectUri ?? '',
			codeVerifier: 'verifier-123',
		});

		expect(readOidcAuthorizationState()?.redirectUri).toBe(bridgeRedirect);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/api/v1/auth/sso/callback'),
			expect.objectContaining({
				body: JSON.stringify({
					code: 'auth-code-from-local-handoff',
					state: 'state-abc',
					redirect_uri: bridgeRedirect,
					code_verifier: 'verifier-123',
					client_id: 'empery-web',
				}),
			})
		);
	});

	it('marks session replacement pending when backend callback requires confirmation', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					detail: {
						reason: 'session_replace_confirmation_required',
						action: 'login',
						detail: 'Confirm replacing active browser session',
					},
				}),
				{ status: 409, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await expect(
			exchangeAuthorizationCodeViaBackendForTests({
				code: 'auth-code',
				state: 'state-abc',
				redirectUri: 'https://app.eliteew.ru/',
				codeVerifier: 'verifier-123',
			})
		).rejects.toThrow('requires explicit session replacement confirmation');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(hasSessionReplacedPending()).toBe(true);
	});

	it('sends replace confirmation header when confirmation window is active', async () => {
		markSessionReplaceConfirmedWindow();
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					tokens: {
						access_token: 'access-token',
						refresh_token: 'refresh-token',
						expires_in: 300,
						token_type: 'Bearer',
					},
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await exchangeAuthorizationCodeViaBackendForTests({
			code: 'auth-code',
			state: 'state-abc',
			redirectUri: 'https://app.eliteew.ru/',
			codeVerifier: 'verifier-123',
		});

		expect(fetchMock.mock.calls[0]?.[1]).toEqual(
			expect.objectContaining({
				headers: expect.objectContaining({
					'X-SSO-Replace-Confirm': '1',
				}),
			})
		);
	});
});
