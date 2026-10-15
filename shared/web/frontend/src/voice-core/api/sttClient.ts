/**
 * Unified STT client - canonical transcription only (stack9 whisper-fast).
 * Target: POST /api/v1/voice-gateway/transcribe
 */

import type { components } from '@/generated/voice-gateway-openapi';
import { apiClient } from '../../services/api';
import type { TranscriptionResult, TranscriptionSegment } from '../types';

const CANONICAL_STT_URL = '/api/v1/voice-gateway/transcribe';

export interface TranscribeOptions {
	language?: string;
	model?: string;
}

/**
 * Transcribe audio file via canonical STT endpoint (whisper-fast).
 */
export async function transcribe(
	file: File,
	options: TranscribeOptions = {}
): Promise<TranscriptionResult> {
	const formData = new FormData();
	formData.append('file', file);
	if (options.language) formData.append('language', options.language);
	if (options.model) formData.append('model', options.model);

	const response = await apiClient.post<
		components['schemas']['TranscribeResponse']
	>(CANONICAL_STT_URL, formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
		timeout: 120000,
	});

	const data = response.data;
	const text =
		data.text ??
		data.segments
			?.map((s) => String((s as { text?: string }).text ?? ''))
			.join(' ') ??
		'';
	const segments: TranscriptionSegment[] = (data.segments ?? []).map((s) => {
		const row = s as {
			text?: string;
			start?: number;
			end?: number;
			confidence?: number;
		};
		const start = row.start ?? 0;
		const end = row.end ?? start;
		return {
			text: row.text ?? '',
			start,
			end,
			confidence: row.confidence,
		};
	});
	return {
		text,
		language: data.language ?? 'unknown',
		duration_ms: data.duration_ms ?? 0,
		confidence: data.confidence ?? 0,
		segments,
		file_size_bytes: file.size,
		format: file.type,
		timestamp: data.timestamp ?? new Date().toISOString(),
	};
}
