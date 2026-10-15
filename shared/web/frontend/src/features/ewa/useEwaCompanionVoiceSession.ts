/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion «голосовой сеанс» (MVP): toggle mic без удержания, автоотправка реплики в чат и озвучка ответа.
 *
 * Invariants:
 * - В сеансе принудительно включается voice-out; при выходе восстанавливается прежняя настройка пользователя.
 * - Не отправляет пустую транскрипцию; не стартует запись во время pending/transcribing/TTS (кроме stop).
 *
 * Related:
 * - src/features/ewa/EwaCompanionVoiceSessionBar.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import type { EwaCompanionVoiceInputState } from '@/features/ewa/useEwaCompanionVoiceInput';
import type { EwaCompanionVoiceOutputState } from '@/features/ewa/useEwaCompanionVoiceOutput';
import { useCallback, useEffect, useRef, useState } from 'react';

export type EwaCompanionVoiceSessionPhase =
	| 'ready'
	| 'listening'
	| 'recognizing'
	| 'thinking'
	| 'speaking';

export function deriveEwaCompanionVoiceSessionPhase(
	active: boolean,
	voiceInputState: EwaCompanionVoiceInputState,
	pending: boolean,
	voiceOutputState: EwaCompanionVoiceOutputState
): EwaCompanionVoiceSessionPhase | null {
	if (!active) return null;
	if (voiceInputState === 'recording') return 'listening';
	if (voiceInputState === 'transcribing') return 'recognizing';
	if (voiceOutputState === 'playing' || voiceOutputState === 'synthesizing') {
		return 'speaking';
	}
	if (pending) return 'thinking';
	return 'ready';
}

export function useEwaCompanionVoiceSession(options: {
	featureEnabled: boolean;
	pending: boolean;
	voiceInputState: EwaCompanionVoiceInputState;
	voiceOutputState: EwaCompanionVoiceOutputState;
	voiceOutputBusy: boolean;
	voiceOutEnabled: boolean;
	setVoiceOutEnabled: (next: boolean) => void;
	startRecording: () => Promise<void>;
	stopRecordingAndTranscribe: () => Promise<string | null>;
	stopSpeaking: () => void;
	onSendUtterance: (text: string) => void | Promise<void>;
	onBeforeForceSpeak: () => void;
}): {
	active: boolean;
	phase: EwaCompanionVoiceSessionPhase | null;
	enterSession: () => void;
	exitSession: () => void;
	handleSessionMicClick: () => Promise<void>;
	sessionMicDisabled: boolean;
} {
	const {
		featureEnabled,
		pending,
		voiceInputState,
		voiceOutputState,
		voiceOutputBusy,
		voiceOutEnabled,
		setVoiceOutEnabled,
		startRecording,
		stopRecordingAndTranscribe,
		stopSpeaking,
		onSendUtterance,
		onBeforeForceSpeak,
	} = options;

	const [active, setActive] = useState(false);
	const activeRef = useRef(false);
	const voiceOutBeforeSessionRef = useRef(voiceOutEnabled);
	activeRef.current = active;

	const phase = deriveEwaCompanionVoiceSessionPhase(
		active,
		voiceInputState,
		pending,
		voiceOutputState
	);

	const exitSession = useCallback(() => {
		stopSpeaking();
		setActive(false);
		setVoiceOutEnabled(voiceOutBeforeSessionRef.current);
	}, [setVoiceOutEnabled, stopSpeaking]);

	useEffect(() => {
		if (!featureEnabled && active) {
			exitSession();
		}
	}, [active, exitSession, featureEnabled]);

	useEffect(() => {
		return () => {
			if (!activeRef.current) return;
			stopSpeaking();
			setVoiceOutEnabled(voiceOutBeforeSessionRef.current);
			setActive(false);
		};
	}, [setVoiceOutEnabled, stopSpeaking]);

	const enterSession = useCallback(() => {
		if (!featureEnabled) return;
		voiceOutBeforeSessionRef.current = voiceOutEnabled;
		setVoiceOutEnabled(true);
		setActive(true);
	}, [featureEnabled, setVoiceOutEnabled, voiceOutEnabled]);

	const sessionMicDisabled =
		!featureEnabled ||
		!active ||
		pending ||
		voiceInputState === 'transcribing' ||
		(voiceOutputBusy && voiceInputState !== 'recording');

	const handleSessionMicClick = useCallback(async () => {
		if (!featureEnabled || !active) return;
		if (sessionMicDisabled && voiceInputState !== 'recording') return;

		if (voiceInputState === 'recording') {
			const text = await stopRecordingAndTranscribe();
			if (text) {
				onBeforeForceSpeak();
				await onSendUtterance(text);
			}
			return;
		}

		stopSpeaking();
		await startRecording();
	}, [
		active,
		featureEnabled,
		onBeforeForceSpeak,
		onSendUtterance,
		sessionMicDisabled,
		startRecording,
		stopRecordingAndTranscribe,
		stopSpeaking,
		voiceInputState,
	]);

	return {
		active,
		phase,
		enterSession,
		exitSession,
		handleSessionMicClick,
		sessionMicDisabled,
	};
}
