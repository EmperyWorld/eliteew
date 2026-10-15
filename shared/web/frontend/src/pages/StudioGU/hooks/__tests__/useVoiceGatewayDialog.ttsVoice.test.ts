/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: Dialog `/voice-gateway/process` FormData includes tts_voice from selectedVoice.
 *
 * Invariants:
 * - process FormData always appends tts_voice (server merges with live settings).
 *
 * Related:
 * - pages/StudioGU/hooks/useVoiceGatewayDialog.ts
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/services/api/client', () => ({
	api: {
		post: (...args: unknown[]) => postMock(...args),
		get: (...args: unknown[]) => getMock(...args),
	},
}));

vi.mock('@/voice-core/micActive', () => ({
	registerMicActive: () => () => undefined,
	registerTtsPlaying: () => () => undefined,
}));

vi.mock('@/voice-core/utils/resolveAudioUrlForPlayback', () => ({
	resolveAudioUrlForPlayback: async (url: string) => ({
		playUrl: url,
		revoke: () => undefined,
	}),
}));

describe('useVoiceGatewayDialog tts_voice FormData', () => {
	beforeEach(() => {
		postMock.mockReset();
		getMock.mockReset();
		getMock.mockResolvedValue([]);
		postMock.mockResolvedValue({
			transcription: 'привет',
			llm_response: 'ответ',
			audio_url: null,
			duration_ms: 1,
			stages: {},
			task_id: 't1',
		});

		class FakeMediaRecorder {
			static isTypeSupported = () => true;
			mimeType = 'audio/webm';
			state = 'inactive';
			ondataavailable: ((e: { data: Blob }) => void) | null = null;
			onstop: (() => void) | null = null;
			start() {
				this.state = 'recording';
			}
			stop() {
				this.state = 'inactive';
				this.ondataavailable?.({
					data: new Blob(['x'], { type: 'audio/webm' }),
				});
				this.onstop?.();
			}
		}
		vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
		vi.stubGlobal('navigator', {
			mediaDevices: {
				getUserMedia: vi.fn().mockResolvedValue({
					getTracks: () => [{ stop: vi.fn() }],
				}),
			},
		});
	});

	it('appends tts_voice from selectedVoice on process', async () => {
		const { useVoiceGatewayDialog } = await import(
			'@/pages/StudioGU/hooks/useVoiceGatewayDialog'
		);
		const { result } = renderHook(() => useVoiceGatewayDialog());

		act(() => {
			result.current.setSelectedVoice('xenia');
		});

		await act(async () => {
			await result.current.startRecording();
		});
		await act(async () => {
			result.current.stopRecording();
		});

		await waitFor(() => {
			expect(postMock).toHaveBeenCalled();
		});

		const formData = postMock.mock.calls[0]?.[1] as FormData;
		expect(formData).toBeInstanceOf(FormData);
		expect(formData.get('tts_voice')).toBe('xenia');
		expect(formData.get('file')).toBeTruthy();
	});
});
