/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Live Voice pipeline + opaque right-rail dock hosting WidgetExpanded.
 *
 * Invariants:
 * - Dock shell uses LIVE_VOICE_DOCK_SHELL (opaque rgb /1) — wallpaper must not bleed through.
 * - Panel mounts only when showLiveVoicePanel; pipeline when panel or live-voice mode.
 *
 * Related:
 * - liveVoiceLayoutTokens.ts, WidgetExpanded.tsx, VOICE-CONTROL-STUDIO.md
 */

import { useLiveVoiceWebSocket } from '@/components/LiveVoiceWidget/hooks/useLiveVoiceWebSocket';
import { LIVE_VOICE_DOCK_SHELL } from '@/components/LiveVoiceWidget/liveVoiceLayoutTokens';
import { WidgetExpanded } from '@/components/LiveVoiceWidget/WidgetExpanded';
import { emitVoiceTranscription } from '@/hooks/useVoiceCommands';
import { log } from '@/utils/logger';
import { useUnifiedVoiceSession } from '@/voice-core';
import { registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';
import { AnimatePresence, m } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopWindowPortalStackBase } from '../../context/DesktopWindowPortalStackContext';
import { useDesktopVoice } from '../../context/DesktopVoiceContext';
import { getDesktopPortalShellProps } from '../../utils/desktopUi';

/**
 * Тяжёлые хуки (WebSocket, сессия) только когда нужен Live Voice или открыта панель.
 * Раньше пайплайн монтировался всегда на десктопе и держал хуки даже в idle.
 */
export function LiveVoiceDesktopPipeline(): React.ReactElement | null {
	const desktopVoice = useDesktopVoice();
	const needPipeline =
		desktopVoice.showLiveVoicePanel || desktopVoice.activeMode === 'live-voice';
	if (!needPipeline) {
		return null;
	}
	return <LiveVoiceDesktopPipelineInner />;
}

function LiveVoiceDesktopPipelineInner(): React.ReactElement | null {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'liveVoiceDesktop' });
	const portalStackBase = useDesktopWindowPortalStackBase();
	const desktopVoice = useDesktopVoice();
	const sessionIdRef = useRef(`live-voice-desktop-${Date.now()}`);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const prevActiveModeRef = useRef(desktopVoice.activeMode);

	const [wsTranscription, setWsTranscription] = useState<string | null>(null);
	const [wsAiResponse, setWsAiResponse] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);

	const handleComplete = useCallback(
		(_url: string) => {
			desktopVoice.setLiveVoiceStatus({ lastSuccess: 'success' });
		},
		[desktopVoice]
	);

	const handleError = useCallback(
		(err: Error) => {
			if (
				!err.message.includes('404') &&
				!err.message.includes('not available')
			) {
				log.error('LiveVoiceDesktopPipeline', err.message);
			}
			desktopVoice.setLiveVoiceStatus({ lastSuccess: 'error' });
		},
		[desktopVoice]
	);

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
		error,
		reset,
		audioChunksRef,
		stopPlayback: stopPlaybackFromHook,
		isPlaying: isPlayingFromHook,
	} = useUnifiedVoiceSession({
		onComplete: handleComplete,
		onError: handleError,
	});

	const {
		isConnected,
		isActive,
		modelsReady,
		connect,
		disconnect,
		setActive: setWebSocketActive,
		sendAudio: sendAudioWebSocket,
		error: wsError,
	} = useLiveVoiceWebSocket({
		sessionId: sessionIdRef.current,
		autoConnect: false,
		onTranscription: (text) => {
			setWsTranscription(text);
			setPipelineStage('generating');
			setPipelineProgress(50);
			if (text) emitVoiceTranscription(text);
		},
		onResponse: (text) => {
			setWsAiResponse(text);
			setPipelineStage('synthesizing');
			setPipelineProgress(75);
		},
		onAudio: async (audioUrl) => {
			setPipelineStage('playing');
			setPipelineProgress(100);
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
				log.error(
					'LiveVoiceDesktopPipeline',
					'Failed to resolve audio URL',
					err
				);
				setPipelineStage('error');
				setIsPlaying(false);
				handleError(new Error(t('audioPlaybackFailed')));
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
				if (err.name !== 'AbortError')
					log.error('LiveVoiceDesktopPipeline', 'Play error', err);
				setPipelineStage('error');
				setIsPlaying(false);
				handleError(err);
				audioRef.current = null;
			};
			audio.addEventListener('ended', handleEnded);
			audio.addEventListener('error', () =>
				handlePlayError(new Error('Audio playback error'))
			);
			audio
				.play()
				.then(() => setIsPlaying(true))
				.catch(handlePlayError);
		},
		onError: (err) => {
			setPipelineStage('error');
			handleError(err);
		},
		onModelsReady: () => {},
		onInactive: () => {},
	});

	const finalTranscription = wsTranscription ?? transcription;
	const finalAiResponse = wsAiResponse ?? aiResponse;
	const isPlayingState = isPlayingFromHook || isPlaying;

	// Индикатор в виджете: достаточно сокета; modelsReady может прийти позже — запись всё равно стартует с HTTP fallback
	useEffect(() => {
		desktopVoice.setLiveVoiceStatus({
			serviceAvailable: isConnected,
		});
	}, [desktopVoice, isConnected]);

	useEffect(() => {
		const prev = prevActiveModeRef.current;
		prevActiveModeRef.current = desktopVoice.activeMode;

		if (desktopVoice.activeMode !== 'live-voice') {
			if (isRecording) stopRecording();
			if (prev === 'live-voice') {
				(
					window as unknown as { __liveVoiceUseWebSocket?: boolean }
				).__liveVoiceUseWebSocket = false;
				setWebSocketActive(false);
				disconnect();
			}
			return;
		}

		if (prev !== 'live-voice') {
			(
				window as unknown as { __liveVoiceUseWebSocket?: boolean }
			).__liveVoiceUseWebSocket = true;
			connect();
			setWebSocketActive(true);
			void startRecording();
		}
	}, [
		desktopVoice.activeMode,
		isRecording,
		startRecording,
		stopRecording,
		connect,
		disconnect,
		setWebSocketActive,
	]);

	useEffect(() => {
		if (
			!isRecording &&
			isActive &&
			modelsReady &&
			audioChunksRef?.current?.length
		) {
			const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
			sendAudioWebSocket(blob);
			audioChunksRef.current = [];
			setPipelineStage('transcribing');
			setPipelineProgress(25);
			setWsTranscription(null);
			setWsAiResponse(null);
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

	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);

	const handleRecordingClick = useCallback(async () => {
		if (isRecording) {
			stopRecording();
		} else {
			if (isActive && !isConnected) {
				connect();
			}
			(
				window as unknown as { __liveVoiceUseWebSocket?: boolean }
			).__liveVoiceUseWebSocket = isActive && modelsReady && isConnected;
			await startRecording();
		}
	}, [
		isRecording,
		stopRecording,
		startRecording,
		isActive,
		modelsReady,
		isConnected,
		connect,
	]);

	const stopPlayback = useCallback(() => {
		stopPlaybackFromHook();
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
			audioRef.current = null;
		}
		setPipelineStage('completed');
		setIsPlaying(false);
	}, [setPipelineStage, stopPlaybackFromHook]);

	const handleClosePanel = useCallback(() => {
		desktopVoice.setShowLiveVoicePanel(false);
	}, [desktopVoice]);

	const handleToggleActive = useCallback(
		(active: boolean) => {
			setWebSocketActive(active);
			if (active) {
				desktopVoice.enableLiveVoice();
			} else if (desktopVoice.activeMode === 'live-voice') {
				desktopVoice.setActiveMode(null);
			}
		},
		[desktopVoice, setWebSocketActive]
	);

	const dockShellStyle = useMemo(() => {
		const { style: portalStyle } = getDesktopPortalShellProps();
		return {
			...portalStyle,
			zIndex: portalStackBase,
		} as React.CSSProperties;
	}, [portalStackBase]);

	if (!desktopVoice.showLiveVoicePanel) {
		return null;
	}

	return (
		<AnimatePresence>
			<m.div
				className={LIVE_VOICE_DOCK_SHELL}
				style={dockShellStyle}
				initial={{ x: '100%' }}
				animate={{ x: 0 }}
				exit={{ x: '100%' }}
				transition={{ type: 'spring', damping: 28, stiffness: 220 }}
				role="region"
				aria-label={t('panelAria')}
			>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-[env(safe-area-inset-right,0px)]">
					<WidgetExpanded
						chrome="dock"
						isRecording={isRecording}
						audioLevel={audioLevel}
						pipelineStage={pipelineStage}
						pipelineProgress={pipelineProgress}
						transcription={finalTranscription}
						aiResponse={finalAiResponse}
						error={error ?? wsError ?? undefined}
						isActive={isActive}
						modelsReady={modelsReady}
						isConnected={isConnected}
						isPlaying={isPlayingState}
						onClose={handleClosePanel}
						onRecordingClick={handleRecordingClick}
						onReset={reset}
						onToggleActive={handleToggleActive}
						onStopPlayback={stopPlayback}
					/>
				</div>
			</m.div>
		</AnimatePresence>
	);
}
