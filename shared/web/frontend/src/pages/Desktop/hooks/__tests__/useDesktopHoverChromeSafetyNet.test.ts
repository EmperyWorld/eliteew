/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop hover chrome safety net (tooltips + taskbar previews).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopHoverChromeSafetyNet } from '@/pages/Desktop/hooks/useDesktopHoverChromeSafetyNet';
import { DESKTOP_LASER_POINTER_DISMISS_EVENT } from '@/pages/Desktop/utils/desktopLaserPointerEnvironment';

const dismissHoverChrome = vi.fn();

vi.mock('@/pages/Desktop/utils/desktopLaserPointerEnvironment', async () => {
	const actual = await vi.importActual<
		typeof import('@/pages/Desktop/utils/desktopLaserPointerEnvironment')
	>('@/pages/Desktop/utils/desktopLaserPointerEnvironment');
	return {
		...actual,
		dismissDesktopHoverChrome: () => dismissHoverChrome(),
	};
});

describe('useDesktopHoverChromeSafetyNet', () => {
	let elementFromPointRestore: (() => void) | null = null;
	let desktopMain: HTMLElement | null = null;

	beforeEach(() => {
		vi.clearAllMocks();
		desktopMain = document.createElement('main');
		desktopMain.id = 'desktop-main';
		document.body.append(desktopMain);
	});

	afterEach(() => {
		desktopMain?.remove();
		desktopMain = null;
		elementFromPointRestore?.();
		elementFromPointRestore = null;
	});

	function stubElementFromPoint(
		impl: (x: number, y: number) => Element | null
	): void {
		const spy = vi.fn(impl);
		if (typeof document.elementFromPoint === 'function') {
			vi.spyOn(document, 'elementFromPoint').mockImplementation(spy);
			elementFromPointRestore = () => {
				vi.mocked(document.elementFromPoint).mockRestore();
			};
			return;
		}
		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: spy,
		});
		elementFromPointRestore = () => {
			Reflect.deleteProperty(document, 'elementFromPoint');
		};
	}

	it('does not register listeners when #desktop-main is absent', () => {
		desktopMain?.remove();
		desktopMain = null;
		const addSpy = vi.spyOn(window, 'addEventListener');

		renderHook(() => useDesktopHoverChromeSafetyNet());

		expect(addSpy.mock.calls.some(([type]) => type === 'pointermove')).toBe(
			false
		);
		addSpy.mockRestore();
	});

	it('dismisses hover chrome when pointer leaves taskbar safe zone', () => {
		const strip = mount('taskbar', { 'data-desktop-taskbar-strip': 'true' });
		const canvas = mount('canvas');
		let call = 0;
		stubElementFromPoint(() => {
			call += 1;
			return call === 1 ? strip : canvas;
		});

		renderHook(() => useDesktopHoverChromeSafetyNet());

		act(() => {
			window.dispatchEvent(
				new PointerEvent('pointermove', { clientX: 10, clientY: 10 })
			);
			window.dispatchEvent(
				new PointerEvent('pointermove', { clientX: 400, clientY: 400 })
			);
		});

		expect(dismissHoverChrome).toHaveBeenCalledTimes(1);
		strip.remove();
		canvas.remove();
	});

	it('dismisses hover chrome when pointer reaches viewport edge', () => {
		const strip = mount('taskbar', { 'data-desktop-taskbar-strip': 'true' });
		stubElementFromPoint(() => strip);
		Object.defineProperty(window, 'innerWidth', {
			configurable: true,
			value: 800,
		});
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 600,
		});

		renderHook(() => useDesktopHoverChromeSafetyNet());

		act(() => {
			window.dispatchEvent(
				new PointerEvent('pointermove', { clientX: 799, clientY: 300 })
			);
		});

		expect(dismissHoverChrome).toHaveBeenCalled();
		strip.remove();
	});

	it('dismisses hover chrome when tab becomes hidden', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});

		renderHook(() => useDesktopHoverChromeSafetyNet());

		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'hidden',
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(dismissHoverChrome).toHaveBeenCalled();
	});

	it('does not dismiss on pointerup (click toggles must stay open)', () => {
		const listener = vi.fn();
		window.addEventListener(DESKTOP_LASER_POINTER_DISMISS_EVENT, listener);

		renderHook(() => useDesktopHoverChromeSafetyNet());

		act(() => {
			window.dispatchEvent(
				new PointerEvent('pointerup', { clientX: 100, clientY: 100 })
			);
		});

		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener(DESKTOP_LASER_POINTER_DISMISS_EVENT, listener);
	});
});

function mount(label: string, attrs: Record<string, string> = {}): HTMLElement {
	const el = document.createElement('div');
	for (const [key, value] of Object.entries(attrs)) {
		el.setAttribute(key, value);
	}
	el.textContent = label;
	document.body.append(el);
	return el;
}
