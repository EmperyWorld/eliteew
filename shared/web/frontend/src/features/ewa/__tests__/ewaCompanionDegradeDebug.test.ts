/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for env-gated EWA companion degrade debug on the frontend.
 *
 * Invariants:
 * - VITE_EWA_COMPANION_DEGRADE_DEBUG=0 silences console.debug without changing caller fallbacks.
 *
 * Related:
 * - src/features/ewa/ewaCompanionDegradeDebug.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	ewaCompanionDegradeDebug,
	ewaCompanionDegradeDebugEnabled,
} from '../ewaCompanionDegradeDebug';

describe('ewaCompanionDegradeDebug', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('is enabled by default', () => {
		vi.stubEnv('VITE_EWA_COMPANION_DEGRADE_DEBUG', undefined);
		expect(ewaCompanionDegradeDebugEnabled()).toBe(true);
	});

	it('is disabled when env is 0', () => {
		vi.stubEnv('VITE_EWA_COMPANION_DEGRADE_DEBUG', '0');
		expect(ewaCompanionDegradeDebugEnabled()).toBe(false);
	});

	it('logs when enabled', () => {
		vi.stubEnv('VITE_EWA_COMPANION_DEGRADE_DEBUG', '1');
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		ewaCompanionDegradeDebug('unit', 'probe', new Error('boom'));
		expect(debugSpy).toHaveBeenCalled();
	});

	it('is silent when disabled', () => {
		vi.stubEnv('VITE_EWA_COMPANION_DEGRADE_DEBUG', '0');
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		ewaCompanionDegradeDebug('unit', 'probe');
		expect(debugSpy).not.toHaveBeenCalled();
	});
});
