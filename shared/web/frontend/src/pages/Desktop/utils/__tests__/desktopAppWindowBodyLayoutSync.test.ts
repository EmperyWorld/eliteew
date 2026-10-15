/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression: chrome size sync must not dispatch synthetic window resize (boot
 * thrash); Suspense-settled / unminimize wake may dispatch once per flushKey.
 *
 * Related:
 * - desktopAppWindowBodyLayoutSync.ts
 * - EnhancedWindow.tsx
 * - EnhancedWindowAppContent.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	resetAppWindowContentSettledLayoutWakeForTests,
	scheduleAppWindowBodyLayoutSync,
	scheduleAppWindowContentSettledLayoutWake,
} from '../desktopAppWindowBodyLayoutSync';

const enhancedWindowSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../components/EnhancedWindow.tsx'
);

const appContentSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../components/enhancedWindow/EnhancedWindowAppContent.tsx'
);

describe('desktopAppWindowBodyLayoutSync', () => {
	beforeEach(() => {
		resetAppWindowContentSettledLayoutWakeForTests();
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(0);
			return 1;
		});
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('scheduleAppWindowBodyLayoutSync does not dispatch synthetic window resize', () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		const el = document.createElement('section');
		document.body.appendChild(el);

		scheduleAppWindowBodyLayoutSync(el);

		expect(dispatchSpy).not.toHaveBeenCalled();
		document.body.removeChild(el);
	});

	it('scheduleAppWindowContentSettledLayoutWake dispatches resize once per flushKey', () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		const el = document.createElement('section');
		document.body.appendChild(el);

		scheduleAppWindowContentSettledLayoutWake('win-a:1', el);
		vi.runAllTimers();
		expect(dispatchSpy).toHaveBeenCalledTimes(1);
		expect(dispatchSpy.mock.calls[0]?.[0]).toMatchObject({ type: 'resize' });

		scheduleAppWindowContentSettledLayoutWake('win-a:1', el);
		vi.runAllTimers();
		expect(dispatchSpy).toHaveBeenCalledTimes(1);

		scheduleAppWindowContentSettledLayoutWake('win-a:2', el);
		vi.runAllTimers();
		expect(dispatchSpy).toHaveBeenCalledTimes(2);

		document.body.removeChild(el);
	});

	it('EnhancedWindow source does not inline-dispatch synthetic window resize', () => {
		const src = readFileSync(enhancedWindowSourcePath, 'utf8');
		expect(src).not.toMatch(
			/dispatchEvent\s*\(\s*new Event\s*\(\s*['"]resize['"]\s*\)\s*\)/
		);
		expect(src).toContain('scheduleAppWindowContentSettledLayoutWake');
		expect(src).toContain('data-desktop-window-body');
	});

	it('EnhancedWindowAppContent mounts Suspense-settled layout wake', () => {
		const src = readFileSync(appContentSourcePath, 'utf8');
		expect(src).toContain('AppWindowSuspenseSettledWake');
		expect(src).toContain('scheduleAppWindowContentSettledLayoutWake');
	});
});
