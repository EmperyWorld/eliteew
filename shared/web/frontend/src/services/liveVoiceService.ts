/**
 * Live Voice Service - API client for live voice communication
 *
 * @version 1.0.0
 * @date 2025-01-XX
 */

import { isAxiosError } from 'axios';
import { apiClient } from './api';

export interface InitializeResponse {
	success: boolean;
	models: {
		whisper: boolean;
		tts: boolean;
		llama: boolean;
	};
	message: string;
}

export interface ProcessVoiceResponse {
	transcription: string;
	llm_response: string;
	audio_url: string; // Base64 data URL
	duration_ms: number;
	stages: {
		transcription?: { duration_ms: number };
		llm?: { duration_ms: number };
		tts?: { duration_ms: number };
	};
	task_id: string;
	timestamp?: string;
}

export interface ChatHistoryResponse {
	session_id: string;
	messages: Array<{
		role: 'user' | 'assistant';
		content: string;
	}>;
	count: number;
}

export interface StatusResponse {
	models: {
		whisper: boolean;
		tts: boolean;
		llama: boolean;
	};
	ready: boolean;
}

const API_BASE = '/api/v1/live-voice';

export const liveVoiceService = {
	/**
	 * Initialize and pre-load models
	 */
	async initialize(): Promise<InitializeResponse> {
		const response = await apiClient.post(`${API_BASE}/initialize`);
		return response.data;
	},

	/**
	 * Process voice input through full pipeline
	 */
	async processVoice(
		audioFile: File,
		sessionId: string,
		options?: {
			language?: string;
			whisperModel?: string;
			llamaModel?: string;
			ttsVoice?: string;
			enableArlekina?: boolean;
		}
	): Promise<ProcessVoiceResponse> {
		const formData = new FormData();
		formData.append('file', audioFile);
		formData.append('session_id', sessionId);

		if (options?.language) {
			formData.append('language', options.language);
		}
		if (options?.whisperModel) {
			formData.append('whisper_model', options.whisperModel);
		}
		if (options?.llamaModel) {
			formData.append('llama_model', options.llamaModel);
		}
		if (options?.ttsVoice) {
			formData.append('tts_voice', options.ttsVoice);
		}
		if (typeof options?.enableArlekina === 'boolean') {
			formData.append(
				'enable_arlekina',
				options.enableArlekina ? 'true' : 'false'
			);
		}

		try {
			const response = await apiClient.post(`${API_BASE}/process`, formData, {
				headers: {
					'Content-Type': 'multipart/form-data',
				},
				timeout: 120000, // 2 minutes timeout
				// ✅ FIX: Добавляем обработку ошибок таймаута
				onUploadProgress: (_progressEvent) => {
					// Можно добавить прогресс загрузки если нужно
				},
			});

			return response.data;
		} catch (error: unknown) {
			if (isAxiosError(error)) {
				// ✅ FIX: Graceful degradation для 404 - endpoint может не существовать
				if (error.response?.status === 404) {
					throw new Error('Live Voice API endpoint not available (404)');
				}
				// ✅ FIX: Улучшенная обработка ошибок
				if (
					error.code === 'ECONNABORTED' ||
					error.message?.includes('timeout')
				) {
					throw new Error(
						'Превышено время ожидания ответа от сервера. Попробуйте еще раз.'
					);
				}
				if (error.response?.status === 500) {
					throw new Error('Ошибка на сервере. Пожалуйста, попробуйте позже.');
				}
				if (error.response?.status === 413) {
					throw new Error('Файл слишком большой. Максимальный размер: 10MB');
				}
			}
			// Пробрасываем оригинальную ошибку если это другая проблема
			throw error;
		}
	},

	/**
	 * Get chat history for a session
	 */
	async getChatHistory(
		sessionId: string,
		limit = 10
	): Promise<ChatHistoryResponse> {
		const response = await apiClient.get(`${API_BASE}/session/${sessionId}`, {
			params: { limit },
		});
		return response.data;
	},

	/**
	 * Clear chat session
	 */
	async clearSession(sessionId: string): Promise<void> {
		await apiClient.delete(`${API_BASE}/session/${sessionId}`);
	},

	/**
	 * Get models status
	 */
	async getStatus(): Promise<StatusResponse> {
		const response = await apiClient.get(`${API_BASE}/status`);
		return response.data;
	},
};
