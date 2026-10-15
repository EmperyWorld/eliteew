/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for env-gated EliteEW frontend degrade debug.
 *
 * Invariants:
 * - VITE_ELITEEW_DEGRADE_DEBUG=0 silences console.debug without changing caller fallbacks.
 *
 * Related:
 * - src/utils/eliteewDegradeDebug.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	eliteewDegradeDebug,
	eliteewDegradeDebugEnabled,
} from '../eliteewDegradeDebug';

describe('eliteewDegradeDebug', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('is enabled by default', () => {
		vi.stubEnv('VITE_ELITEEW_DEGRADE_DEBUG', undefined);
		expect(eliteewDegradeDebugEnabled()).toBe(true);
	});

	it('is disabled when env is 0', () => {
		vi.stubEnv('VITE_ELITEEW_DEGRADE_DEBUG', '0');
		expect(eliteewDegradeDebugEnabled()).toBe(false);
	});

	it('logs when enabled', () => {
		vi.stubEnv('VITE_ELITEEW_DEGRADE_DEBUG', '1');
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		eliteewDegradeDebug('unit', 'probe', new Error('boom'));
		expect(debugSpy).toHaveBeenCalled();
	});

	it('is silent when disabled', () => {
		vi.stubEnv('VITE_ELITEEW_DEGRADE_DEBUG', '0');
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		eliteewDegradeDebug('unit', 'probe');
		expect(debugSpy).not.toHaveBeenCalled();
	});
});
