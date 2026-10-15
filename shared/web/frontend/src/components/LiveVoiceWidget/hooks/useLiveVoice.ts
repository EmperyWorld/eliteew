/**
 * useLiveVoice - Hook для управления голосовым общением
 *
 * Управляет полным pipeline: запись → транскрибация → генерация → синтез → воспроизведение
 *
 * Оптимизации:
 * - Оптимизированный audio level monitoring с throttle
 * - Мемоизация callbacks
 * - Улучшенная очистка ресурсов
 */

import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { liveVoiceService } from '../../../services/liveVoiceService';
import { log } from '../../../utils/logger';
import { DEFAULT_LLAMA_MODEL } from '../../../config';
import {
	DEFAULT_VOICE_SETTINGS,
	useVoiceSettingsOptional,
	VOICE_SETTINGS_STORAGE_KEY,
	type VoiceSettings,
} from '../../../voice-core';
import { registerMicActive, registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';

const loadSettings = (): VoiceSettings => {
	try {
		const saved = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved) as unknown;
			if (typeof parsed === 'object' && parsed !== null) {
				const s = parsed as Partial<VoiceSettings>;
				return {
					voice:
						typeof s.voice === 'string'
							? s.voice
							: DEFAULT_VOICE_SETTINGS.voice,
					language:
						typeof s.language === 'string'
							? s.language
							: DEFAULT_VOICE_SETTINGS.language,
					llamaModel:
						typeof s.llamaModel === 'string'
							? s.llamaModel
							: DEFAULT_LLAMA_MODEL,
					whisperModel:
						typeof s.whisperModel === 'string'
							? s.whisperModel
							: DEFAULT_VOICE_SETTINGS.whisperModel,
					speed:
						typeof s.speed === 'number'
							? s.speed
							: DEFAULT_VOICE_SETTINGS.speed,
					volume:
						typeof s.volume === 'number'
							? s.volume
							: DEFAULT_VOICE_SETTINGS.volume,
					enableArlekina:
						typeof s.enableArlekina === 'boolean'
							? s.enableArlekina
							: DEFAULT_VOICE_SETTINGS.enableArlekina,
				};
			}
		}
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		log.warn('useLiveVoice', 'Failed to load settings from localStorage', err);
	}
	return { ...DEFAULT_VOICE_SETTINGS, llamaModel: DEFAULT_LLAMA_MODEL };
};

export interface UseLiveVoiceOptions {
	onComplete?: (audioUrl: string) => void;
	onError?: (error: Error) => void;
}

export type PipelineStage =
	| 'idle'
	| 'recording'
	| 'transcribing'
	| 'generating'
	| 'synthesizing'
	| 'playing'
	| 'completed'
	| 'error';

export interface UseLiveVoiceReturn {
	isRecording: boolean;
	audioLevel: number;
	recordingDuration: number;
	pipelineStage: PipelineStage;
	pipelineProgress: number;
	transcription: string | null;
	aiResponse: string | null;
	audioUrl: string | null;
	error: Error | null;
	startRecording: () => Promise<void>;
	stopRecording: () => void;
	reset: () => void;
	audioChunksRef: React.MutableRefObject<Blob[]>;
	setPipelineStage: (stage: PipelineStage) => void;
	setPipelineProgress: (progress: number) => void;
}

export const useLiveVoice = (
	options: UseLiveVoiceOptions = {}
): UseLiveVoiceReturn => {
	const { onComplete, onError } = options;
	const voiceContext = useVoiceSettingsOptional();

	const [isRecording, setIsRecording] = useState(false);
	const [audioLevel, setAudioLevel] = useState(0);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
	const [pipelineProgress, setPipelineProgress] = useState(0);
	const [transcription, setTranscription] = useState<string | null>(null);
	const [aiResponse, setAiResponse] = useState<string | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [error, setError] = useState<Error | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const sessionIdRef = useRef<string>(
		`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	);
	const startTimeRef = useRef<number>(0);
	const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const settingsRef = useRef<VoiceSettings>(
		voiceContext?.settings ?? loadSettings()
	);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const unregisterMicActiveRef = useRef<(() => void) | null>(null);

	// Consume shared voice settings on each run (single source of truth)
	useEffect(() => {
		settingsRef.current = voiceContext?.settings ?? loadSettings();
	}, [voiceContext?.settings]);

	// Monitor audio level
	const monitorAudioLevel = useCallback(() => {
		if (!analyserRef.current) {
			return;
		}

		const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
		analyserRef.current.getByteFrequencyData(dataArray);
		const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
		setAudioLevel(average);

		animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
	}, []);

	// Start recording
	const startRecording = useCallback(async () => {
		try {
			setError(null);
			setPipelineStage('recording');
			setPipelineProgress(0);

			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;

			// Setup audio level visualization
			const audioContext = new AudioContext();
			const source = audioContext.createMediaStreamSource(stream);
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			analyserRef.current = analyser;

			// Start monitoring
			monitorAudioLevel();

			// Setup MediaRecorder
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (event: BlobEvent): void => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async (): Promise<void> => {
				unregisterMicActiveRef.current?.();
				unregisterMicActiveRef.current = null;
				try {
					const audioBlob = new Blob(audioChunksRef.current, {
						type: 'audio/webm',
					});

					// Проверяем, используется ли WebSocket (через window для глобального доступа)
					// Если WebSocket активен, отправляем через него, иначе через HTTP
					interface WindowWithLiveVoice extends Window {
						__liveVoiceUseWebSocket?: boolean;
					}
					const windowWithLiveVoice = window as WindowWithLiveVoice;
					const useWebSocket =
						windowWithLiveVoice.__liveVoiceUseWebSocket === true;

					if (useWebSocket) {
						// WebSocket режим - отправка через WebSocket будет обработана в useLiveVoiceWebSocket
						// Здесь просто обновляем состояние
						setPipelineStage('transcribing');
						setPipelineProgress(25);
						// Аудио будет отправлено через sendAudio в useLiveVoiceWebSocket
						return;
					}

					// HTTP режим: process through pipeline with current shared settings
					setPipelineStage('transcribing');
					setPipelineProgress(25);

					const currentSettings = settingsRef.current;

					const result = await liveVoiceService.processVoice(
						new File([audioBlob], 'recording.webm', { type: 'audio/webm' }),
						sessionIdRef.current,
						{
							language: currentSettings.language,
							whisperModel: currentSettings.whisperModel,
							llamaModel: currentSettings.llamaModel,
							ttsVoice: currentSettings.voice,
							enableArlekina: currentSettings.enableArlekina,
						}
					);

					setTranscription(result.transcription);
					setPipelineStage('generating');
					setPipelineProgress(50);

					setAiResponse(result.llm_response);
					setPipelineStage('synthesizing');
					setPipelineProgress(75);

					// Convert base64 data URL to blob URL for reliable playback (huge data: URLs break <audio> on some browsers).
					const audioBlobUrl = result.audio_url;
					setAudioUrl(audioBlobUrl);
					setPipelineStage('playing');
					setPipelineProgress(100);

					// Останавливаем предыдущее аудио если есть
					if (audioRef.current) {
						audioRef.current.pause();
						audioRef.current = null;
					}

					let revokeBlob: (() => void) | undefined;
					const { playUrl, revoke } =
						await resolveAudioUrlForPlayback(audioBlobUrl);
					revokeBlob = revoke;

					// Auto-play audio
					const unregisterTts = registerTtsPlaying();
					const audio = new Audio(playUrl);
					audioRef.current = audio;

					// Обработчики для очистки
					const handleEnded = (): void => {
						revokeBlob?.();
						revokeBlob = undefined;
						unregisterTts();
						setPipelineStage('completed');
						onComplete?.(audioBlobUrl);
						audioRef.current = null;
					};

					const handlePlayError = (err: Error): void => {
						revokeBlob?.();
						revokeBlob = undefined;
						unregisterTts();
						// AbortError - нормальная ситуация если компонент размонтирован
						if (err.name === 'AbortError') {
							log.info(
								'useLiveVoice',
								'Audio playback aborted (component unmounted)'
							);
							return;
						}
						log.error('useLiveVoice', 'Failed to play audio', err);
						setError(new Error('Не удалось воспроизвести аудио'));
						setPipelineStage('error');
						onError?.(err);
						audioRef.current = null;
					};

					audio.addEventListener('ended', handleEnded);
					audio.addEventListener('error', () =>
						handlePlayError(new Error('Audio playback error'))
					);

					audio
						.play()
						.then(() => {
							// Воспроизведение началось успешно
						})
						.catch((err: unknown) => {
							const error = err instanceof Error ? err : new Error(String(err));
							handlePlayError(error);
						});
				} catch (err: unknown) {
					// ✅ FIX: Проверяем 404 ПЕРВЫМ, до создания Error объекта
					const axiosError =
						err && typeof err === 'object' && 'response' in err
							? (err as { response?: { status?: number; data?: unknown } })
							: null;

					// Проверяем также сообщение об ошибке (может быть из liveVoiceService.ts)
					const is404 =
						axiosError?.response?.status === 404 ||
						(err instanceof Error && err.message.includes('404')) ||
						(err &&
							typeof err === 'object' &&
							'message' in err &&
							typeof (err as { message?: string }).message === 'string' &&
							(err as { message: string }).message.includes('404'));

					if (is404) {
						log.warn(
							'useLiveVoice',
							'Live Voice API endpoint not available (404)'
						);
						setError(new Error('Сервис обработки голоса временно недоступен'));
						setPipelineStage('error');
						// Не вызываем onError для 404 - это не критично
						return;
					}

					// ✅ FIX: Улучшенная обработка ошибок с понятными сообщениями
					let error: Error;
					if (err instanceof Error) {
						error = err;
					} else if (err && typeof err === 'object' && 'message' in err) {
						const message = (err as { message: unknown }).message;
						error = new Error(String(message));
					} else if (axiosError?.response) {
						const response = axiosError.response as {
							data?: unknown;
							status?: number;
						};
						if (typeof response.data === 'string') {
							error = new Error(response.data);
						} else if (
							response.data &&
							typeof response.data === 'object' &&
							response.data !== null &&
							'detail' in response.data
						) {
							const detail = (response.data as { detail: unknown }).detail;
							error = new Error(String(detail));
						} else if (response.status === 500) {
							error = new Error(
								'Ошибка на сервере. Пожалуйста, попробуйте позже.'
							);
						} else {
							error = new Error('Произошла ошибка при обработке голоса');
						}
					} else if (err && typeof err === 'object' && 'code' in err) {
						const code = (err as { code?: unknown }).code;
						const message = (err as { message?: unknown }).message;
						if (
							String(code) === 'ECONNABORTED' ||
							(typeof message === 'string' && message.includes('timeout'))
						) {
							error = new Error(
								'Превышено время ожидания. Попробуйте еще раз.'
							);
						} else {
							error = new Error('Произошла ошибка при обработке голоса');
						}
					} else {
						error = new Error('Произошла ошибка при обработке голоса');
					}

					const errorForLog =
						err instanceof Error ? err : new Error(String(err));
					log.error('useLiveVoice', '❌ LiveVoice error', errorForLog, {
						message: error.message,
					});
					setError(error);
					setPipelineStage('error');
					onError?.(error);
				} finally {
					// Cleanup
					if (streamRef.current) {
						for (const track of streamRef.current.getTracks()) {
							track.stop();
						}
						streamRef.current = null;
					}
					if (animationFrameRef.current) {
						cancelAnimationFrame(animationFrameRef.current);
						animationFrameRef.current = null;
					}
					setAudioLevel(0);
				}
			};

			mediaRecorder.start();
			unregisterMicActiveRef.current = registerMicActive();
			setIsRecording(true);
			startTimeRef.current = Date.now();
			setRecordingDuration(0);

			// Update duration
			durationIntervalRef.current = setInterval(() => {
				setRecordingDuration(
					Math.floor((Date.now() - startTimeRef.current) / 1000)
				);
			}, 1000);
		} catch (err: unknown) {
			const error =
				err instanceof Error
					? err
					: new Error('Не удалось получить доступ к микрофону');
			setError(error);
			setPipelineStage('error');
			onError?.(error);
		}
	}, [monitorAudioLevel, onComplete, onError]);

	// Stop recording
	const stopRecording = useCallback((): void => {
		unregisterMicActiveRef.current?.();
		unregisterMicActiveRef.current = null;
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);

			if (durationIntervalRef.current) {
				clearInterval(durationIntervalRef.current);
				durationIntervalRef.current = null;
			}
		}
	}, [isRecording]);

	// Reset
	const reset = useCallback((): void => {
		unregisterMicActiveRef.current?.();
		unregisterMicActiveRef.current = null;
		setIsRecording(false);
		setAudioLevel(0);
		setRecordingDuration(0);
		setPipelineStage('idle');
		setPipelineProgress(0);
		setTranscription(null);
		setAiResponse(null);
		setAudioUrl(null);
		setError(null);

		// Останавливаем и очищаем аудио
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}

		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) {
				track.stop();
			}
			streamRef.current = null;
		}
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
		if (durationIntervalRef.current) {
			clearInterval(durationIntervalRef.current);
			durationIntervalRef.current = null;
		}
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return (): void => {
			reset();
		};
	}, [reset]);

	return {
		isRecording,
		audioLevel,
		recordingDuration,
		pipelineStage,
		pipelineProgress,
		transcription,
		aiResponse,
		audioUrl,
		error,
		startRecording,
		stopRecording,
		reset,
		audioChunksRef,
		setPipelineStage,
		setPipelineProgress,
	};
};
