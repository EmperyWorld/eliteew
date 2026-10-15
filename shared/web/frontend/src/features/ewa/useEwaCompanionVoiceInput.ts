/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Minimal mic capture for the EWA companion composer: record via MediaRecorder, transcribe through
 * ``POST /api/v1/voice-gateway/transcribe`` (same contract as desktop AI chat).
 *
 * Invariants:
 * - Registers ``registerMicActive`` while recording; always unregisters on stop/error/unmount.
 * - ``cleanupStream`` runs in ``MediaRecorder.onstop`` so audio chunks are not cleared early.
 * - Does not auto-send chat — caller appends transcript to the draft.
 *
 * Related:
 * - src/features/desktop-ai-chat/api/desktopChatClient.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import { voiceGatewayTranscribe } from '@/features/desktop-ai-chat/api/desktopChatClient';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerMicActive } from '@/voice-core/micActive';

export type EwaCompanionVoiceInputState = 'idle' | 'recording' | 'transcribing';

export function useEwaCompanionVoiceInput(featureEnabled = true): {
	state: EwaCompanionVoiceInputState;
	error: string | null;
	isBusy: boolean;
	startRecording: () => Promise<void>;
	stopRecordingAndTranscribe: () => Promise<string | null>;
	clearError: () => void;
} {
	const [state, setState] = useState<EwaCompanionVoiceInputState>('idle');
	const [error, setError] = useState<string | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const unregisterMicRef = useRef<(() => void) | null>(null);

	const stateRef = useRef<EwaCompanionVoiceInputState>('idle');
	stateRef.current = state;

	const cleanupStream = useCallback(() => {
		unregisterMicRef.current?.();
		unregisterMicRef.current = null;
		for (const track of streamRef.current?.getTracks() ?? []) {
			track.stop();
		}
		streamRef.current = null;
		mediaRecorderRef.current = null;
		audioChunksRef.current = [];
	}, []);

	useEffect(() => {
		return () => {
			cleanupStream();
		};
	}, [cleanupStream]);

	const startRecording = useCallback(async () => {
		if (!featureEnabled) return;
		if (stateRef.current !== 'idle') return;
		setError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			audioChunksRef.current = [];
			const recorder = new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunksRef.current.push(event.data);
			};
			recorder.start(250);
			unregisterMicRef.current = registerMicActive();
			setState('recording');
		} catch (e: unknown) {
			cleanupStream();
			const msg =
				e instanceof DOMException && e.name === 'NotAllowedError'
					? 'mic_permission_denied'
					: 'mic_start_failed';
			setError(msg);
			setState('idle');
		}
	}, [cleanupStream, featureEnabled]);

	const stopRecordingAndTranscribe = useCallback(async (): Promise<
		string | null
	> => {
		if (stateRef.current !== 'recording') return null;
		const recorder = mediaRecorderRef.current;
		if (!recorder) {
			cleanupStream();
			setState('idle');
			return null;
		}

		setState('transcribing');
		setError(null);

		const blob = await new Promise<Blob | null>((resolve) => {
			const mimeType = recorder.mimeType || 'audio/webm';
			recorder.onstop = () => {
				const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
				cleanupStream();
				resolve(audioBlob.size > 0 ? audioBlob : null);
			};
			try {
				recorder.stop();
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_voice_input_recorder_stop',
					'MediaRecorder.stop failed',
					err
				);
				cleanupStream();
				resolve(null);
			}
		});

		if (!blob) {
			setError('mic_empty_recording');
			setState('idle');
			return null;
		}

		try {
			const file = new File([blob], 'ewa-companion.webm', {
				type: blob.type || 'audio/webm',
			});
			const text = (await voiceGatewayTranscribe(file)).trim();
			if (!text) {
				setError('mic_empty_transcript');
				setState('idle');
				return null;
			}
			setState('idle');
			return text;
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_voice_input_transcribe',
				'voice-gateway transcribe failed',
				err
			);
			setError('mic_transcribe_failed');
			setState('idle');
			return null;
		}
	}, [cleanupStream]);

	const clearError = useCallback(() => setError(null), []);

	return {
		state,
		error,
		isBusy: state !== 'idle',
		startRecording,
		stopRecordingAndTranscribe,
		clearError,
	};
}
