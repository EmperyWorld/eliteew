/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Static-to-React preloader handoff happens only after a commit helper call.
 *
 * Invariants:
 * - Handoff marks the SPA loaded and hides the static preloader.
 *
 * Related:
 * - `utils/appPreloader.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	completeAppPreloaderHandoff,
	getConfiguredPreloaderMinMs,
} from '../appPreloader';

describe('completeAppPreloaderHandoff', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '<div id="app-preloader"></div>';
		window.__REACT_APP_LOADED = false;
		window.__ELITEEW_PRELOADER_STARTED_AT = 0;
		vi.spyOn(performance, 'now').mockReturnValue(getConfiguredPreloaderMinMs());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.body.innerHTML = '';
		delete window.__REACT_APP_LOADED;
		delete window.__ELITEEW_PRELOADER_STARTED_AT;
	});

	it('hides the static preloader after React commit', () => {
		completeAppPreloaderHandoff();
		expect(window.__REACT_APP_LOADED).toBe(true);
		vi.runAllTimers();
		expect(document.getElementById('app-preloader')).toBeNull();
	});
});
