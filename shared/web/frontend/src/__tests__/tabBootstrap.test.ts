/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for early tab bootstrap route and OAuth precedence.
 *
 * Invariants:
 * - OAuth callback is always handled by the full entry before follower election.
 * - Empty Desktop route participates in election for persisted browser sessions.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { resolveTabBootstrapRole } from '@/tabBootstrap';

const KEYCLOAK_TOKEN_KEY = 'eliteew.keycloak.oidcTokens.v1';

function mockStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key: string) => map.get(key) ?? null,
		key: (index: number) => [...map.keys()][index] ?? null,
		removeItem: (key: string) => {
			map.delete(key);
		},
		setItem: (key: string, value: string) => {
			map.set(key, value);
		},
	};
}

function mockJwt(sub: string): string {
	const header = btoa(JSON.stringify({ alg: 'none' }));
	const payload = btoa(JSON.stringify({ sub }));
	return `${header}.${payload}.sig`;
}

describe('tabBootstrap mobile-app-download', () => {
	beforeEach(() => {
		const local = mockStorage();
		const session = mockStorage();
		Object.defineProperty(globalThis, 'localStorage', {
			value: local,
			configurable: true,
		});
		Object.defineProperty(globalThis, 'sessionStorage', {
			value: session,
			configurable: true,
		});
		window.history.replaceState(null, '', '/');
	});

	it('skips election on standalone /mobile-app/ path', () => {
		localStorage.setItem(
			KEYCLOAK_TOKEN_KEY,
			JSON.stringify({ accessToken: mockJwt('user-1') })
		);
		window.history.replaceState(null, '', '/mobile-app/');
		expect(resolveTabBootstrapRole()).toBe('skip');
	});

	it('skips election on #/mobile-app-download hash (legacy)', () => {
		localStorage.setItem(
			KEYCLOAK_TOKEN_KEY,
			JSON.stringify({ accessToken: mockJwt('user-1') })
		);
		window.history.replaceState(null, '', '/#/mobile-app-download');
		expect(resolveTabBootstrapRole()).toBe('skip');
	});

	it('skips election on OAuth callback when intended page is mobile-app-download', () => {
		localStorage.setItem(
			KEYCLOAK_TOKEN_KEY,
			JSON.stringify({ accessToken: mockJwt('user-1') })
		);
		window.history.replaceState(null, '', '/?code=abc&state=xyz');
		expect(resolveTabBootstrapRole()).toBe('skip');
	});

	it('skips early election on OAuth callback even for a persisted Desktop user', () => {
		localStorage.setItem(
			KEYCLOAK_TOKEN_KEY,
			JSON.stringify({ accessToken: mockJwt('user-1') })
		);
		window.history.replaceState(null, '', '/?code=abc&state=xyz');
		expect(resolveTabBootstrapRole()).toBe('skip');
	});

	it('runs election on the empty route because React defaults it to Desktop', () => {
		localStorage.setItem(
			KEYCLOAK_TOKEN_KEY,
			JSON.stringify({ accessToken: mockJwt('user-1') })
		);
		window.history.replaceState(null, '', '/');
		expect(resolveTabBootstrapRole()).toBe('leader');
	});
});
