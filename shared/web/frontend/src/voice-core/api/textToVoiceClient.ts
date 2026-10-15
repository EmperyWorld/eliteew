/**
 * Unified text-to-voice client (stack9: LLM + silero TTS).
 * Target: POST /api/v1/text-to-voice/process (backend uses voice_gateway_service.process_text_to_speech).
 */

import { apiClient } from '../../services/api';

export interface TextToVoiceSettings {
	llama_model?: string;
	tts_voice?: string;
	language?: string;
	speed?: number;
	volume?: number;
	temperature?: number;
	max_tokens?: number;
}

export interface TextToVoiceResponse {
	success: boolean;
	user_text: string;
	ai_response: string;
	audio_url: string;
	audio_base64: string;
	duration_ms: number;
	stages: {
		llm?: { duration_ms: number; text?: string };
		tts?: { duration_ms: number; audio_url?: string };
	};
	language: string;
	voice: string;
}

const TEXT_TO_VOICE_URL = '/api/v1/text-to-voice/process';

export async function processTextToVoice(
	text: string,
	settings?: TextToVoiceSettings
): Promise<TextToVoiceResponse> {
	const response = await apiClient.post<TextToVoiceResponse>(
		TEXT_TO_VOICE_URL,
		{ text, ...settings },
		{ timeout: 120000 }
	);
	return response.data;
}
