/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for now-playing user-activation capture before async blob fetch.
 *
 * Related:
 * - src/pages/Desktop/utils/nowPlayingAudioUnlock.ts
 */

import { describe, expect, it, vi } from 'vitest';

import { captureNowPlayingUserActivation } from '@/pages/Desktop/utils/nowPlayingAudioUnlock';

function mockAudio(overrides?: {
	src?: string;
	playImpl?: () => Promise<void>;
}): HTMLAudioElement & {
	muted: boolean;
	src: string;
	play: ReturnType<typeof vi.fn>;
	pause: ReturnType<typeof vi.fn>;
	getAttribute: (name: string) => string | null;
} {
	let src = overrides?.src ?? '';
	const audio = {
		muted: false,
		get src() {
			return src;
		},
		set src(value: string) {
			src = value;
		},
		getAttribute(name: string) {
			return name === 'src' ? src || null : null;
		},
		play: vi.fn(overrides?.playImpl ?? (() => Promise.resolve(undefined))),
		pause: vi.fn(),
	};
	return audio as unknown as HTMLAudioElement & typeof audio;
}

describe('captureNowPlayingUserActivation', () => {
	it('does nothing when user activation is not active', () => {
		const audio = mockAudio();
		Object.defineProperty(navigator, 'userActivation', {
			configurable: true,
			value: { isActive: false },
		});
		captureNowPlayingUserActivation(audio);
		expect(audio.play).not.toHaveBeenCalled();
	});

	it('runs muted play/pause while user activation is active', async () => {
		const audio = mockAudio();
		Object.defineProperty(navigator, 'userActivation', {
			configurable: true,
			value: { isActive: true },
		});
		captureNowPlayingUserActivation(audio);
		expect(audio.play).toHaveBeenCalledTimes(1);
		expect(audio.muted).toBe(true);
		await Promise.resolve();
		expect(audio.pause).toHaveBeenCalledTimes(1);
		expect(audio.muted).toBe(false);
	});

	it('does not pause when a real track src replaced unlock src', async () => {
		let resolvePlay: (() => void) | undefined;
		const audio = mockAudio({
			playImpl: () =>
				new Promise<void>((resolve) => {
					resolvePlay = resolve;
				}),
		});
		Object.defineProperty(navigator, 'userActivation', {
			configurable: true,
			value: { isActive: true },
		});
		captureNowPlayingUserActivation(audio);
		expect(audio.muted).toBe(true);
		audio.src = 'blob:real-track';
		resolvePlay?.();
		await Promise.resolve();
		await Promise.resolve();
		expect(audio.pause).not.toHaveBeenCalled();
		expect(audio.muted).toBe(false);
	});

	it('superseded unlock does not restore mute over a newer capture', async () => {
		const resolvers: Array<() => void> = [];
		const audio = mockAudio({
			playImpl: () =>
				new Promise<void>((resolve) => {
					resolvers.push(resolve);
				}),
		});
		Object.defineProperty(navigator, 'userActivation', {
			configurable: true,
			value: { isActive: true },
		});
		captureNowPlayingUserActivation(audio);
		expect(audio.muted).toBe(true);
		captureNowPlayingUserActivation(audio);
		audio.src = 'blob:real-track';
		expect(resolvers.length).toBe(2);
		resolvers[0]?.();
		await Promise.resolve();
		await Promise.resolve();
		// First unlock superseded — must not leave muted stuck after second settles.
		resolvers[1]?.();
		await Promise.resolve();
		await Promise.resolve();
		expect(audio.muted).toBe(false);
		expect(audio.pause).not.toHaveBeenCalled();
	});

	it('same-src deferred pause is the resume anti-pattern (callers must not unlock then play)', async () => {
		const resolvers: Array<() => void> = [];
		const audio = mockAudio({
			src: 'blob:already-loaded',
			playImpl: () =>
				new Promise<void>((resolve) => {
					resolvers.push(resolve);
				}),
		});
		Object.defineProperty(navigator, 'userActivation', {
			configurable: true,
			value: { isActive: true },
		});
		captureNowPlayingUserActivation(audio);
		expect(resolvers.length).toBe(1);
		// Sync resume play on same src while unlock play is still pending.
		void audio.play();
		expect(resolvers.length).toBe(2);
		// Resolve unlock play only — deferred pause sees unchanged src.
		resolvers[0]?.();
		await Promise.resolve();
		await Promise.resolve();
		expect(audio.pause).toHaveBeenCalledTimes(1);
	});
});
