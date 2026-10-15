/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify already-loaded resume calls `audio.play()` without muted unlock play→pause
 * (same-src unlock pause would kill audible resume).
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/pages/Desktop/utils/nowPlayingAudioUnlock.ts
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md §Autoplay unlock race
 */

import { act, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

const captureNowPlayingUserActivationMock = vi.fn();
const scheduleShellPatchMock = vi.fn().mockResolvedValue({});

vi.mock('react-i18next', () => ({
	initReactI18next: { type: '3rdParty', init: vi.fn() },
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('@/pages/Desktop/utils/nowPlayingAudioUnlock', () => ({
	captureNowPlayingUserActivation: (...args: unknown[]) =>
		captureNowPlayingUserActivationMock(...args),
}));

const authAudioBlobMocks = vi.hoisted(() => ({
	fetchAudioBlob: vi
		.fn()
		.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' })),
	abortInFlightFetch: vi.fn(),
}));

const objectUrlLifecycleMocks = vi.hoisted(() => ({
	setBlob: vi.fn(() => 'blob:mock-track'),
	revoke: vi.fn(),
}));

vi.mock('@/hooks/audio/useAuthenticatedAudioBlob', () => ({
	useAuthenticatedAudioBlob: () => ({
		isFetching: false,
		fetchAudioBlob: authAudioBlobMocks.fetchAudioBlob,
		abortInFlightFetch: authAudioBlobMocks.abortInFlightFetch,
	}),
}));

vi.mock('@/hooks/audio/useObjectUrlLifecycle', () => ({
	useObjectUrlLifecycle: () => ({
		objectUrl: 'blob:mock-track',
		setBlob: objectUrlLifecycleMocks.setBlob,
		revoke: objectUrlLifecycleMocks.revoke,
	}),
}));

vi.mock('@/notifications', () => ({
	notify: {
		nowPlaying: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock('@/pages/Desktop/utils/musicAudioBlobCache', () => ({
	getCachedAudioBlob: vi.fn().mockResolvedValue(null),
	putCachedAudioBlob: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/pages/Desktop/utils/musicPlaybackTelemetry', () => ({
	emitPlaybackErrorMetric: vi.fn(),
	emitPlaybackStageMetric: vi.fn(),
	emitShellPersistMetric: vi.fn(),
	markTrackLoadReady: vi.fn(),
	markTrackLoadStart: vi.fn().mockReturnValue('mark'),
}));

vi.mock('@/pages/Desktop/services/desktopApi', () => ({
	fetchDesktopShellStateDeduplicated: vi
		.fn()
		.mockResolvedValue({ now_playing: null }),
}));

vi.mock('@/pages/Desktop/utils/desktopShellStateMutationPipeline', () => ({
	scheduleShellStateMutation: (
		options: { merge?: (current: unknown) => unknown; debounceMs?: number },
		_patch?: unknown,
		_opts?: unknown
	) => scheduleShellPatchMock(options?.merge?.({}), options),
	flushShellStatePipelineNow: vi.fn().mockResolvedValue(undefined),
	waitForShellStatePipelineFlush: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/pages/Desktop/utils/mediaSessionMusic', () => ({
	useMediaSessionMusic: vi.fn(),
}));

vi.mock('@/pages/MusicPlayer/musicPlayerAudioDownload', () => ({
	resolveMusicPlayerTrackInlineStreamUrl: vi
		.fn()
		.mockRejectedValue(new Error('test-force-blob')),
}));

vi.mock(
	'@/pages/Desktop/context/nowPlaying/audioHelpers',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('@/pages/Desktop/context/nowPlaying/audioHelpers')
			>();
		return {
			...actual,
			// jsdom often synthesizes MEDIA_ERR_* on blob: mock URLs; keep resume on sync path.
			isNowPlayingMediaHardError: () => false,
		};
	}
);

vi.mock('@/voice-core/micActive', () => ({
	subscribeToMicActive: () => () => {},
}));

import {
	NowPlayingProvider,
	useNowPlayingTransport,
} from '@/pages/Desktop/context/NowPlayingContext';

const testTrack = { id: 'track-resume-1', name: 'Resume Track' };

describe('NowPlayingContext resume play', () => {
	beforeEach(() => {
		Object.defineProperty(HTMLMediaElement.prototype, 'error', {
			configurable: true,
			get: () => null,
		});
	});

	it('resumes an already loaded track without unlock play→pause', async () => {
		let transportSnapshot:
			| ReturnType<typeof useNowPlayingTransport>
			| undefined;

		const Probe = () => {
			const transport = useNowPlayingTransport();
			React.useEffect(() => {
				transportSnapshot = transport;
			}, [transport]);
			return null;
		};

		render(
			<NowPlayingProvider>
				<Probe />
			</NowPlayingProvider>
		);

		await waitFor(() => {
			expect(transportSnapshot).toBeDefined();
		});

		const audio = document.querySelector('audio');
		expect(audio).toBeTruthy();
		const playMock = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(audio, 'play', {
			configurable: true,
			value: playMock,
		});

		await act(async () => {
			await transportSnapshot?.playTrack(testTrack);
		});

		await act(async () => {
			audio?.dispatchEvent(new Event('canplay'));
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(transportSnapshot?.track?.id).toBe(testTrack.id);
			expect(transportSnapshot?.playing).toBe(true);
		});

		// Async load path may unlock once before src replace.
		expect(captureNowPlayingUserActivationMock).toHaveBeenCalled();

		await act(async () => {
			transportSnapshot?.pause();
		});

		await waitFor(() => {
			expect(transportSnapshot?.playing).toBe(false);
		});

		captureNowPlayingUserActivationMock.mockClear();
		playMock.mockClear();

		// Same-track resume via play() and via playTrack must stay unlock-free.
		await act(async () => {
			transportSnapshot?.play();
		});
		expect(captureNowPlayingUserActivationMock).not.toHaveBeenCalled();
		expect(playMock).toHaveBeenCalled();

		playMock.mockClear();
		await act(async () => {
			transportSnapshot?.pause();
		});
		await waitFor(() => {
			expect(transportSnapshot?.playing).toBe(false);
		});
		captureNowPlayingUserActivationMock.mockClear();
		playMock.mockClear();

		await act(async () => {
			await transportSnapshot?.playTrack(testTrack);
		});
		expect(captureNowPlayingUserActivationMock).not.toHaveBeenCalled();
		expect(playMock).toHaveBeenCalled();
	});
});
