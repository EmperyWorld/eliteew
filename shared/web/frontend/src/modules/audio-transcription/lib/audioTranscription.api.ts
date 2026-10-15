import { apiClient } from '../../../services/api';
import type {
	TranscriptionOptions,
	TranscriptionResponse,
} from './audioTranscription.types';

interface RawTranscriptionResponse {
	readonly text?: string;
	readonly language?: string;
	readonly confidence?: number;
	readonly segments?: readonly {
		readonly text: string;
		readonly start: number;
		readonly end: number;
		readonly confidence?: number;
		readonly speaker?: string;
	}[];
	readonly duration_ms?: number;
	readonly timestamp?: string;
	readonly whisper_model?: string;
	readonly file_size_bytes?: number;
	readonly format?: string;
}

function mapRawResponse(raw: RawTranscriptionResponse): TranscriptionResponse {
	const text = raw.text || (raw.segments?.map((s) => s.text).join(' ') ?? '');

	return {
		text,
		language: raw.language ?? 'unknown',
		confidence: raw.confidence ?? 0,
		segments: raw.segments ?? [],
		durationMs: raw.duration_ms ?? 0,
		timestamp: raw.timestamp ?? new Date().toISOString(),
		whisperModel: raw.whisper_model ?? 'unknown',
		fileSizeBytes: raw.file_size_bytes ?? 0,
		format: raw.format ?? 'text',
	};
}

export async function transcribeAudio(
	file: File,
	options: TranscriptionOptions = {}
): Promise<TranscriptionResponse> {
	const formData = new FormData();
	formData.append('file', file);

	if (options.language) {
		formData.append('language', options.language);
	}

	if (options.model) {
		formData.append('model', options.model);
	}

	const response = await apiClient.post<RawTranscriptionResponse>(
		'/api/v1/audio-transcription/transcribe',
		formData,
		{
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		}
	);

	const mapped = mapRawResponse(response.data);

	if (!mapped.text) {
		throw new Error('Не получен текст транскрибации. Проверьте ответ сервера.');
	}

	return mapped;
}
