/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Focused coverage for the extracted companion transform video hook used by `EwaCompanionChatPanel`.
 *
 * Invariants:
 * - The hook controls only portal media state; chat/profile side effects stay outside this boundary.
 * - Transform video files are not preloaded on hook mount.
 *
 * Related:
 * - src/features/ewa/useCompanionTransformVideo.ts
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SyntheticEvent } from 'react';

import { useCompanionTransformVideo } from '@/features/ewa/useCompanionTransformVideo';

vi.mock('@/features/ewa/companionTransformVideoUrl', () => ({
	companionTransformVideoUrl: (kind: string | null) =>
		`/static/transform/${kind ?? 'default'}.mp4`,
}));

describe('useCompanionTransformVideo', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('opens the requested transform video and closes it', () => {
		const { result } = renderHook(() => useCompanionTransformVideo());

		act(() => {
			result.current.showCompanionTransformVideo('arlika');
		});
		expect(result.current.companionTransformVideoOpen).toBe(true);
		expect(result.current.companionTransformVideoSrc).toBe(
			'/static/transform/arlika.mp4'
		);

		act(() => {
			result.current.closeCompanionTransformVideo();
		});
		expect(result.current.companionTransformVideoOpen).toBe(false);
	});

	it('calls play() only once when ready fires twice for the same open', async () => {
		const play = vi.fn().mockResolvedValue(undefined);
		const video = {
			play,
			muted: false,
			currentTime: 0,
		} as unknown as HTMLVideoElement;
		const readyEvent = {
			currentTarget: video,
		} as SyntheticEvent<HTMLVideoElement>;

		const { result } = renderHook(() => useCompanionTransformVideo());

		act(() => {
			result.current.showCompanionTransformVideo('arlika');
		});

		await act(async () => {
			result.current.handleCompanionTransformVideoReady(readyEvent);
			result.current.handleCompanionTransformVideoReady(readyEvent);
		});

		expect(play).toHaveBeenCalledTimes(1);
		expect(result.current.companionTransformVideoLoading).toBe(false);
	});
});
