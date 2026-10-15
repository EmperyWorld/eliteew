/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Поведенческие тесты хранения OIDC-токенов: localStorage при «запомнить», sessionStorage по умолчанию.
 *
 * Invariants:
 * - При persist session=false/undefined токены не должны переживать закрытие вкладки.
 *
 * Related:
 * - `services/keycloak.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	function createMemoryStorage(): Storage {
		let store: Record<string, string> = {};
		return {
			get length() {
				return Object.keys(store).length;
			},
			clear() {
				store = {};
			},
			getItem(key: string) {
				return store[key] ?? null;
			},
			setItem(key: string, value: string) {
				store[key] = String(value);
			},
			removeItem(key: string) {
				delete store[key];
			},
			key(index: number) {
				return Object.keys(store)[index] ?? null;
			},
		};
	}
	vi.stubGlobal('localStorage', createMemoryStorage());
	vi.stubGlobal('sessionStorage', createMemoryStorage());
});

import { __keycloakTokenStorageForTests } from '../keycloak';

const {
	KEYCLOAK_TOKEN_STORAGE_KEY,
	KEYCLOAK_PERSISTENCE_PREF_KEY,
	readPersistedKeycloakTokens,
	persistKeycloakTokens,
	clearPersistedKeycloakTokens,
	resolveTokenPersistence,
} = __keycloakTokenStorageForTests;

const samplePayload = {
	token: 'access',
	refreshToken: 'refresh',
	savedAt: Date.now(),
};

describe('keycloak token persistence', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	afterEach(() => {
		clearPersistedKeycloakTokens();
		localStorage.removeItem(KEYCLOAK_PERSISTENCE_PREF_KEY);
	});

	it('resolveTokenPersistence maps persistSession flag', () => {
		expect(resolveTokenPersistence(true)).toBe('local');
		expect(resolveTokenPersistence(false)).toBe('session');
		expect(resolveTokenPersistence(undefined)).toBe('session');
		localStorage.setItem(KEYCLOAK_PERSISTENCE_PREF_KEY, 'session');
		expect(resolveTokenPersistence(undefined)).toBe('session');
	});

	it('read prefers newer savedAt when local and session both have tokens', () => {
		persistKeycloakTokens(
			{ token: 'old-at', refreshToken: 'old-rt', savedAt: 1000 },
			'local'
		);
		// Persist session without going through persistKeycloakTokens twin-clear:
		sessionStorage.setItem(
			KEYCLOAK_TOKEN_STORAGE_KEY,
			JSON.stringify({
				token: 'new-at',
				refreshToken: 'new-rt',
				savedAt: 2000,
				persistence: 'session',
			})
		);
		localStorage.setItem(
			KEYCLOAK_TOKEN_STORAGE_KEY,
			JSON.stringify({
				token: 'old-at',
				refreshToken: 'old-rt',
				savedAt: 1000,
				persistence: 'local',
			})
		);
		const read = readPersistedKeycloakTokens();
		expect(read?.refreshToken).toBe('new-rt');
		expect(read?.persistence).toBe('session');
	});

	it('stores remembered tokens in localStorage only', () => {
		persistKeycloakTokens(samplePayload, 'local');
		expect(localStorage.getItem(KEYCLOAK_TOKEN_STORAGE_KEY)).toContain(
			'refresh'
		);
		expect(sessionStorage.getItem(KEYCLOAK_TOKEN_STORAGE_KEY)).toBeNull();
		expect(readPersistedKeycloakTokens()?.refreshToken).toBe('refresh');
	});

	it('stores session-only tokens in sessionStorage and clears local copy', () => {
		persistKeycloakTokens(samplePayload, 'local');
		persistKeycloakTokens(samplePayload, 'session');
		expect(localStorage.getItem(KEYCLOAK_TOKEN_STORAGE_KEY)).toBeNull();
		expect(sessionStorage.getItem(KEYCLOAK_TOKEN_STORAGE_KEY)).toContain(
			'refresh'
		);
		expect(readPersistedKeycloakTokens()?.persistence).toBe('session');
	});

	it('restores access-only payload when allowAccessOnly (native bridge)', () => {
		persistKeycloakTokens(
			{ token: 'access-only', savedAt: Date.now() },
			'session'
		);
		expect(readPersistedKeycloakTokens()).toBeNull();
		expect(readPersistedKeycloakTokens({ allowAccessOnly: true })?.token).toBe(
			'access-only'
		);
		expect(
			readPersistedKeycloakTokens({ allowAccessOnly: true })?.refreshToken
		).toBeUndefined();
	});
});
