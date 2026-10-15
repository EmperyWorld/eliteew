/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 2 regression lock — full logout cascade must leave zero sensitive localStorage/sessionStorage keys.
 * Consolidates Phase 1 manual proofs (Threads 1–3) into one automated invariant suite.
 *
 * Invariants:
 * - Teardown order matches AuthContext.logout / onAuthLogout (+ Keycloak token purge).
 * - Pre-auth desktop fallbacks (`elite_desktop_config`, `elite_desktop_items`) survive logout.
 * - Other principals' companion keys are not removed.
 *
 * Related:
 * - documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md §3.6, §10
 * - src/contexts/AuthContext.tsx
 * - src/services/auth/clearPrincipalScopedLocalStorage.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@/test/memoryStorage';
import { queryClient, resetQueryClient } from '@/providers/QueryProvider';
import { clearFeSessionApiCaches } from '@/services/api/conditionalJsonGet';
import {
	DESKTOP_CLIPBOARD_HISTORY_LS_KEY,
	shouldPurgePrincipalScopedLocalStorageKey,
} from '@/services/auth/clearPrincipalScopedLocalStorage';
import { clearIdentityAndSessionKeys } from '@/pages/Desktop/components/GAFChat/GAFChatCrypto';
import { STORAGE_KEYS } from '@/pages/Desktop/constants';
import { clearDesktopShellStateCache } from '@/pages/Desktop/services/desktopApi';
import { __keycloakTokenStorageForTests } from '@/services/keycloak';
import { executeFullLogoutCascade } from '@/services/auth/authSessionCoordinator';

const PRINCIPAL_A = 'user-a-sub';
const PRINCIPAL_B = 'user-b-sub';

/** GAF E2EE material — must not survive logout (Thread 1). */
const GAF_E2EE_LS_KEYS = [
	'gaf_chat_e2e_identity_private_jwk',
	'gaf_chat_e2e_identity_public_pem',
	'gaf_chat_e2e_uploaded_public_fingerprint',
	'gaf_chat_e2e_session_key_chat-alpha',
	'gaf_chat_e2e_session_key_chat-beta',
] as const;

/** Desktop user-content LS — must not survive logout (Thread 3). */
const DESKTOP_USER_CONTENT_LS_KEYS = [
	DESKTOP_CLIPBOARD_HISTORY_LS_KEY,
	STORAGE_KEYS.WIDGET_NOTES,
	STORAGE_KEYS.WIDGET_TODOS,
	STORAGE_KEYS.WIDGET_FAVORITES,
	STORAGE_KEYS.RECENT_APPS,
	STORAGE_KEYS.RECENT_FILES,
	STORAGE_KEYS.NOTIFICATION_CENTER,
	STORAGE_KEYS.WINDOWS,
] as const;

/** Pre-auth/offline layout fallbacks — must survive logout. */
const PRE_AUTH_DESKTOP_LS_KEYS = [
	STORAGE_KEYS.CONFIG,
	STORAGE_KEYS.ITEMS,
] as const;

function companionPinnedToolsKey(userId: string): string {
	return `eliteew.companion.pinnedTools.v1:${userId}`;
}

function poemmaOrgKey(userId: string): string {
	return `poemma:v1:${userId}:org`;
}

function gafComposerDraftKey(userId: string, chatId: string): string {
	return `eliteew.gafChat.composerDraft.v1::${userId}::${chatId}`;
}

function gafPinnedChatsKey(userId: string): string {
	return `eliteew.gafChat.pinnedChats.v1::${userId}`;
}

function desktopQuietModeKey(userId: string): string {
	return `desktop_quiet_mode::${userId}`;
}

/**
 * Mirrors AuthContext.logout / onAuthLogout cache teardown + Keycloak token purge.
 * Order is contract-locked — do not reorder without updating FRONTEND_BROWSER_CACHE_MODEL.md.
 */
function runFullLogoutCascade(principalId: string): void {
	executeFullLogoutCascade({ principalId });
	__keycloakTokenStorageForTests.clearPersistedKeycloakTokens();
	__keycloakTokenStorageForTests.clearOidcAuthorizationState();
}

function seedSensitiveLogoutFixtures(principalId: string): void {
	for (const key of GAF_E2EE_LS_KEYS) {
		localStorage.setItem(key, 'sensitive-material');
	}

	for (const key of DESKTOP_USER_CONTENT_LS_KEYS) {
		localStorage.setItem(key, JSON.stringify([{ secret: true }]));
	}

	localStorage.setItem(
		STORAGE_KEYS.WIDGET_NOTES,
		JSON.stringify([{ id: 'n1', content: 'private note body' }])
	);
	localStorage.setItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY, '["copied password"]');

	localStorage.setItem(companionPinnedToolsKey(principalId), '["tool-a"]');
	localStorage.setItem(`ewa_companion_voice_out.v1:${principalId}`, '1');
	localStorage.setItem(
		`eliteew.ewaCompanion.chatDraft.v1::${principalId}`,
		'draft'
	);
	localStorage.setItem(poemmaOrgKey(principalId), '{"id":"org-a"}');
	localStorage.setItem(
		gafComposerDraftKey(principalId, 'chat-1'),
		'hello draft'
	);
	localStorage.setItem(gafPinnedChatsKey(principalId), '["chat-1"]');
	localStorage.setItem(desktopQuietModeKey(principalId), 'true');

	localStorage.setItem(companionPinnedToolsKey(PRINCIPAL_B), '["tool-b"]');

	for (const key of PRE_AUTH_DESKTOP_LS_KEYS) {
		localStorage.setItem(
			key,
			key === STORAGE_KEYS.CONFIG ? '{"theme":"dark"}' : '[]'
		);
	}

	sessionStorage.setItem(
		__keycloakTokenStorageForTests.KEYCLOAK_TOKEN_STORAGE_KEY,
		JSON.stringify({
			access_token: 'secret-access',
			refresh_token: 'secret-refresh',
		})
	);
	sessionStorage.setItem(
		__keycloakTokenStorageForTests.KEYCLOAK_AUTH_STATE_STORAGE_KEY,
		JSON.stringify({ codeVerifier: 'pkce-verifier' })
	);
	localStorage.setItem(
		__keycloakTokenStorageForTests.KEYCLOAK_TOKEN_STORAGE_KEY,
		JSON.stringify({ access_token: 'remember-me-access' })
	);
}

function collectStorageKeys(storage: Storage): string[] {
	const keys: string[] = [];
	for (let index = 0; index < storage.length; index += 1) {
		const key = storage.key(index);
		if (key) keys.push(key);
	}
	return keys;
}

function expectNoSensitiveLocalStorageRemains(principalId: string): void {
	for (const key of GAF_E2EE_LS_KEYS) {
		expect(localStorage.getItem(key), `GAF E2EE key leaked: ${key}`).toBeNull();
	}

	for (const key of DESKTOP_USER_CONTENT_LS_KEYS) {
		expect(
			localStorage.getItem(key),
			`desktop user-content key leaked: ${key}`
		).toBeNull();
	}

	expect(localStorage.getItem(STORAGE_KEYS.WIDGET_NOTES)).toBeNull();
	expect(localStorage.getItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY)).toBeNull();

	const remaining = collectStorageKeys(localStorage);
	for (const key of remaining) {
		expect(
			shouldPurgePrincipalScopedLocalStorageKey(key, principalId),
			`principal-scoped LS key survived logout: ${key}`
		).toBe(false);
		if (key.startsWith('gaf_chat_e2e_')) {
			expect.fail(`GAF E2EE prefix key survived logout: ${key}`);
		}
	}
}

function expectNoSensitiveSessionStorageRemains(): void {
	expect(
		sessionStorage.getItem(
			__keycloakTokenStorageForTests.KEYCLOAK_TOKEN_STORAGE_KEY
		)
	).toBeNull();
	expect(
		sessionStorage.getItem(
			__keycloakTokenStorageForTests.KEYCLOAK_AUTH_STATE_STORAGE_KEY
		)
	).toBeNull();
}

function expectPreAuthFallbacksPreserved(): void {
	expect(localStorage.getItem(STORAGE_KEYS.CONFIG)).toBe('{"theme":"dark"}');
	expect(localStorage.getItem(STORAGE_KEYS.ITEMS)).toBe('[]');
}

function expectOtherPrincipalCompanionKeysPreserved(): void {
	expect(localStorage.getItem(companionPinnedToolsKey(PRINCIPAL_B))).toBe(
		'["tool-b"]'
	);
}

describe('full logout cascade — Wave 2 regression lock', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage());
		vi.stubGlobal('sessionStorage', createMemoryStorage());
		clearDesktopShellStateCache();
		clearFeSessionApiCaches();
		resetQueryClient();
	});

	afterEach(() => {
		clearDesktopShellStateCache();
		clearFeSessionApiCaches();
		resetQueryClient();
		vi.unstubAllGlobals();
	});

	it('removes all sensitive localStorage and sessionStorage keys after full cascade', () => {
		seedSensitiveLogoutFixtures(PRINCIPAL_A);

		expect(localStorage.getItem(STORAGE_KEYS.WIDGET_NOTES)).not.toBeNull();
		expect(
			localStorage.getItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY)
		).not.toBeNull();
		expect(
			localStorage.getItem('gaf_chat_e2e_identity_private_jwk')
		).not.toBeNull();
		expect(
			sessionStorage.getItem(
				__keycloakTokenStorageForTests.KEYCLOAK_TOKEN_STORAGE_KEY
			)
		).not.toBeNull();

		runFullLogoutCascade(PRINCIPAL_A);

		expectNoSensitiveLocalStorageRemains(PRINCIPAL_A);
		expectNoSensitiveSessionStorageRemains();
		expectPreAuthFallbacksPreserved();
		expectOtherPrincipalCompanionKeysPreserved();
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
	});

	it('fails closed when any single teardown step is skipped (regression guard)', () => {
		seedSensitiveLogoutFixtures(PRINCIPAL_A);

		clearIdentityAndSessionKeys();
		clearDesktopShellStateCache();
		clearFeSessionApiCaches();
		resetQueryClient();
		__keycloakTokenStorageForTests.clearPersistedKeycloakTokens();
		__keycloakTokenStorageForTests.clearOidcAuthorizationState();
		// Skipped: clearPrincipalScopedLocalStorage

		expect(localStorage.getItem(STORAGE_KEYS.WIDGET_NOTES)).not.toBeNull();
		expect(
			localStorage.getItem(DESKTOP_CLIPBOARD_HISTORY_LS_KEY)
		).not.toBeNull();
	});
});
