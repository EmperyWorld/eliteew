/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Пайплайн диалога voice-gateway (запись → `/voice-gateway/process`) для Студия ГУ: STT, ответ LLM, TTS playback.
 *
 * Invariants:
 * - Inline `data:` аудио из API готовим через `resolveAudioUrlForPlayback` перед `Audio()`, затем освобождаем blob URL.
 * - Регистрация `registerTtsPlaying` / `registerMicActive` снимается при завершении, ошибке и `stop`.
 *
 * Related:
 * - `generated/voice-gateway-openapi`, `api` client.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { components, operations } from '@/generated/voice-gateway-openapi';
import { api } from '@/services/api/client';
import { getApiErrorMessage } from '@/utils/apiError';
import { log } from '@/utils/logger';
import { registerMicActive, registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';

export interface ConversationItem {
	id: string;
	type: 'user' | 'ai';
	text: string;
	audioUrl?: string;
	timestamp: Date;
}

export type DialogPipelineStage =
	| 'idle'
	| 'recording'
	| 'transcribing'
	| 'generating'
	| 'synthesizing'
	| 'playing'
	| 'completed'
	| 'error';

export interface VoiceInfo {
	id: string;
	name: string;
	provider: string;
	language: string;
}

export function useVoiceGatewayDialog(): {
	conversation: ConversationItem[];
	pipelineStage: DialogPipelineStage;
	isRecording: boolean;
	isPlaying: boolean;
	error: string | null;
	voices: VoiceInfo[];
	selectedVoice: string;
	setSelectedVoice: (v: string) => void;
	showSettings: boolean;
	setShowSettings: (v: boolean) => void;
	startRecording: () => Promise<void>;
	stopRecording: () => void;
	stopPlayback: () => void;
	reset: () => void;
	playAudio: (url: string) => void;
} {
	const [isRecording, setIsRecording] = useState(false);
	const [pipelineStage, setPipelineStage] =
		useState<DialogPipelineStage>('idle');
	const [conversation, setConversation] = useState<ConversationItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [selectedVoice, setSelectedVoice] = useState('auto');
	const [voices, setVoices] = useState<VoiceInfo[]>([]);
	const [showSettings, setShowSettings] = useState(false);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const unregisterMicRef = useRef<(() => void) | null>(null);
	const unregisterTtsRef = useRef<(() => void) | null>(null);
	const revokePlaybackRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return (): void => {
			revokePlaybackRef.current?.();
			revokePlaybackRef.current = null;
		};
	}, []);

	useEffect(() => {
		const fetchVoices = async () => {
			try {
				type VoicesPayload =
					operations['voices_api_v1_voice_gateway_voices_get']['responses'][200]['content']['application/json'];
				const data = await api.get<VoicesPayload>('/voice-gateway/voices', {
					baseURL: '/api/v1',
				});
				const rows = Array.isArray(data) ? data : [];
				setVoices(
					rows.map((v) => {
						const row = v as Record<string, unknown>;
						const id = typeof row.id === 'string' ? row.id : undefined;
						const name = typeof row.name === 'string' ? row.name : undefined;
						return {
							id: id ?? name ?? 'xenia',
							name: name ?? id ?? 'xenia',
							provider:
								typeof row.provider === 'string' ? row.provider : 'silero',
							language: typeof row.language === 'string' ? row.language : 'ru',
						};
					})
				);
			} catch (e) {
				log.warn(
					'StudioGU',
					'Failed to load voices',
					e instanceof Error ? e : undefined
				);
			}
		};
		void fetchVoices();
	}, []);

	const playAudio = useCallback((url: string) => {
		void (async (): Promise<void> => {
			unregisterTtsRef.current?.();
			unregisterTtsRef.current = null;
			revokePlaybackRef.current?.();
			revokePlaybackRef.current = null;
			if (audioRef.current) {
				audioRef.current.pause();
			}

			let playUrl: string;
			let revoke: () => void;
			try {
				const resolved = await resolveAudioUrlForPlayback(url);
				playUrl = resolved.playUrl;
				revoke = resolved.revoke;
			} catch {
				setError('Ошибка воспроизведения');
				setPipelineStage('error');
				setIsPlaying(false);
				return;
			}
			revokePlaybackRef.current = revoke;

			const audio = new Audio(playUrl);
			audioRef.current = audio;
			unregisterTtsRef.current = registerTtsPlaying();

			audio.onended = () => {
				revokePlaybackRef.current?.();
				revokePlaybackRef.current = null;
				unregisterTtsRef.current?.();
				unregisterTtsRef.current = null;
				setIsPlaying(false);
				setPipelineStage('completed');
			};

			audio.onerror = () => {
				revokePlaybackRef.current?.();
				revokePlaybackRef.current = null;
				unregisterTtsRef.current?.();
				unregisterTtsRef.current = null;
				setError('Ошибка воспроизведения');
				setIsPlaying(false);
				setPipelineStage('error');
			};

			try {
				await audio.play();
				setIsPlaying(true);
			} catch (e: unknown) {
				revokePlaybackRef.current?.();
				revokePlaybackRef.current = null;
				unregisterTtsRef.current?.();
				unregisterTtsRef.current = null;
				setIsPlaying(false);
				const blocked =
					e instanceof DOMException && e.name === 'NotAllowedError';
				if (blocked) {
					setPipelineStage('idle');
				} else {
					setError('Ошибка воспроизведения');
					setPipelineStage('error');
				}
			}
		})();
	}, []);

	const processAudio = useCallback(
		async (audioBlob: Blob) => {
			try {
				setPipelineStage('transcribing');
				const formData = new FormData();
				formData.append('file', audioBlob, 'recording.webm');
				formData.append('tts_voice', selectedVoice || 'auto');

				const response = await api.post<
					components['schemas']['ProcessAudioResponse']
				>('/voice-gateway/process', formData, {
					baseURL: '/api/v1',
					timeout: 120000,
				});

				const userText = response.transcription ?? '';
				if (!userText || userText.trim() === '') {
					setError('Не удалось распознать речь');
					setPipelineStage('error');
					return;
				}

				const userMessage: ConversationItem = {
					id: `user-${Date.now()}`,
					type: 'user',
					text: userText,
					timestamp: new Date(),
				};
				setConversation((prev) => [...prev, userMessage]);

				const aiText = response.llm_response ?? '';
				if (!aiText.trim()) {
					setError('Пустой ответ от модели');
					setPipelineStage('error');
					return;
				}

				setPipelineStage('playing');
				const audioUrl = response.audio_url ?? null;
				const aiMessage: ConversationItem = {
					id: `ai-${Date.now()}`,
					type: 'ai',
					text: aiText,
					audioUrl: audioUrl ?? undefined,
					timestamp: new Date(),
				};
				setConversation((prev) => [...prev, aiMessage]);

				if (audioUrl) {
					playAudio(audioUrl);
				} else {
					setPipelineStage('completed');
				}
			} catch (err) {
				setError(getApiErrorMessage(err));
				setPipelineStage('error');
			}
		},
		[playAudio, selectedVoice]
	);

	const startRecording = useCallback(async () => {
		try {
			setError(null);
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;

			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm',
			});
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				unregisterMicRef.current?.();
				unregisterMicRef.current = null;
				const audioBlob = new Blob(audioChunksRef.current, {
					type: 'audio/webm',
				});
				await processAudio(audioBlob);
			};

			mediaRecorder.start(100);
			unregisterMicRef.current = registerMicActive();
			setIsRecording(true);
			setPipelineStage('recording');
		} catch {
			setError('Не удалось получить доступ к микрофону');
			setPipelineStage('error');
		}
	}, [processAudio]);

	const stopRecording = useCallback(() => {
		unregisterMicRef.current?.();
		unregisterMicRef.current = null;
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			streamRef.current?.getTracks().forEach((track) => {
				track.stop();
			});
			setIsRecording(false);
		}
	}, [isRecording]);

	const stopPlayback = useCallback(() => {
		revokePlaybackRef.current?.();
		revokePlaybackRef.current = null;
		unregisterTtsRef.current?.();
		unregisterTtsRef.current = null;
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
		setIsPlaying(false);
		setPipelineStage('completed');
	}, []);

	const reset = useCallback(() => {
		setError(null);
		setPipelineStage('idle');
		stopPlayback();
	}, [stopPlayback]);

	return {
		conversation,
		pipelineStage,
		isRecording,
		isPlaying,
		error,
		voices,
		selectedVoice,
		setSelectedVoice,
		showSettings,
		setShowSettings,
		startRecording,
		stopRecording,
		stopPlayback,
		reset,
		playAudio,
	};
}
