/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Хук виджета Live Voice: запись → пайплайн (Whisper / Llama / TTS) → воспроизведение ответа.
 *
 * Invariants:
 * - URL аудио для `Audio()` нормализуем через `resolveAudioUrlForPlayback` (без «сырого» `data:` при строгом CSP).
 *
 * Related:
 * - `liveVoiceService`, `registerTtsPlaying`.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { isAxiosError } from 'axios';
import {
	liveVoiceService,
	type ProcessVoiceResponse,
} from '../services/liveVoiceService';
import { useNotifications } from '@/notifications';
import { registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';
import { log } from '../utils/logger';
import { DEFAULT_LLAMA_MODEL } from '../config';

export type VoiceWidgetState =
	| 'idle'
	| 'initializing'
	| 'ready'
	| 'recording'
	| 'processing'
	| 'playing';

export interface ConversationMessage {
	id: string;
	role: 'user' | 'assistant';
	text: string;
	audioUrl?: string;
	timestamp: string;
	processingTime?: number;
}

export interface LiveVoiceState {
	state: VoiceWidgetState;
	sessionId: string | null;
	modelsReady: boolean;
	conversation: ConversationMessage[];
	currentAudioUrl: string | null;
	isPlaying: boolean;
	error: string | null;
	processingStage: string;
}

export interface UseLiveVoiceReturn {
	state: LiveVoiceState;
	initialize: () => Promise<void>;
	startRecording: () => void;
	stopRecording: () => void;
	processAudio: (audioBlob: Blob) => Promise<void>;
	playAudio: (audioUrl: string) => void;
	stopAudio: () => void;
	clearConversation: () => void;
	settings: {
		whisperModel: string;
		llamaModel: string;
		ttsVoice: string;
		language: string;
	};
	updateSettings: (settings: Partial<UseLiveVoiceReturn['settings']>) => void;
}

const DEFAULT_SETTINGS = {
	whisperModel: 'tiny',
	llamaModel: DEFAULT_LLAMA_MODEL,
	ttsVoice: 'xenia',
	language: 'ru',
};

const SETTINGS_STORAGE_KEY = 'liveVoice_settings';

export const useLiveVoice = (): UseLiveVoiceReturn => {
	const [state, setState] = useState<LiveVoiceState>({
		state: 'idle',
		sessionId: null,
		modelsReady: false,
		conversation: [],
		currentAudioUrl: null,
		isPlaying: false,
		error: null,
		processingStage: '',
	});

	// Load settings from localStorage on mount
	const loadSettings = (): typeof DEFAULT_SETTINGS => {
		try {
			const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				return { ...DEFAULT_SETTINGS, ...parsed };
			}
		} catch (e) {
			log.warn('useLiveVoice', 'Failed to load settings from localStorage', e);
		}
		return DEFAULT_SETTINGS;
	};

	const [settings, setSettings] = useState(loadSettings);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const revokeAudioBlobRef = useRef<(() => void) | null>(null);
	const { toast } = useNotifications();

	// Save settings to localStorage when they change
	useEffect(() => {
		try {
			localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		} catch (e) {
			log.warn('useLiveVoice', 'Failed to save settings to localStorage', e);
		}
	}, [settings]);

	// Generate session ID on mount
	useEffect(() => {
		const sessionId = `live_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		setState((prev) => ({ ...prev, sessionId }));
	}, []);

	// Initialize models
	const initialize = useCallback(async () => {
		try {
			setState((prev) => ({ ...prev, state: 'initializing', error: null }));

			const result = await liveVoiceService.initialize();

			setState((prev) => ({
				...prev,
				state: result.success ? 'ready' : 'idle',
				modelsReady: result.success,
				error: result.success ? null : result.message,
			}));

			if (result.success) {
				toast.success('Модели готовы', 'Голосовое общение активировано');
			} else {
				toast.error('Ошибка инициализации', result.message);
			}
		} catch (error: unknown) {
			let errorMessage = 'Ошибка инициализации';
			if (isAxiosError(error)) {
				const data = error.response?.data;
				if (data && typeof data === 'object' && 'detail' in data) {
					errorMessage = String((data as { detail: unknown }).detail);
				} else if (error.message) {
					errorMessage = error.message;
				}
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}
			setState((prev) => ({
				...prev,
				state: 'idle',
				modelsReady: false,
				error: errorMessage,
			}));
			toast.error('Ошибка', errorMessage);
		}
	}, [toast]);

	// Play audio
	const playAudio = useCallback(
		(audioUrl: string) => {
			void (async (): Promise<void> => {
				if (audioRef.current) {
					audioRef.current.pause();
				}
				revokeAudioBlobRef.current?.();
				revokeAudioBlobRef.current = null;

				try {
					const { playUrl, revoke } =
						await resolveAudioUrlForPlayback(audioUrl);
					revokeAudioBlobRef.current = revoke;

					const unregisterTts = registerTtsPlaying();
					const audio = new Audio(playUrl);
					audioRef.current = audio;

					audio.onplay = () => {
						setState((prev) => ({ ...prev, isPlaying: true }));
					};

					audio.onended = () => {
						revokeAudioBlobRef.current?.();
						revokeAudioBlobRef.current = null;
						unregisterTts();
						setState((prev) => ({ ...prev, isPlaying: false }));
					};

					audio.onerror = () => {
						revokeAudioBlobRef.current?.();
						revokeAudioBlobRef.current = null;
						unregisterTts();
						setState((prev) => ({ ...prev, isPlaying: false }));
						toast.error('Ошибка', 'Не удалось воспроизвести аудио');
					};

					try {
						await audio.play();
					} catch (error: unknown) {
						revokeAudioBlobRef.current?.();
						revokeAudioBlobRef.current = null;
						unregisterTts();
						log.error(
							'useLiveVoice',
							'Audio play error',
							error instanceof Error ? error : undefined,
							error
						);
						toast.error('Ошибка', 'Не удалось воспроизвести аудио');
					}
				} catch {
					toast.error('Ошибка', 'Не удалось воспроизвести аудио');
				}
			})();
		},
		[toast]
	);

	// Process audio through pipeline
	const processAudio = useCallback(
		async (audioBlob: Blob) => {
			if (!state.sessionId) {
				toast.error('Ошибка', 'Сессия не создана');
				return;
			}

			try {
				setState((prev) => ({
					...prev,
					state: 'processing',
					processingStage: 'Транскрибация...',
				}));

				// Convert Blob to File
				const audioFile = new File([audioBlob], 'recording.webm', {
					type: 'audio/webm',
				});

				// Process through pipeline
				setState((prev) => ({ ...prev, processingStage: 'Транскрибация...' }));
				const result: ProcessVoiceResponse =
					await liveVoiceService.processVoice(audioFile, state.sessionId, {
						language: settings.language,
						whisperModel: settings.whisperModel,
						llamaModel: settings.llamaModel,
						ttsVoice: settings.ttsVoice,
					});

				// Update processing stage based on result stages
				if (result.stages) {
					const _totalTime = result.duration_ms;
					const _whisperTime = result.stages.transcription?.duration_ms || 0;
					const _llamaTime = result.stages.llm?.duration_ms || 0;

					// Simulate progress updates
					setState((prev) => ({
						...prev,
						processingStage: 'Обработка в Llama...',
					}));
					await new Promise((resolve) => setTimeout(resolve, 100));
					setState((prev) => ({ ...prev, processingStage: 'Синтез речи...' }));
				}

				// Add messages to conversation
				const userMessage: ConversationMessage = {
					id: `user_${Date.now()}`,
					role: 'user',
					text: result.transcription,
					timestamp: new Date().toISOString(),
				};

				const assistantMessage: ConversationMessage = {
					id: `assistant_${Date.now()}`,
					role: 'assistant',
					text: result.llm_response,
					audioUrl: result.audio_url,
					timestamp: result.timestamp || new Date().toISOString(),
					processingTime: result.duration_ms,
				};

				setState((prev) => ({
					...prev,
					state: 'ready',
					conversation: [...prev.conversation, userMessage, assistantMessage],
					currentAudioUrl: result.audio_url,
					processingStage: '',
				}));

				// Auto-play response
				if (result.audio_url) {
					playAudio(result.audio_url);
				}

				toast.success('Готово', `Обработано за ${result.duration_ms}мс`);
			} catch (error: unknown) {
				let errorMessage = 'Ошибка обработки';
				if (isAxiosError(error)) {
					const data = error.response?.data;
					if (data && typeof data === 'object' && 'detail' in data) {
						errorMessage = String((data as { detail: unknown }).detail);
					} else if (error.message) {
						errorMessage = error.message;
					}
				} else if (error instanceof Error) {
					errorMessage = error.message;
				}
				setState((prev) => ({
					...prev,
					state: 'ready',
					error: errorMessage,
					processingStage: '',
				}));
				toast.error('Ошибка', errorMessage);
			}
		},
		[state.sessionId, settings, toast, playAudio]
	);

	// Stop audio
	const stopAudio = useCallback(() => {
		revokeAudioBlobRef.current?.();
		revokeAudioBlobRef.current = null;
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
		setState((prev) => ({ ...prev, isPlaying: false }));
	}, []);

	// Clear conversation
	const clearConversation = useCallback(async () => {
		if (state.sessionId) {
			try {
				await liveVoiceService.clearSession(state.sessionId);
			} catch (error) {
				log.error(
					'useLiveVoice',
					'Failed to clear session',
					error instanceof Error ? error : undefined,
					error
				);
			}
		}

		const newSessionId = `live_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		setState((prev) => ({
			...prev,
			sessionId: newSessionId,
			conversation: [],
			currentAudioUrl: null,
			isPlaying: false,
		}));

		stopAudio();
	}, [state.sessionId, stopAudio]);

	// Update settings
	const updateSettings = useCallback(
		(newSettings: Partial<typeof settings>) => {
			setSettings((prev) => ({ ...prev, ...newSettings }));
		},
		[]
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			revokeAudioBlobRef.current?.();
			revokeAudioBlobRef.current = null;
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);

	return {
		state,
		initialize,
		startRecording: () => setState((prev) => ({ ...prev, state: 'recording' })),
		stopRecording: () => setState((prev) => ({ ...prev, state: 'ready' })),
		processAudio,
		playAudio,
		stopAudio,
		clearConversation,
		settings,
		updateSettings,
	};
};
