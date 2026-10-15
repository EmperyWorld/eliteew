/**
 * useVoiceCenterTranscription - Hook for audio transcription (canonical voice-gateway, stack9).
 *
 * Uses POST /api/v1/voice-gateway/transcribe. Progress is request lifecycle (no Socket.IO).
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
	chunks_processed?: number;
	partial_results?: Array<{
		chunk_index: number;
		result: TranscriptionResult;
	}>;
}

export interface TranscriptionState {
	isTranscribing: boolean;
	result: TranscriptionResult | null;
	error: string | null;
	progress: number;
	message: string;
	chunks?: Array<{
		index: number;
		progress: number;
		message: string;
		result?: TranscriptionResult;
	}>;
}

export interface ChunkingOptions {
	mode: 'none' | 'auto' | 'time' | 'count';
	sizeMinutes?: number;
	count?: number;
}

export interface UseVoiceCenterTranscriptionReturn {
	transcribe: (
		audioFile: File,
		language?: string,
		model?: string,
		chunking?: ChunkingOptions
	) => Promise<void>;
	reset: () => void;
	state: TranscriptionState;
}

/**
 * Hook for audio transcription via voice-gateway (sync; progress = request lifecycle).
 */
export const useVoiceCenterTranscription =
	(): UseVoiceCenterTranscriptionReturn => {
		const [state, setState] = useState<TranscriptionState>({
			isTranscribing: false,
			result: null,
			error: null,
			progress: 0,
			message: '',
			chunks: [],
		});

		const transcribe = useCallback(
			async (
				audioFile: File,
				language?: string,
				model?: string,
				_chunking: ChunkingOptions = { mode: 'none' }
			): Promise<void> => {
				setState((prev) => ({
					...prev,
					isTranscribing: true,
					error: null,
					progress: 0,
					message: 'Подготовка...',
					chunks: [],
				}));

				try {
					setState((prev) => ({
						...prev,
						progress: 10,
						message: 'Отправка файла...',
					}));

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
					}>(
						`${CANONICAL_TRANSCRIBE_URL}${query ? `?${query}` : ''}`,
						formData,
						{
							timeout: 300000,
						}
					);

					setState((prev) => ({
						...prev,
						progress: 90,
						message: 'Обработка...',
					}));

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
						message: 'Транскрибация завершена',
						chunks: [],
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
								: (err?.message ?? 'Ошибка транскрибации');

					setState({
						isTranscribing: false,
						result: null,
						error: errorMessage,
						progress: 0,
						message: '',
						chunks: [],
					});
					log.error(
						'VoiceCenter',
						'Transcription error',
						error instanceof Error ? error : undefined,
						{ raw: error }
					);
				}
			},
			[]
		);

		const reset = useCallback(() => {
			setState({
				isTranscribing: false,
				result: null,
				error: null,
				progress: 0,
				message: '',
				chunks: [],
			});
		}, []);

		return {
			transcribe,
			reset,
			state,
		};
	};

export default useVoiceCenterTranscription;
