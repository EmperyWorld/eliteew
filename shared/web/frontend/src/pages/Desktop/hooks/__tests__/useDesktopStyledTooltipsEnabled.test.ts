/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests styled-tooltips preference subscription on `#desktop-main`.
 *
 * Related:
 * - useDesktopStyledTooltipsEnabled.ts
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
	resolveDesktopChromeNativeTitle,
	useDesktopStyledTooltipsEnabled,
} from '../useDesktopStyledTooltipsEnabled';

describe('useDesktopStyledTooltipsEnabled', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('defaults true when attribute is missing', () => {
		const desktop = document.createElement('main');
		desktop.id = 'desktop-main';
		document.body.appendChild(desktop);

		const { result } = renderHook(() => useDesktopStyledTooltipsEnabled());
		expect(result.current).toBe(true);
	});

	it('reads false from data-desktop-styled-tooltips', () => {
		const desktop = document.createElement('main');
		desktop.id = 'desktop-main';
		desktop.setAttribute('data-desktop-styled-tooltips', 'false');
		document.body.appendChild(desktop);

		const { result } = renderHook(() => useDesktopStyledTooltipsEnabled());
		expect(result.current).toBe(false);
	});

	it('updates when attribute changes', async () => {
		const desktop = document.createElement('main');
		desktop.id = 'desktop-main';
		document.body.appendChild(desktop);

		const { result } = renderHook(() => useDesktopStyledTooltipsEnabled());
		expect(result.current).toBe(true);

		act(() => {
			desktop.setAttribute('data-desktop-styled-tooltips', 'false');
		});
		await waitFor(() => {
			expect(result.current).toBe(false);
		});
	});
});

describe('resolveDesktopChromeNativeTitle', () => {
	it('returns title when styled tooltips disabled', () => {
		expect(resolveDesktopChromeNativeTitle('Window', false)).toBe('Window');
	});

	it('returns undefined when styled tooltips enabled', () => {
		expect(resolveDesktopChromeNativeTitle('Window', true)).toBeUndefined();
	});
});
