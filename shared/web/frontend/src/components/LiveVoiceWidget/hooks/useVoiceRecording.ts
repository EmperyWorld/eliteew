/**
 * useVoiceRecording - Hook для записи аудио с микрофона
 *
 * Использует MediaRecorder API для записи аудио
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { registerMicActive } from '@/voice-core/micActive';

interface UseVoiceRecordingOptions {
	onRecordingComplete?: (audioBlob: Blob) => void;
	onError?: (error: Error) => void;
	sampleRate?: number;
	maxDuration?: number; // в секундах
}

interface UseVoiceRecordingReturn {
	isRecording: boolean;
	audioLevel: number; // 0-100
	duration: number; // в секундах
	startRecording: () => Promise<void>;
	stopRecording: () => void;
	pauseRecording: () => void;
	resumeRecording: () => void;
	error: Error | null;
}

export const useVoiceRecording = (
	options: UseVoiceRecordingOptions = {}
): UseVoiceRecordingReturn => {
	const {
		onRecordingComplete,
		onError,
		sampleRate = 16000,
		maxDuration = 300, // 5 минут максимум
	} = options;

	const [isRecording, setIsRecording] = useState(false);
	const [audioLevel, setAudioLevel] = useState(0);
	const [duration, setDuration] = useState(0);
	const [error, setError] = useState<Error | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
	const levelUpdateRef = useRef<number | null>(null);
	const unregisterMicActiveRef = useRef<(() => void) | null>(null);

	const stopRecording = useCallback((): void => {
		unregisterMicActiveRef.current?.();
		unregisterMicActiveRef.current = null;
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}

		if (durationTimerRef.current) {
			clearInterval(durationTimerRef.current);
			durationTimerRef.current = null;
		}

		if (levelUpdateRef.current) {
			cancelAnimationFrame(levelUpdateRef.current);
			levelUpdateRef.current = null;
		}

		setAudioLevel(0);
	}, [isRecording]);

	const updateAudioLevel = useCallback((): void => {
		if (!analyserRef.current || !isRecording) {
			return;
		}

		const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
		analyserRef.current.getByteFrequencyData(dataArray);

		const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
		setAudioLevel(Math.min(100, (average / 255) * 100));

		if (isRecording) {
			levelUpdateRef.current = requestAnimationFrame(updateAudioLevel);
		}
	}, [isRecording]);

	// Очистка при размонтировании
	useEffect(() => {
		return (): void => {
			unregisterMicActiveRef.current?.();
			unregisterMicActiveRef.current = null;
			stopRecording();
			if (
				audioContextRef.current &&
				audioContextRef.current.state !== 'closed'
			) {
				audioContextRef.current.close();
			}
			if (streamRef.current) {
				for (const track of streamRef.current.getTracks()) {
					track.stop();
				}
			}
		};
	}, [stopRecording]);

	const startRecording = useCallback(async (): Promise<void> => {
		try {
			setError(null);
			setDuration(0);
			audioChunksRef.current = [];

			// Запрос доступа к микрофону
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					sampleRate: sampleRate,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			streamRef.current = stream;

			// Определение MIME типа
			let mimeType = 'audio/webm;codecs=opus';
			if (!MediaRecorder.isTypeSupported(mimeType)) {
				mimeType = 'audio/webm';
				if (!MediaRecorder.isTypeSupported(mimeType)) {
					mimeType = '';
				}
			}

			// Создание MediaRecorder
			const mediaRecorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream);

			mediaRecorderRef.current = mediaRecorder;

			// Настройка AudioContext для визуализации
			const audioContext = new AudioContext({ sampleRate });
			const analyser = audioContext.createAnalyser();
			const source = audioContext.createMediaStreamSource(stream);

			analyser.fftSize = 256;
			source.connect(analyser);

			audioContextRef.current = audioContext;
			analyserRef.current = analyser;

			// Обработка данных
			mediaRecorder.ondataavailable = (event: BlobEvent): void => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = (): void => {
				unregisterMicActiveRef.current?.();
				unregisterMicActiveRef.current = null;
				const audioBlob = new Blob(audioChunksRef.current, {
					type: mimeType || 'audio/webm',
				});
				onRecordingComplete?.(audioBlob);

				// Очистка
				if (
					audioContextRef.current &&
					audioContextRef.current.state !== 'closed'
				) {
					audioContextRef.current.close();
				}
				for (const track of stream.getTracks()) {
					track.stop();
				}
			};

			mediaRecorder.onerror = (event: Event): void => {
				const errorEvent = event as ErrorEvent;
				let errorMessage: string | undefined;
				if (errorEvent.error) {
					if (errorEvent.error instanceof Error) {
						errorMessage = errorEvent.error.message;
					} else if (
						typeof errorEvent.error === 'object' &&
						errorEvent.error !== null &&
						'message' in errorEvent.error
					) {
						const msg = (errorEvent.error as { message?: unknown }).message;
						errorMessage = typeof msg === 'string' ? msg : undefined;
					}
				}
				const error = new Error(
					typeof errorMessage === 'string'
						? errorMessage
						: 'Ошибка записи аудио'
				);
				setError(error);
				onError?.(error);
			};

			// Начало записи
			mediaRecorder.start(100); // Сохранять данные каждые 100ms
			unregisterMicActiveRef.current = registerMicActive();
			setIsRecording(true);

			// Запуск обновления уровня звука
			updateAudioLevel();

			// Таймер длительности
			const startTime = Date.now();
			durationTimerRef.current = setInterval(() => {
				const elapsed = (Date.now() - startTime) / 1000;
				setDuration(elapsed);

				// Проверка максимальной длительности
				if (elapsed >= maxDuration) {
					stopRecording();
				}
			}, 100);
		} catch (err) {
			const error =
				err instanceof Error ? err : new Error('Не удалось начать запись');
			setError(error);
			onError?.(error);
			setIsRecording(false);
		}
	}, [
		sampleRate,
		maxDuration,
		onRecordingComplete,
		onError,
		updateAudioLevel,
		stopRecording,
	]);

	const pauseRecording = useCallback((): void => {
		if (
			mediaRecorderRef.current &&
			isRecording &&
			mediaRecorderRef.current.state === 'recording'
		) {
			mediaRecorderRef.current.pause();
		}
	}, [isRecording]);

	const resumeRecording = useCallback((): void => {
		if (
			mediaRecorderRef.current &&
			isRecording &&
			mediaRecorderRef.current.state === 'paused'
		) {
			mediaRecorderRef.current.resume();
		}
	}, [isRecording]);

	return {
		isRecording,
		audioLevel,
		duration,
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		error,
	};
};
