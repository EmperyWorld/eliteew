/**
 * useVoicePipeline - Hook для оркестрации pipeline обработки
 *
 * Управляет процессом: Audio → Whisper → Llama → TTS → Response
 */

import { useState, useCallback } from 'react';
import { DEFAULT_LLAMA_MODEL } from '../../../config';
import { apiClient } from '../../../services/api';
import { registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';

type PipelineStage =
	| 'idle'
	| 'recording'
	| 'transcribing'
	| 'generating'
	| 'synthesizing'
	| 'playing'
	| 'completed'
	| 'error';

interface PipelineState {
	stage: PipelineStage;
	progress: number; // 0-100
	error: string | null;
	transcription: string | null;
	aiResponse: string | null;
	audioUrl: string | null;
}

interface UseVoicePipelineOptions {
	onStageChange?: (stage: PipelineStage) => void;
	onComplete?: (audioUrl: string) => void;
	onError?: (error: Error) => void;
}

interface UseVoicePipelineReturn {
	state: PipelineState;
	processAudio: (audioBlob: Blob) => Promise<void>;
	reset: () => void;
}

export const useVoicePipeline = (
	options: UseVoicePipelineOptions = {}
): UseVoicePipelineReturn => {
	const { onStageChange, onComplete, onError } = options;

	const [state, setState] = useState<PipelineState>({
		stage: 'idle',
		progress: 0,
		error: null,
		transcription: null,
		aiResponse: null,
		audioUrl: null,
	});

	const updateStage = useCallback(
		(stage: PipelineStage, progress = 0): void => {
			setState((prev) => ({ ...prev, stage, progress }));
			onStageChange?.(stage);
		},
		[onStageChange]
	);

	const processAudio = useCallback(
		async (audioBlob: Blob): Promise<void> => {
			try {
				// Конвертация Blob в base64
				const audioBase64 = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onloadend = (): void => {
						if (typeof reader.result === 'string') {
							const base64 = reader.result.includes(',')
								? reader.result.split(',')[1]
								: reader.result;
							if (base64) {
								resolve(base64);
							} else {
								reject(new Error('Не удалось прочитать аудио файл'));
							}
						} else {
							reject(new Error('Не удалось прочитать аудио файл'));
						}
					};
					reader.onerror = (): void => {
						reject(new Error('Ошибка чтения аудио файла'));
					};
					reader.readAsDataURL(audioBlob);
				});

				updateStage('transcribing', 10);

				// Отправляем аудио на обработку через Live Voice API
				interface ProcessResponse {
					task_id?: string;
					transcription?: string;
					llm_response?: string;
					audio_url?: string;
					duration_ms?: number;
					stages?: Record<string, unknown>;
					timestamp?: string;
				}

				const processResponse = await apiClient.post<ProcessResponse>(
					'/api/v1/live-voice/process',
					{
						audio_base64: audioBase64,
						settings: {
							whisper_model: 'large-v3',
							llama_model: DEFAULT_LLAMA_MODEL,
							language: 'auto',
							tts_voice: 'auto',
							speed: 1.0,
						},
					}
				);

				const taskId = processResponse.data?.task_id;
				if (!taskId || typeof taskId !== 'string') {
					throw new Error('Не получен task_id');
				}

				// Polling статуса задачи
				interface StatusResponse {
					task_id?: string;
					status?: string;
					stage?: string;
					progress?: number;
					transcription?: string;
					ai_response?: string;
					audio_url?: string;
					error?: string;
				}

				const maxAttempts = 120; // 4 минуты максимум (2 секунды * 120)
				let attempts = 0;
				let lastStage = 'transcribing';

				while (attempts < maxAttempts) {
					await new Promise<void>((resolve) => setTimeout(resolve, 2000));

					const statusResponse = await apiClient.get<StatusResponse>(
						`/api/v1/live-voice/status/${taskId}`
					);
					const status = statusResponse.data;

					if (!status) {
						throw new Error('Не получен статус задачи');
					}

					// Обновляем stage
					const currentStage = status.stage;
					if (currentStage && typeof currentStage === 'string') {
						const progress =
							typeof status.progress === 'number' ? status.progress : 0;
						if (currentStage !== lastStage) {
							updateStage(currentStage as PipelineStage, progress);
							lastStage = currentStage;
						} else {
							updateStage(currentStage as PipelineStage, progress);
						}
					}

					// Обновляем данные
					if (
						status.transcription &&
						typeof status.transcription === 'string'
					) {
						setState((prev) => ({
							...prev,
							transcription: status.transcription as string,
						}));
					}
					if (status.ai_response && typeof status.ai_response === 'string') {
						setState((prev) => ({
							...prev,
							aiResponse: status.ai_response as string,
						}));
					}
					if (status.audio_url && typeof status.audio_url === 'string') {
						setState((prev) => ({
							...prev,
							audioUrl: status.audio_url as string,
						}));
					}

					// Проверяем завершение
					if (status.status === 'completed') {
						const audioUrl =
							status.audio_url && typeof status.audio_url === 'string'
								? status.audio_url
								: '';
						if (audioUrl) {
							const unregisterTts = registerTtsPlaying();
							const { playUrl, revoke } =
								await resolveAudioUrlForPlayback(audioUrl);
							const audio = new Audio(playUrl);
							await new Promise<void>((resolve, reject) => {
								audio.onended = (): void => {
									revoke();
									unregisterTts();
									updateStage('completed', 100);
									onComplete?.(audioUrl);
									resolve();
								};
								audio.onerror = (): void => {
									revoke();
									unregisterTts();
									reject(new Error('Ошибка воспроизведения аудио'));
								};
								void audio.play().catch((e: unknown) => {
									revoke();
									unregisterTts();
									reject(e instanceof Error ? e : new Error(String(e)));
								});
							});
						} else {
							updateStage('completed', 100);
							onComplete?.(audioUrl);
						}
						break;
					} else if (status.status === 'failed') {
						const errorMessage =
							status.error && typeof status.error === 'string'
								? status.error
								: 'Обработка не удалась';
						throw new Error(errorMessage);
					}

					attempts++;
				}

				if (attempts >= maxAttempts) {
					throw new Error('Таймаут обработки');
				}
			} catch (err) {
				// ✅ FIX: Graceful degradation для 404 - endpoint может не существовать
				const axiosError =
					err && typeof err === 'object' && 'response' in err
						? (err as { response?: { status?: number } })
						: null;

				if (axiosError?.response?.status === 404) {
					setState((prev) => ({
						...prev,
						stage: 'error',
						error: 'Сервис обработки голоса временно недоступен',
					}));
					// Не вызываем onError для 404 - это не критично
					return;
				}

				const error =
					err instanceof Error ? err : new Error('Ошибка обработки аудио');
				setState((prev) => ({
					...prev,
					stage: 'error',
					error: error.message,
				}));
				onError?.(error);
			}
		},
		[updateStage, onComplete, onError]
	);

	const reset = useCallback((): void => {
		setState({
			stage: 'idle',
			progress: 0,
			error: null,
			transcription: null,
			aiResponse: null,
			audioUrl: null,
		});
	}, []);

	return {
		state,
		processAudio,
		reset,
	};
};
