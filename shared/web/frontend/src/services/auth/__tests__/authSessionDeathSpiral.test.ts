/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock — auth refresh/socket/HTTP death spiral must coalesce to one teardown wave.
 *
 * Related:
 * - authSessionCoordinator.ts, AuthContext.tsx, services/api/client.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@/test/memoryStorage';
import { queryClient, resetQueryClient } from '@/providers/QueryProvider';
import { STORAGE_KEYS } from '@/pages/Desktop/constants';
import {
	abortAllPendingHttpRequests,
	getAuthSessionAbortSignal,
	getActiveRequestAbortControllerCount,
	registerActiveRequestAbortController,
	resetAuthSessionHttpAbortForTests,
} from '@/services/auth/authSessionHttpAbort';
import * as authSessionHttpAbort from '@/services/auth/authSessionHttpAbort';
import * as authSessionSocketTeardown from '@/services/auth/authSessionSocketTeardown';
import {
	beginAuthSessionTeardown,
	clearAuthSessionHttpFreeze,
	endAuthSessionTeardown,
	isAuthSessionLocked,
	resetAuthSessionLockForTests,
} from '@/services/auth/authSessionLock';
import {
	executeAuthSessionTermination,
	executeFullLogoutCascade,
} from '@/services/auth/authSessionCoordinator';
import {
	registerAuthSessionSocketTeardown,
	resetAuthSessionSocketTeardownForTests,
	terminateAllAuthenticatedSockets,
} from '@/services/auth/authSessionSocketTeardown';
import { recoverSocketAuthConnection } from '@/services/auth/authenticatedSocketAuth';

const PRINCIPAL_A = 'user-a-sub';

describe('auth session death spiral — kill switch', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage());
		vi.stubGlobal('sessionStorage', createMemoryStorage());
		resetAuthSessionLockForTests();
		resetAuthSessionHttpAbortForTests();
		resetAuthSessionSocketTeardownForTests();
		resetQueryClient();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		resetAuthSessionLockForTests();
		resetAuthSessionHttpAbortForTests();
		resetAuthSessionSocketTeardownForTests();
		resetQueryClient();
	});

	it('auth session lock prevents re-entry during teardown', () => {
		expect(beginAuthSessionTeardown()).toBe(true);
		expect(beginAuthSessionTeardown()).toBe(false);
		expect(isAuthSessionLocked()).toBe(true);
		endAuthSessionTeardown();
		expect(isAuthSessionLocked()).toBe(true);
		clearAuthSessionHttpFreeze();
		expect(isAuthSessionLocked()).toBe(false);
	});

	it('abortAllPendingHttpRequests aborts every registered in-flight request', () => {
		const first = registerActiveRequestAbortController();
		const second = registerActiveRequestAbortController();
		expect(getActiveRequestAbortControllerCount()).toBe(2);
		expect(first.signal.aborted).toBe(false);
		abortAllPendingHttpRequests();
		expect(first.signal.aborted).toBe(true);
		expect(second.signal.aborted).toBe(true);
		expect(getActiveRequestAbortControllerCount()).toBe(0);
	});

	it('active download aborts before 401 auth cascade can re-enter', async () => {
		const registration = registerActiveRequestAbortController();
		beginAuthSessionTeardown();
		abortAllPendingHttpRequests();
		endAuthSessionTeardown();
		expect(registration.signal.aborted).toBe(true);
		expect(isAuthSessionLocked()).toBe(true);
		clearAuthSessionHttpFreeze();
	});

	it('executeAuthSessionTermination runs abort and socket kill-switch steps', () => {
		const abortSpy = vi.spyOn(
			authSessionHttpAbort,
			'abortAllPendingHttpRequests'
		);
		const socketSpy = vi.spyOn(
			authSessionSocketTeardown,
			'terminateAllAuthenticatedSockets'
		);
		expect(executeAuthSessionTermination({ principalId: PRINCIPAL_A })).toBe(
			true
		);
		expect(abortSpy).toHaveBeenCalledTimes(1);
		expect(socketSpy).toHaveBeenCalledTimes(1);
		abortSpy.mockRestore();
		socketSpy.mockRestore();
	});

	it('abortAllPendingHttpRequests aborts the session epoch signal', () => {
		const signal = getAuthSessionAbortSignal();
		expect(signal?.aborted).toBe(false);
		abortAllPendingHttpRequests();
		expect(signal?.aborted).toBe(true);
	});

	it('terminateAllAuthenticatedSockets invokes registered hook disconnectors', () => {
		const disconnect = vi.fn();
		const unregister = registerAuthSessionSocketTeardown(disconnect);
		terminateAllAuthenticatedSockets();
		expect(disconnect).toHaveBeenCalledTimes(1);
		unregister();
	});

	it('recoverSocketAuthConnection is no-op while auth session lock is held', async () => {
		const { beginAuthSessionTeardown, endAuthSessionTeardown } = await import(
			'@/services/auth/authSessionLock'
		);
		beginAuthSessionTeardown();
		const reconnect = vi.fn();
		await recoverSocketAuthConnection({ reconnect });
		expect(reconnect).not.toHaveBeenCalled();
		endAuthSessionTeardown();
	});

	it('multi-cycle recover during lock + parallel terminate coalesce to one teardown wave', async () => {
		const abortSpy = vi.spyOn(
			authSessionHttpAbort,
			'abortAllPendingHttpRequests'
		);
		const socketSpy = vi.spyOn(
			authSessionSocketTeardown,
			'terminateAllAuthenticatedSockets'
		);
		const reconnect = vi.fn();

		beginAuthSessionTeardown();
		await Promise.all([
			recoverSocketAuthConnection({ reconnect }),
			recoverSocketAuthConnection({ reconnect }),
			recoverSocketAuthConnection({ reconnect }),
		]);
		expect(reconnect).not.toHaveBeenCalled();

		// Lock already held — parallel terminate must not start a second wave.
		expect(executeAuthSessionTermination({ principalId: PRINCIPAL_A })).toBe(
			false
		);
		expect(executeAuthSessionTermination({ principalId: PRINCIPAL_A })).toBe(
			false
		);
		expect(abortSpy).not.toHaveBeenCalled();
		expect(socketSpy).not.toHaveBeenCalled();

		endAuthSessionTeardown();
		expect(executeAuthSessionTermination({ principalId: PRINCIPAL_A })).toBe(
			true
		);
		expect(abortSpy).toHaveBeenCalledTimes(1);
		expect(socketSpy).toHaveBeenCalledTimes(1);

		abortSpy.mockRestore();
		socketSpy.mockRestore();
	});

	it('callbackFailed and session_replaced pending markers stay sticky until cleared', async () => {
		const {
			markAuthCallbackFailed,
			clearAuthCallbackFailed,
			hasAuthCallbackFailed,
			markSessionReplacedPending,
			clearSessionReplacedPending,
			hasSessionReplacedPending,
		} = await import('@/utils/authRedirect');

		expect(hasAuthCallbackFailed()).toBe(false);
		markAuthCallbackFailed();
		expect(hasAuthCallbackFailed()).toBe(true);
		clearAuthCallbackFailed();
		expect(hasAuthCallbackFailed()).toBe(false);

		expect(hasSessionReplacedPending()).toBe(false);
		markSessionReplacedPending();
		expect(hasSessionReplacedPending()).toBe(true);
		clearSessionReplacedPending();
		expect(hasSessionReplacedPending()).toBe(false);
	});

	it('session_replaced integrity — no prior-user desktop LS after termination', () => {
		localStorage.setItem(
			STORAGE_KEYS.WIDGET_NOTES,
			JSON.stringify([{ id: 'n1', content: 'secret' }])
		);
		localStorage.setItem(
			`eliteew.companion.pinnedTools.v1:${PRINCIPAL_A}`,
			'["tool"]'
		);
		queryClient.setQueryData(['profile', 'me'], { id: PRINCIPAL_A });

		executeAuthSessionTermination({ principalId: PRINCIPAL_A });

		expect(localStorage.getItem(STORAGE_KEYS.WIDGET_NOTES)).toBeNull();
		expect(
			localStorage.getItem(`eliteew.companion.pinnedTools.v1:${PRINCIPAL_A}`)
		).toBeNull();
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
	});

	it('executeFullLogoutCascade remains available for cache-only callers', () => {
		localStorage.setItem(
			`eliteew.companion.pinnedTools.v1:${PRINCIPAL_A}`,
			'["tool"]'
		);
		executeFullLogoutCascade({ principalId: PRINCIPAL_A });
		expect(
			localStorage.getItem(`eliteew.companion.pinnedTools.v1:${PRINCIPAL_A}`)
		).toBeNull();
	});
});
