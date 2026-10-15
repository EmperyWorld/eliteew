/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Meta Quest / VR browser laser-pointer detection helpers.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	DESKTOP_LASER_POINTER_DISMISS_EVENT,
	DESKTOP_LASER_POINTER_ROOT_CLASS,
	detectDesktopLaserPointerEnvironment,
	dismissDesktopLaserPointerHoverChrome,
	markDesktopLaserPointerRoot,
} from '@/pages/Desktop/utils/desktopLaserPointerEnvironment';

describe('desktopLaserPointerEnvironment', () => {
	it('detects OculusBrowser user agent', () => {
		vi.stubGlobal('navigator', {
			userAgent:
				'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 OculusBrowser/7.0',
		});
		expect(detectDesktopLaserPointerEnvironment()).toBe(true);
		vi.unstubAllGlobals();
	});

	it('detects Quest 3 Android browser hints', () => {
		vi.stubGlobal('navigator', {
			userAgent:
				'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36',
		});
		expect(detectDesktopLaserPointerEnvironment()).toBe(true);
		vi.unstubAllGlobals();
	});

	it('returns false for regular desktop Chrome', () => {
		vi.stubGlobal('navigator', {
			userAgent:
				'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
		});
		expect(detectDesktopLaserPointerEnvironment()).toBe(false);
		vi.unstubAllGlobals();
	});

	it('marks html root class when Quest UA is present', () => {
		vi.stubGlobal('navigator', {
			userAgent: 'OculusBrowser/7.0 Quest 3',
		});
		document.documentElement.classList.remove(DESKTOP_LASER_POINTER_ROOT_CLASS);
		expect(markDesktopLaserPointerRoot()).toBe(true);
		expect(
			document.documentElement.classList.contains(
				DESKTOP_LASER_POINTER_ROOT_CLASS
			)
		).toBe(true);
		document.documentElement.classList.remove(DESKTOP_LASER_POINTER_ROOT_CLASS);
		vi.unstubAllGlobals();
	});

	it('dispatches hover dismiss custom event', () => {
		const listener = vi.fn();
		window.addEventListener(DESKTOP_LASER_POINTER_DISMISS_EVENT, listener);
		dismissDesktopLaserPointerHoverChrome();
		expect(listener).toHaveBeenCalledTimes(1);
		window.removeEventListener(DESKTOP_LASER_POINTER_DISMISS_EVENT, listener);
	});
});
