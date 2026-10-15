/**
 * useWhisperTranscription - Hook for audio transcription (canonical STT, stack9).
 *
 * Uses POST /api/v1/voice-gateway/transcribe (whisper-fast). No UGS path.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api';
import { log } from '../utils/logger';

const CANONICAL_TRANSCRIBE_URL = '/api/v1/voice-gateway/transcribe';

// Types
export interface TranscriptionSegment {
	text: string;
	start: number;
	end: number;
	confidence?: number;
}

export interface TranscriptionResult {
	text: string;
	language: string;
	duration_ms: number;
	confidence: number;
	segments: TranscriptionSegment[];
	audio_duration_sec?: number;
	file_size_bytes: number;
	format: string;
	timestamp: string;
}

export interface TranscriptionState {
	isTranscribing: boolean;
	result: TranscriptionResult | null;
	error: string | null;
	progress: number;
}

export interface UseWhisperTranscriptionReturn {
	transcribe: (
		audioFile: File,
		language?: string,
		model?: string
	) => Promise<void>;
	transcribeBlob: (
		audioBlob: Blob,
		fileName: string,
		language?: string,
		model?: string
	) => Promise<void>;
	reset: () => void;
	state: TranscriptionState;
}

/**
 * Hook for Whisper audio transcription (voice-gateway)
 *
 * @example
 * ```tsx
 * const { transcribe, state } = useWhisperTranscription();
 *
 * const handleFileUpload = async (file: File) => {
 *   await transcribe(file, 'ru', 'turbo');
 *   log.info(state.result?.text);
 * };
 * ```
 */
export const useWhisperTranscription = (): UseWhisperTranscriptionReturn => {
	const [state, setState] = useState<TranscriptionState>({
		isTranscribing: false,
		result: null,
		error: null,
		progress: 0,
	});

	/**
	 * Transcribe audio file
	 *
	 * @param audioFile - Audio file to transcribe
	 * @param language - Language code (e.g., 'ru', 'en') or auto-detect
	 * @param model - Whisper model: tiny, base, small, medium, large, turbo
	 */
	const transcribe = useCallback(
		async (
			audioFile: File,
			language?: string,
			model?: string
		): Promise<void> => {
			setState((prev) => ({
				...prev,
				isTranscribing: true,
				error: null,
				progress: 0,
			}));

			try {
				setState((prev) => ({ ...prev, progress: 10 }));

				const formData = new FormData();
				formData.append('file', audioFile);
				const params = new URLSearchParams();
				if (language && language !== 'auto') params.set('language', language);
				if (model) params.set('model', model);
				const query = params.toString();

				const response = await apiClient.post<{
					text: string;
					language: string;
					duration_ms: number;
					confidence: number;
					segments: TranscriptionSegment[];
					timestamp: string;
				}>(`${CANONICAL_TRANSCRIBE_URL}${query ? `?${query}` : ''}`, formData, {
					timeout: 120000,
				});

				setState((prev) => ({ ...prev, progress: 90 }));

				const data = response.data;
				const transcriptionResult: TranscriptionResult = {
					text: data.text ?? '',
					language: data.language ?? 'unknown',
					confidence: data.confidence ?? 0,
					segments: data.segments ?? [],
					duration_ms: data.duration_ms ?? 0,
					file_size_bytes: audioFile.size,
					format: audioFile.type || 'unknown',
					timestamp: data.timestamp ?? new Date().toISOString(),
				};

				setState({
					isTranscribing: false,
					result: transcriptionResult,
					error: null,
					progress: 100,
				});
			} catch (error: unknown) {
				const err = error as {
					response?: { data?: { detail?: string } };
					message?: string;
				};
				const errorMessage =
					error instanceof Error
						? error.message
						: typeof err?.response?.data?.detail === 'string'
							? err.response.data.detail
							: (err?.message ?? 'Ошибка транскрибации аудио');

				setState({
					isTranscribing: false,
					result: null,
					error: errorMessage,
					progress: 0,
				});

				log.error(
					'useWhisperTranscription',
					'Transcription error',
					error instanceof Error ? error : undefined,
					error
				);
			}
		},
		[]
	);

	/**
	 * Transcribe audio blob (from recorder)
	 *
	 * @param audioBlob - Audio blob from MediaRecorder
	 * @param fileName - File name for the blob
	 * @param language - Language code (e.g., 'ru', 'en') or auto-detect
	 * @param model - Whisper model: tiny, base, small, medium, large, turbo
	 */
	const transcribeBlob = useCallback(
		async (
			audioBlob: Blob,
			fileName: string,
			language?: string,
			model = 'large-v3'
		): Promise<void> => {
			// Convert Blob to File
			const audioFile = new File([audioBlob], fileName, {
				type: audioBlob.type || 'audio/webm',
			});

			await transcribe(audioFile, language, model);
		},
		[transcribe]
	);

	/**
	 * Reset transcription state
	 */
	const reset = useCallback(() => {
		setState({
			isTranscribing: false,
			result: null,
			error: null,
			progress: 0,
		});
	}, []);

	return {
		transcribe,
		transcribeBlob,
		reset,
		state,
	};
};

export default useWhisperTranscription;
