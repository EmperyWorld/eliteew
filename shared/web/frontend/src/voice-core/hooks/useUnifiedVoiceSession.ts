/**
 * Unified voice session hook: record -> transcribe -> LLM -> TTS -> play.
 * Uses shared mic recorder, voice settings, and playback; calls canonical process endpoint.
 */

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { liveVoiceService } from '../../services/liveVoiceService';
import { useAudioPlayback } from './useAudioPlayback';
import { useMicRecorder } from './useMicRecorder';
import { useVoiceSettingsOptional } from '../VoiceSettingsContext';
import { DEFAULT_VOICE_SETTINGS, type PipelineStage } from '../types';

export interface UseUnifiedVoiceSessionOptions {
	onComplete?: (audioUrl: string) => void;
	onError?: (error: Error) => void;
}

export interface UseUnifiedVoiceSessionReturn {
	isRecording: boolean;
	level: number;
	durationSec: number;
	stage: PipelineStage;
	progress: number;
	transcription: string | null;
	aiResponse: string | null;
	audioUrl: string | null;
	error: Error | null;
	startRecording: () => Promise<void>;
	stopRecording: () => Promise<void>;
	play: (url: string) => Promise<void>;
	stopPlayback: () => void;
	replay: () => Promise<void>;
	reset: () => void;
	isPlaying: boolean;
	/** Allow external control (e.g. WebSocket) to drive stage/progress */
	setStage: (stage: PipelineStage) => void;
	setProgress: (progress: number) => void;
	/** Ref to current recording chunks (e.g. for WebSocket send). */
	audioChunksRef: React.MutableRefObject<Blob[]>;
}

export function useUnifiedVoiceSession(
	options: UseUnifiedVoiceSessionOptions = {}
): UseUnifiedVoiceSessionReturn {
	const { onComplete, onError } = options;
	const voiceContext = useVoiceSettingsOptional();
	const settingsRef = useRef(voiceContext?.settings ?? DEFAULT_VOICE_SETTINGS);
	useEffect(() => {
		settingsRef.current = voiceContext?.settings ?? DEFAULT_VOICE_SETTINGS;
	}, [voiceContext?.settings]);

	const [stage, setStage] = useState<PipelineStage>('idle');
	const [progress, setProgress] = useState(0);
	const [transcription, setTranscription] = useState<string | null>(null);
	const [aiResponse, setAiResponse] = useState<string | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [error, setError] = useState<Error | null>(null);

	const playback = useAudioPlayback();
	const mic = useMicRecorder({
		onStop: async (blob): Promise<void> => {
			if (!blob.size) return;
			settingsRef.current = voiceContext?.settings ?? DEFAULT_VOICE_SETTINGS;
			const s = settingsRef.current;
			setStage('transcribing');
			setProgress(25);
			setError(null);
			try {
				const result = await liveVoiceService.processVoice(
					new File([blob], 'recording.webm', { type: blob.type }),
					`session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
					{
						language: s.language,
						whisperModel: s.whisperModel,
						llamaModel: s.llamaModel,
						ttsVoice: s.voice,
						enableArlekina: s.enableArlekina,
					}
				);
				setTranscription(result.transcription);
				setStage('generating');
				setProgress(50);
				setAiResponse(result.llm_response);
				setStage('synthesizing');
				setProgress(75);
				setAudioUrl(result.audio_url);
				setStage('playing');
				setProgress(100);
				if (result.audio_url) {
					await playback.play(result.audio_url);
					onComplete?.(result.audio_url);
				}
				setStage('completed');
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err));
				setError(e);
				setStage('error');
				onError?.(e);
			}
		},
		onError: (e) => {
			setError(e);
			setStage('error');
			onError?.(e);
		},
	});

	const reset = useCallback((): void => {
		playback.stop();
		setStage('idle');
		setProgress(0);
		setTranscription(null);
		setAiResponse(null);
		setAudioUrl(null);
		setError(null);
	}, [playback]);

	const stopRecording = useCallback(async (): Promise<void> => {
		await mic.stop();
	}, [mic]);

	return {
		isRecording: mic.isRecording,
		level: mic.level,
		durationSec: mic.durationSec,
		stage,
		progress,
		transcription,
		aiResponse,
		audioUrl: playback.currentUrl ?? audioUrl,
		error: error ?? mic.error,
		startRecording: mic.start,
		stopRecording,
		play: playback.play,
		stopPlayback: playback.stop,
		replay: playback.replay,
		reset,
		isPlaying: playback.isPlaying,
		setStage,
		setProgress,
		audioChunksRef: mic.chunksRef,
	};
}
