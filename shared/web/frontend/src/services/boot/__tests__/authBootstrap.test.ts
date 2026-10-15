/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bounded auth bootstrap outcomes: timeout must not hang the React mount.
 *
 * Invariants:
 * - Deadline returns `timeout` without waiting for a stuck OIDC init.
 *
 * Related:
 * - `services/boot/authBootstrap.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initKeycloak = vi.fn();
const prepareOidcRuntimeProfile = vi.fn(async () => undefined);

vi.mock('@/entries/prepareOidcRuntimeProfile', () => ({
	prepareOidcRuntimeProfile: () => prepareOidcRuntimeProfile(),
}));

vi.mock('@/services/keycloak', () => ({
	initKeycloak: () => initKeycloak(),
}));

vi.mock('@/utils/logger', () => ({
	log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('authBootstrap', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		initKeycloak.mockReset();
		prepareOidcRuntimeProfile.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns authenticated when OIDC settles before the deadline', async () => {
		initKeycloak.mockResolvedValue(true);
		const { runAuthBootstrap } = await import('../authBootstrap');
		await expect(runAuthBootstrap()).resolves.toEqual({
			status: 'authenticated',
		});
	});

	it('returns timeout when OIDC never settles', async () => {
		initKeycloak.mockReturnValue(new Promise(() => undefined));
		const { AUTH_BOOTSTRAP_DEADLINE_MS, runAuthBootstrap } = await import(
			'../authBootstrap'
		);
		const outcome = runAuthBootstrap();
		await vi.advanceTimersByTimeAsync(AUTH_BOOTSTRAP_DEADLINE_MS);
		await expect(outcome).resolves.toEqual({ status: 'timeout' });
	});
});
