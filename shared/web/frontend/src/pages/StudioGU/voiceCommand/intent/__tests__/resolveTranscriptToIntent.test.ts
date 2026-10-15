import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTranscriptToIntent } from '../resolveTranscriptToIntent';

vi.mock('@/services/api/client', () => ({
	api: {
		post: vi.fn(),
	},
}));

import { api } from '@/services/api/client';

describe('resolveTranscriptToIntent', () => {
	beforeEach(() => {
		vi.mocked(api.post).mockReset();
	});

	it('returns command when parseCommand matches a phrase', async () => {
		const intent = await resolveTranscriptToIntent('который час', []);
		expect(intent).toEqual({ kind: 'command', commandId: 'time' });
	});

	it('matches open marketing cabinet by alias', async () => {
		const intent = await resolveTranscriptToIntent('открой маркетинг', []);
		expect(intent).toEqual({
			kind: 'command',
			commandId: 'open_marketing_cabinet',
		});
	});

	it('matches open studio GU by alias', async () => {
		const intent = await resolveTranscriptToIntent('открой студию гу', []);
		expect(intent).toEqual({ kind: 'command', commandId: 'open_studio_gu' });
	});

	it('matches focus next window phrase', async () => {
		const intent = await resolveTranscriptToIntent('следующее окно', []);
		expect(intent).toEqual({ kind: 'command', commandId: 'focus_next_window' });
	});

	it('matches voice mute phrase', async () => {
		const intent = await resolveTranscriptToIntent('без звука', []);
		expect(intent).toEqual({ kind: 'command', commandId: 'voice_sound_mute' });
	});

	it('returns conversation when transcript empty and no macro', async () => {
		const intent = await resolveTranscriptToIntent('   ', []);
		expect(intent).toEqual({ kind: 'conversation' });
	});

	it('returns disambiguate for open prefix without known app', async () => {
		const intent = await resolveTranscriptToIntent('открой что-то', []);
		expect(intent.kind).toBe('disambiguate');
		if (intent.kind === 'disambiguate') {
			expect(intent.intent).toBe('open_app');
			expect(intent.candidates.length).toBeGreaterThan(0);
		}
	});

	it('calls map-intent when no local match and transcript non-empty', async () => {
		vi.mocked(api.post).mockResolvedValueOnce({ command_id: 'time' });
		const transcript = 'uq7z_mumbo_jumbo_no_local_match_expected_xyz';
		const intent = await resolveTranscriptToIntent(transcript, []);
		expect(api.post).toHaveBeenCalledWith('/api/v1/voice-gateway/map-intent', {
			transcript,
		});
		expect(intent).toEqual({ kind: 'command', commandId: 'time' });
	});

	it('returns conversation when map-intent yields unknown id', async () => {
		vi.mocked(api.post).mockResolvedValueOnce({ command_id: 'nonexistent' });
		const intent = await resolveTranscriptToIntent(
			'vq8z_mumbo_jumbo_second_attempt',
			[]
		);
		expect(intent).toEqual({ kind: 'conversation' });
	});
});
