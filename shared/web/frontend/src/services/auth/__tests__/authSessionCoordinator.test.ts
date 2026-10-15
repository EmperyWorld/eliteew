/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for AuthSessionCoordinator — §3.4 cascade hub and broken-init teardown (G1/G2).
 *
 * Related:
 * - authSessionCoordinator.ts, keycloak.ts init failure paths, AuthContext.tsx
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@/test/memoryStorage';
import { queryClient } from '@/providers/QueryProvider';
import { PROFILE_ME_QUERY_KEY } from '@/services/profileService';
import { useCompanionOperationsStore } from '@/features/ewa/companionOperations/companionOperationsStore';
import {
	executeFullLogoutCascade,
	executePostKeycloakSessionClearCascade,
} from '@/services/auth/authSessionCoordinator';
import { __keycloakTokenStorageForTests } from '@/services/keycloak';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

const PRINCIPAL_A = 'user-a-sub';
const OIDC_TOKEN_KEY = 'eliteew.keycloak.oidcTokens.v1';
const OIDC_AUTH_STATE_KEY = 'eliteew.keycloak.oidcAuthState.v1';

function seedBrokenInitFixtures(): void {
	localStorage.setItem('gaf_chat_e2e_identity_private_jwk', 'secret-jwk');
	localStorage.setItem(
		`eliteew.companion.pinnedTools.v1:${PRINCIPAL_A}`,
		'["tool"]'
	);
	sessionStorage.setItem(
		OIDC_TOKEN_KEY,
		JSON.stringify({
			token: 'access',
			refreshToken: 'refresh',
			idToken: 'id',
			persistence: 'session',
		})
	);
	sessionStorage.setItem(
		OIDC_AUTH_STATE_KEY,
		JSON.stringify({ state: 'pkce-state', codeVerifier: 'verifier' })
	);
}

/** Mirrors keycloak.init invalid-session / callback-failure after clearSession(true). */
function simulateBrokenInitPageLoad(principalId: string): void {
	__keycloakTokenStorageForTests.clearPersistedKeycloakTokens();
	__keycloakTokenStorageForTests.clearOidcAuthorizationState();
	executePostKeycloakSessionClearCascade({ principalId });
}

describe('AuthSessionCoordinator', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage());
		vi.stubGlobal('sessionStorage', createMemoryStorage());
		queryClient.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		queryClient.clear();
	});

	it('executeFullLogoutCascade clears React Query RAM', () => {
		queryClient.setQueryData(PROFILE_ME_QUERY_KEY, { id: PRINCIPAL_A });
		executeFullLogoutCascade({ principalId: PRINCIPAL_A });
		expect(queryClient.getQueryCache().getAll().length).toBe(0);
	});

	it('E3: executeFullLogoutCascade resets companion operations store', () => {
		useCompanionOperationsStore.getState().mergeIncomingRuns([
			{
				id: 'run-ghost',
				principal_id: PRINCIPAL_A,
				status: 'running',
				intent_kind: 'action_workflow',
				run_revision: 1,
			} as EwaCompanionTaskRun,
		]);
		expect(useCompanionOperationsStore.getState().operationRuns.length).toBe(1);
		executeFullLogoutCascade({ principalId: PRINCIPAL_A });
		expect(useCompanionOperationsStore.getState().operationRuns).toEqual([]);
	});

	it('broken init leaves localStorage and sessionStorage empty of seeded auth material (G1/G2)', () => {
		seedBrokenInitFixtures();
		expect(localStorage.length).toBeGreaterThan(0);
		expect(sessionStorage.length).toBeGreaterThan(0);

		simulateBrokenInitPageLoad(PRINCIPAL_A);

		expect(localStorage.length).toBe(0);
		expect(sessionStorage.length).toBe(0);
		expect(
			localStorage.getItem('gaf_chat_e2e_identity_private_jwk')
		).toBeNull();
		expect(sessionStorage.getItem(OIDC_TOKEN_KEY)).toBeNull();
		expect(sessionStorage.getItem(OIDC_AUTH_STATE_KEY)).toBeNull();
	});
});
