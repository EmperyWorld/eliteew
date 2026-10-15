/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify Media Session position resync on tab visibility return.
 *
 * Related:
 * - src/pages/Desktop/utils/mediaSessionMusic.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMediaSessionMusic } from '@/pages/Desktop/utils/mediaSessionMusic';

describe('useMediaSessionMusic', () => {
	const setPositionState = vi.fn();

	beforeEach(() => {
		class MockMediaMetadata {
			title: string;
			constructor(init: { title: string }) {
				this.title = init.title;
			}
		}
		vi.stubGlobal('MediaMetadata', MockMediaMetadata);

		Object.defineProperty(navigator, 'mediaSession', {
			configurable: true,
			value: {
				metadata: null,
				playbackState: 'none',
				setPositionState,
				setActionHandler: vi.fn(),
			},
		});
		setPositionState.mockClear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('refreshes position state when tab becomes visible again', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});

		renderHook(() =>
			useMediaSessionMusic({
				track: { id: 'track-1', name: 'Track One' },
				playing: true,
				isLoading: false,
				currentTime: 42,
				duration: 120,
				playbackRate: 1,
				play: vi.fn(),
				pause: vi.fn(),
				next: vi.fn(),
				prev: vi.fn(),
				seek: vi.fn(),
			})
		);

		setPositionState.mockClear();

		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'visible',
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(setPositionState).toHaveBeenCalled();
		expect(setPositionState.mock.calls.at(-1)?.[0]).toMatchObject({
			duration: 120,
			position: 42,
			playbackRate: 1,
		});
	});
});
