/**
 * LiveVoiceWidget - Главный компонент виджета живого общения
 *
 * Премиум дизайн: строгий и гармоничный виджет для голосового взаимодействия с AI
 *
 * Оптимизации:
 * - Мемоизация всех callbacks
 * - Оптимизированные зависимости useEffect
 * - Плавные переходы состояний
 */

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { WidgetMinimized } from './WidgetMinimized';
import { WidgetExpanded } from './WidgetExpanded';
import {
	LIVE_VOICE_HISTORY_UPDATED_EVENT,
	useUnifiedVoiceSession,
} from '@/voice-core';
import { registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';
import { useLiveVoiceWebSocket } from './hooks/useLiveVoiceWebSocket';
import { useDraggable } from './hooks/useDraggable';
import { emitVoiceTranscription } from '@/hooks/useVoiceCommands';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { handleAPIError } from '../../services/api/error-handler';
import { log } from '../../utils/logger';
import { logUxError } from '../../utils/uxErrorLog';

interface LiveVoiceWidgetProps {
	/** Позиция виджета */
	position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
	/** Начальное состояние (свернуто/развернуто) */
	defaultExpanded?: boolean;
}

export const LiveVoiceWidget: React.FC<LiveVoiceWidgetProps> = ({
	// position is reserved for future positioning functionality
	// position = 'bottom-left',
	defaultExpanded = false,
}) => {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);
	const sessionIdRef = useRef(`live-voice-${Date.now()}`);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Draggable functionality - default to right middle
	const {
		position: dragPosition,
		isDragging,
		elementRef,
		handleMouseDown,
	} = useDraggable({
		initialPosition: {
			x: window.innerWidth - 100, // Правый угол
			y: window.innerHeight / 2 - 50, // Середина по вертикали
		},
		storageKey: 'liveVoiceWidget_position',
		bounds: {
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		},
	});

	// Состояние для WebSocket
	const [wsTranscription, setWsTranscription] = useState<string | null>(null);
	const [wsAiResponse, setWsAiResponse] = useState<string | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_wsAudioUrl, _setWsAudioUrl] = useState<string | null>(null);
	/** Локальное состояние воспроизведения (в onAudio вызывается setIsPlaying) */
	const [isPlaying, setIsPlaying] = useState(false);

	// Callbacks для HTTP режима: бэкенд сохраняет в историю (live_voice_service); уведомляем панель истории
	const handleComplete = useCallback((url: string) => {
		log.info('LiveVoiceWidget', 'Pipeline completed, audio URL:', url);
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent(LIVE_VOICE_HISTORY_UPDATED_EVENT));
		}
	}, []);

	const handleError = useCallback((err: Error) => {
		if (err.message.includes('404') || err.message.includes('not available')) {
			log.warn('LiveVoiceWidget', 'Live Voice API endpoint not available');
			return;
		}
		logUxError('live_voice', 'pipeline', err);
		handleAPIError(err);
	}, []);

	const {
		isRecording,
		level: audioLevel,
		startRecording,
		stopRecording,
		stage: pipelineStage,
		setStage: setPipelineStage,
		setProgress: setPipelineProgress,
		progress: pipelineProgress,
		transcription,
		aiResponse,
		audioUrl: _audioUrl,
		error,
		reset,
		audioChunksRef,
		stopPlayback: stopPlaybackFromHook,
		isPlaying: isPlayingFromHook,
	} = useUnifiedVoiceSession({
		onComplete: handleComplete,
		onError: handleError,
	});

	// WebSocket соединение (используем setPipelineStage и setPipelineProgress из useLiveVoice)
	const {
		isConnected,
		isActive,
		modelsReady,
		setActive: setWebSocketActive,
		sendAudio: sendAudioWebSocket,
		error: wsError,
	} = useLiveVoiceWebSocket({
		sessionId: sessionIdRef.current,
		onTranscription: (text) => {
			setWsTranscription(text);
			setPipelineStage('generating');
			setPipelineProgress(50);
			// ✅ Отправляем транскрипцию в систему обработки голосовых команд
			if (text) {
				emitVoiceTranscription(text);
			}
		},
		onResponse: (text) => {
			setWsAiResponse(text);
			setPipelineStage('synthesizing');
			setPipelineProgress(75);
		},
		onAudio: async (audioUrl) => {
			_setWsAudioUrl(audioUrl);
			setPipelineStage('playing');
			setPipelineProgress(100);

			// Останавливаем предыдущее аудио если есть
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}

			let playUrl: string;
			let revoke: () => void;
			try {
				const resolved = await resolveAudioUrlForPlayback(audioUrl);
				playUrl = resolved.playUrl;
				revoke = resolved.revoke;
			} catch (e: unknown) {
				const err = e instanceof Error ? e : new Error(String(e));
				log.error('LiveVoiceWidget', 'Failed to resolve audio URL', err);
				setPipelineStage('error');
				setIsPlaying(false);
				handleError(new Error('Не удалось воспроизвести аудио'));
				return;
			}

			const unregisterTts = registerTtsPlaying();
			const audio = new Audio(playUrl);
			audioRef.current = audio;

			const handleEnded = (): void => {
				revoke();
				unregisterTts();
				setPipelineStage('completed');
				setIsPlaying(false);
				handleComplete(audioUrl);
				audioRef.current = null;
			};

			const handlePlayError = (err: Error): void => {
				revoke();
				unregisterTts();
				if (err.name === 'AbortError') {
					log.info(
						'LiveVoiceWidget',
						'Audio playback aborted (component unmounted)'
					);
					return;
				}
				log.error('LiveVoiceWidget', 'Failed to play audio', err);
				setPipelineStage('error');
				setIsPlaying(false);
				handleError(new Error('Не удалось воспроизвести аудио'));
				audioRef.current = null;
			};

			audio.addEventListener('ended', handleEnded);
			audio.addEventListener('error', () =>
				handlePlayError(new Error('Audio playback error'))
			);

			audio
				.play()
				.then(() => {
					setIsPlaying(true);
				})
				.catch((err: unknown) => {
					const error = err instanceof Error ? err : new Error(String(err));
					handlePlayError(error);
				});
		},
		onError: (err) => {
			log.error('LiveVoiceWidget', 'WebSocket error', err);
			setPipelineStage('error');
			handleError(err);
		},
		onModelsReady: () => {
			log.info('LiveVoiceWidget', 'Models ready');
		},
		onInactive: () => {
			log.info('LiveVoiceWidget', 'Mode inactive');
		},
	});

	// Используем WebSocket данные если они есть, иначе HTTP
	const finalTranscription = wsTranscription || transcription;
	const finalAiResponse = wsAiResponse || aiResponse;
	// finalAudioUrl is reserved for future audio playback
	// const finalAudioUrl = wsAudioUrl || audioUrl;

	const handleToggleExpand = (): void => {
		setIsExpanded(!isExpanded);
	};

	const handleRecordingClick = async (): Promise<void> => {
		if (isRecording) {
			stopRecording();
		} else {
			interface WindowWithLiveVoice extends Window {
				__liveVoiceUseWebSocket?: boolean;
			}
			const windowWithLiveVoice = window as WindowWithLiveVoice;

			// Если WebSocket активен, используем его
			if (isActive && modelsReady && isConnected) {
				// Устанавливаем флаг для использования WebSocket
				windowWithLiveVoice.__liveVoiceUseWebSocket = true;
				await startRecording();
			} else if (!isConnected) {
				// WebSocket не подключен, используем HTTP режим
				windowWithLiveVoice.__liveVoiceUseWebSocket = false;
				await startRecording();
			} else if (!isActive) {
				// Режим выключен, но WebSocket подключен - используем HTTP режим
				windowWithLiveVoice.__liveVoiceUseWebSocket = false;
				await startRecording();
			} else {
				// HTTP режим по умолчанию
				windowWithLiveVoice.__liveVoiceUseWebSocket = false;
				await startRecording();
			}
		}
	};

	// Отправляем аудио через WebSocket когда запись остановлена
	useEffect(() => {
		if (
			!isRecording &&
			isActive &&
			modelsReady &&
			audioChunksRef &&
			audioChunksRef.current.length > 0
		) {
			const audioBlob = new Blob(audioChunksRef.current, {
				type: 'audio/webm',
			});
			sendAudioWebSocket(audioBlob);
			audioChunksRef.current = [];
			setPipelineStage('transcribing');
			setPipelineProgress(25);
			// Очищаем HTTP данные при использовании WebSocket
			setWsTranscription(null);
			setWsAiResponse(null);
			_setWsAudioUrl(null);
		}
	}, [
		isRecording,
		isActive,
		modelsReady,
		sendAudioWebSocket,
		setPipelineStage,
		setPipelineProgress,
		audioChunksRef,
	]);

	const handleToggleActive = (active: boolean): void => {
		setWebSocketActive(active);
	};

	// Keyboard shortcut: Cmd/Ctrl+Shift+V для переключения виджета
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent): void => {
			// Проверяем, что не в input поле
			const target = e.target as HTMLElement;
			const isInput =
				['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
				target.isContentEditable;

			if (isInput) {
				return;
			}

			// Cmd/Ctrl+Shift+V
			if (
				(e.metaKey || e.ctrlKey) &&
				e.shiftKey &&
				e.key.toLowerCase() === 'v'
			) {
				e.preventDefault();
				setIsExpanded((prev) => !prev);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return (): void => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	// Stop playback: unified hook + WebSocket audioRef
	const stopPlayback = useCallback((): void => {
		stopPlaybackFromHook();
		setIsPlaying(false);
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
			audioRef.current = null;
		}
		setPipelineStage('completed');
	}, [setPipelineStage, stopPlaybackFromHook]);

	// Очистка аудио при размонтировании компонента
	useEffect(() => {
		return (): void => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: draggable shell; inner minimized/expanded UIs expose proper controls
		<div
			ref={elementRef}
			className={`fixed select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
			onMouseDown={handleMouseDown}
			// Динамическое позиционирование необходимо для перетаскивания виджета
			style={{
				left: `${dragPosition.x}px`,
				top: `${dragPosition.y}px`,
				userSelect: 'none',
				zIndex: DESKTOP_Z_INDEX.OVERLAY,
			}}
		>
			<AnimatePresence mode="wait">
				{!isExpanded ? (
					<WidgetMinimized
						key="minimized"
						isRecording={isRecording}
						onClick={handleToggleExpand}
						onMouseDown={handleMouseDown}
						isDragging={isDragging}
						aria-expanded={false}
					/>
				) : (
					<WidgetExpanded
						key="expanded"
						isRecording={isRecording}
						audioLevel={audioLevel}
						pipelineStage={pipelineStage}
						pipelineProgress={pipelineProgress}
						transcription={finalTranscription}
						aiResponse={finalAiResponse}
						error={error || wsError}
						isActive={isActive}
						modelsReady={modelsReady}
						isConnected={isConnected}
						isPlaying={isPlaying || isPlayingFromHook}
						onClose={handleToggleExpand}
						onRecordingClick={handleRecordingClick}
						onReset={reset}
						onToggleActive={handleToggleActive}
						onStopPlayback={stopPlayback}
						onMouseDown={handleMouseDown}
					/>
				)}
			</AnimatePresence>
		</div>
	);
};

export default LiveVoiceWidget;
