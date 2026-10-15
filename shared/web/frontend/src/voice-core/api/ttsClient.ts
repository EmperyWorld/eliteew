/**
 * Unified TTS client - canonical synthesis only (stack9 silero).
 * Target: POST /api/v1/voice-gateway/synthesize.
 */

import type { components } from '@/generated/voice-gateway-openapi';
import { apiClient } from '../../services/api';
import type { SynthesizeResult } from '../types';

const CANONICAL_TTS_URL = '/api/v1/voice-gateway/synthesize';

export interface SynthesizeOptions {
	voice?: string;
	speed?: number;
	volume?: number;
	language?: string;
	provider?: string;
}

/**
 * Synthesize speech via canonical TTS endpoint (silero). Returns data URL or blob URL.
 */
export async function synthesize(
	text: string,
	options: SynthesizeOptions = {}
): Promise<SynthesizeResult> {
	const response = await apiClient.post<
		components['schemas']['SynthesizeResponse']
	>(
		CANONICAL_TTS_URL,
		{
			text,
			voice: options.voice ?? 'xenia',
			provider: options.provider ?? 'silero',
			speed: options.speed ?? 1,
			volume: options.volume ?? 1,
			language: options.language,
		},
		{ timeout: 60000 }
	);

	const data = response.data;
	const audioUrl = data.audio_url ?? '';
	const duration =
		typeof data.duration === 'number' ? data.duration : undefined;
	return {
		audio_url: audioUrl,
		duration_ms: duration != null ? duration * 1000 : undefined,
		duration,
		voice: options.voice,
	};
}
