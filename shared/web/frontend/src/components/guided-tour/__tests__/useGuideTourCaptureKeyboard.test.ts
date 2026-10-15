/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for shared guide tour capture keyboard hook.
 *
 * Related:
 * - useGuideTourCaptureKeyboard.ts
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGuideTourCaptureKeyboard } from '../useGuideTourCaptureKeyboard';

describe('useGuideTourCaptureKeyboard', () => {
	it('closes on Escape with stopPropagation', () => {
		const onClose = vi.fn();
		const outer = vi.fn();
		window.addEventListener('keydown', outer);

		renderHook(() => useGuideTourCaptureKeyboard(true, 3, onClose, () => 0));

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(outer).not.toHaveBeenCalled();

		window.removeEventListener('keydown', outer);
	});
});
