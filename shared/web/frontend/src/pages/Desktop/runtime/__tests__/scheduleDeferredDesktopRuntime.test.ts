/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for deferred Desktop runtime scheduling.
 *
 * Invariants:
 * - Hidden-tab fallback fires by max delay even without idle callback.
 *
 * Related:
 * - `pages/Desktop/runtime/scheduleDeferredDesktopRuntime.ts`
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DESKTOP_DEFERRED_RUNTIME_MAX_DELAY_MS,
	scheduleDeferredDesktopRuntime,
} from '../scheduleDeferredDesktopRuntime';

describe('scheduleDeferredDesktopRuntime', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('activates once via the max-delay fallback', () => {
		vi.useFakeTimers();
		const activate = vi.fn();
		const cancel = scheduleDeferredDesktopRuntime(activate, 50);
		expect(activate).not.toHaveBeenCalled();
		vi.advanceTimersByTime(50);
		expect(activate).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(50);
		expect(activate).toHaveBeenCalledTimes(1);
		cancel();
	});

	it('does not activate after cancellation', () => {
		vi.useFakeTimers();
		const activate = vi.fn();
		const cancel = scheduleDeferredDesktopRuntime(
			activate,
			DESKTOP_DEFERRED_RUNTIME_MAX_DELAY_MS
		);
		cancel();
		vi.advanceTimersByTime(DESKTOP_DEFERRED_RUNTIME_MAX_DELAY_MS);
		expect(activate).not.toHaveBeenCalled();
	});
});
