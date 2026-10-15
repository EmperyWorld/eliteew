/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify mic ducking affects runtime gain only and never rewrites persisted user volume.
 *
 * Invariants:
 * - `state.volume` stays user-defined while mic active toggles.
 * - Ducking toggle alone does not trigger extra shell-state volume writes.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 */

import { act, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

let micListener: ((active: boolean) => void) | null = null;
const scheduleShellPatchMock = vi.fn().mockResolvedValue({});

vi.mock('react-i18next', () => ({
	initReactI18next: { type: '3rdParty', init: vi.fn() },
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('@/hooks/audio/useAuthenticatedAudioBlob', () => ({
	useAuthenticatedAudioBlob: () => ({
		isFetching: false,
		fetchAudioBlob: vi.fn(),
		abortInFlightFetch: vi.fn(),
	}),
}));

vi.mock('@/hooks/audio/useObjectUrlLifecycle', () => ({
	useObjectUrlLifecycle: () => ({
		objectUrl: null,
		setBlob: vi.fn(),
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
	subscribeToMicActive: (callback: (active: boolean) => void) => {
		micListener = callback;
		return () => {
			micListener = null;
		};
	},
}));

import {
	NowPlayingProvider,
	useNowPlayingTransport,
} from '@/pages/Desktop/context/NowPlayingContext';

describe('NowPlayingContext mic ducking', () => {
	it('keeps user volume unchanged when mic ducking toggles', async () => {
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

		act(() => {
			transportSnapshot?.setVolume(0.8);
		});
		await waitFor(() => {
			expect(transportSnapshot?.volume).toBe(0.8);
		});
		const callsAfterVolumeSet = scheduleShellPatchMock.mock.calls.length;

		act(() => {
			micListener?.(true);
		});
		await waitFor(() => {
			expect(transportSnapshot?.volume).toBe(0.8);
		});

		expect(scheduleShellPatchMock).toHaveBeenCalledTimes(callsAfterVolumeSet);
	});
});
