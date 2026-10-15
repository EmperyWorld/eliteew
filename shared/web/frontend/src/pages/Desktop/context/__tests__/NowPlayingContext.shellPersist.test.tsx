/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify NowPlaying shell-state writes durable metadata only (no per-tick current_time).
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 */

import { act, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const scheduleShellPatchMock = vi.fn().mockResolvedValue({});

vi.mock('react-i18next', () => ({
	initReactI18next: { type: '3rdParty', init: vi.fn() },
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('@/pages/Desktop/utils/nowPlayingAudioUnlock', () => ({
	captureNowPlayingUserActivation: vi.fn(),
}));

vi.mock('@/hooks/audio/useAuthenticatedAudioBlob', () => ({
	useAuthenticatedAudioBlob: () => ({
		isFetching: false,
		fetchAudioBlob: vi
			.fn()
			.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' })),
		abortInFlightFetch: vi.fn(),
	}),
}));

vi.mock('@/hooks/audio/useObjectUrlLifecycle', () => ({
	useObjectUrlLifecycle: () => ({
		objectUrl: 'blob:mock-track',
		setBlob: vi.fn(() => 'blob:mock-track'),
		revoke: vi.fn(),
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

vi.mock('@/voice-core/micActive', () => ({
	subscribeToMicActive: () => () => {},
}));

import {
	NowPlayingProvider,
	useNowPlayingTransport,
} from '@/pages/Desktop/context/NowPlayingContext';

const testTrack = { id: 'track-shell-1', name: 'Shell Track' };

function lastNowPlayingPatch():
	| {
			track?: { id: string } | null;
			current_time?: number;
			volume?: number;
	  }
	| undefined {
	const call = [...scheduleShellPatchMock.mock.calls]
		.reverse()
		.find(
			(entry) =>
				entry[0] &&
				typeof entry[0] === 'object' &&
				'now_playing' in (entry[0] as object)
		);
	return (call?.[0] as { now_playing?: unknown })?.now_playing as
		| {
				track?: { id: string } | null;
				current_time?: number;
				volume?: number;
		  }
		| undefined;
}

describe('NowPlayingContext shell-state persistence', () => {
	beforeEach(() => {
		scheduleShellPatchMock.mockClear();
		sessionStorage.clear();
	});

	it('persists volume changes without current_time', async () => {
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

		await act(async () => {
			await transportSnapshot?.playTrack(testTrack);
		});

		const audio = document.querySelector('audio');
		await act(async () => {
			audio?.dispatchEvent(new Event('canplay'));
		});

		await waitFor(() => {
			expect(transportSnapshot?.track?.id).toBe(testTrack.id);
		});

		scheduleShellPatchMock.mockClear();

		await act(async () => {
			transportSnapshot?.setVolume(0.42);
		});

		await waitFor(
			() => {
				const patch = lastNowPlayingPatch();
				expect(patch?.volume).toBe(0.42);
				expect(patch?.track?.id).toBe(testTrack.id);
				expect(patch).not.toHaveProperty('current_time');
			},
			{ timeout: 4000 }
		);
	});

	it('does not schedule shell patch on audio timeupdate ticks', async () => {
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

		await act(async () => {
			await transportSnapshot?.playTrack(testTrack);
		});

		const audio = document.querySelector('audio') as HTMLAudioElement;
		Object.defineProperty(audio, 'currentTime', {
			configurable: true,
			value: 15,
			writable: true,
		});

		await act(async () => {
			audio.dispatchEvent(new Event('canplay'));
		});

		await waitFor(() => {
			expect(transportSnapshot?.track?.id).toBe(testTrack.id);
		});

		await waitFor(
			() => {
				expect(scheduleShellPatchMock.mock.calls.length).toBeGreaterThan(0);
			},
			{ timeout: 4000 }
		);

		scheduleShellPatchMock.mockClear();

		await act(async () => {
			for (let i = 0; i < 8; i += 1) {
				audio.dispatchEvent(new Event('timeupdate'));
			}
		});

		await new Promise((resolve) => {
			setTimeout(resolve, 500);
		});

		expect(scheduleShellPatchMock).not.toHaveBeenCalled();
	});
});
