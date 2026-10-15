/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Voice **output** for EWA companion: optional auto-TTS of assistant replies via voice-gateway synthesize.
 *
 * Invariants:
 * - Preference is per-principal in ``localStorage`` (`ewa_companion_voice_out.v1`).
 * - Uses ``resolveAudioUrlForPlayback`` + ``registerTtsPlaying``; revokes blob URLs on end/error/stop.
 * - Detach ``HTMLAudioElement`` handlers before teardown — clearing ``src`` after ``ended`` would re-fire ``error`` and spam toasts.
 * - Skip auto-speak when the same plain-text reply was spoken within ~60s (``force`` bypasses).
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/desktop-ai-chat/api/desktopChatClient.ts
 */
import { companionReplyToTtsPlainText } from '@/features/ewa/companionTtsPlainText';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { ewaPersonaSileroVoice } from '@/features/ewa/ewaCompanionSileroVoice';
import { voiceGatewaySynthesize } from '@/features/desktop-ai-chat/api/desktopChatClient';
import { registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';
import { useCallback, useEffect, useRef, useState } from 'react';

export const EWA_COMPANION_VOICE_OUT_PREF_KEY =
	'ewa_companion_voice_out.v1' as const;

export type EwaCompanionVoiceOutputState = 'idle' | 'synthesizing' | 'playing';

function prefStorageKey(principalId: string): string {
	return `${EWA_COMPANION_VOICE_OUT_PREF_KEY}:${principalId.trim() || 'default'}`;
}

export type EwaCompanionVoiceOutputErrorCode =
	| 'synthesize_failed'
	| 'autoplay_blocked'
	| 'empty_text';

export function readEwaCompanionVoiceOutPref(principalId: string): boolean {
	try {
		const raw = localStorage.getItem(prefStorageKey(principalId));
		// Default OFF: voice replies add latency; user opts in via the speaker toggle.
		if (raw === null) return false;
		return raw === '1' || raw === 'true';
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_voice_out_pref_read',
			'localStorage voice-out preference read failed',
			err
		);
		return false;
	}
}

export function saveEwaCompanionVoiceOutPref(
	principalId: string,
	enabled: boolean
): void {
	try {
		localStorage.setItem(prefStorageKey(principalId), enabled ? '1' : '0');
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_voice_out_pref_write',
			'localStorage voice-out preference write failed',
			err
		);
	}
}

export function useEwaCompanionVoiceOutput(
	personaId: string,
	principalId: string,
	options?: {
		featureEnabled?: boolean;
		onError?: (code: EwaCompanionVoiceOutputErrorCode) => void;
	}
): {
	enabled: boolean;
	setEnabled: (next: boolean) => void;
	state: EwaCompanionVoiceOutputState;
	isBusy: boolean;
	speakAssistantReply: (
		markdownReply: string,
		speakOptions?: { force?: boolean }
	) => Promise<boolean>;
	stopSpeaking: () => void;
} {
	const featureEnabled = options?.featureEnabled !== false;
	const [enabled, setEnabledState] = useState(() =>
		featureEnabled ? readEwaCompanionVoiceOutPref(principalId) : false
	);
	const [state, setState] = useState<EwaCompanionVoiceOutputState>('idle');
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const unregisterTtsRef = useRef<(() => void) | null>(null);
	const revokePlaybackRef = useRef<(() => void) | null>(null);
	const speakEpochRef = useRef(0);
	const lastAutoSpokenPlainRef = useRef('');
	const lastAutoSpokenAtRef = useRef(0);

	const detachAudioElement = useCallback((audio: HTMLAudioElement | null) => {
		if (!audio) return;
		audio.onended = null;
		audio.onerror = null;
		audio.pause();
	}, []);

	const cleanupPlayback = useCallback(() => {
		unregisterTtsRef.current?.();
		unregisterTtsRef.current = null;
		revokePlaybackRef.current?.();
		revokePlaybackRef.current = null;
		detachAudioElement(audioRef.current);
		audioRef.current = null;
	}, [detachAudioElement]);

	useEffect(() => {
		return () => {
			cleanupPlayback();
		};
	}, [cleanupPlayback]);

	useEffect(() => {
		if (!featureEnabled) {
			cleanupPlayback();
			setEnabledState(false);
			setState('idle');
		}
	}, [cleanupPlayback, featureEnabled]);

	const setEnabled = useCallback(
		(next: boolean) => {
			if (!featureEnabled) return;
			setEnabledState(next);
			saveEwaCompanionVoiceOutPref(principalId, next);
			if (!next) {
				cleanupPlayback();
				setState('idle');
			}
		},
		[cleanupPlayback, featureEnabled, principalId]
	);

	const stopSpeaking = useCallback(() => {
		speakEpochRef.current += 1;
		cleanupPlayback();
		setState('idle');
	}, [cleanupPlayback]);

	const onError = options?.onError;

	const speakAssistantReply = useCallback(
		async (
			markdownReply: string,
			speakOptions?: { force?: boolean }
		): Promise<boolean> => {
			if (!featureEnabled) return false;
			if (!enabled && !speakOptions?.force) return false;
			const plain = companionReplyToTtsPlainText(markdownReply);
			if (!plain) {
				onError?.('empty_text');
				return false;
			}

			const now = Date.now();
			if (
				!speakOptions?.force &&
				plain === lastAutoSpokenPlainRef.current &&
				now - lastAutoSpokenAtRef.current < 60_000
			) {
				return false;
			}

			const epoch = speakEpochRef.current + 1;
			speakEpochRef.current = epoch;
			cleanupPlayback();
			setState('synthesizing');

			try {
				const url = await voiceGatewaySynthesize(plain, {
					voice: ewaPersonaSileroVoice(personaId),
					speed: 1.0,
					maxChars: 1200,
				});
				if (speakEpochRef.current !== epoch) return false;

				const { playUrl, revoke } = await resolveAudioUrlForPlayback(url);
				if (speakEpochRef.current !== epoch) {
					revoke();
					return false;
				}

				revokePlaybackRef.current = revoke;
				const audio = new Audio(playUrl);
				audioRef.current = audio;
				unregisterTtsRef.current = registerTtsPlaying();

				let playbackEndedNaturally = false;

				const finish = (options?: { reportPlaybackError?: boolean }) => {
					if (speakEpochRef.current !== epoch) return;
					if (options?.reportPlaybackError && !playbackEndedNaturally) {
						onError?.('synthesize_failed');
					}
					detachAudioElement(audioRef.current);
					audioRef.current = null;
					unregisterTtsRef.current?.();
					unregisterTtsRef.current = null;
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
					setState('idle');
				};

				audio.onended = () => {
					playbackEndedNaturally = true;
					if (speakEpochRef.current === epoch) {
						lastAutoSpokenPlainRef.current = plain;
						lastAutoSpokenAtRef.current = Date.now();
					}
					finish();
				};
				audio.onerror = () => {
					finish({ reportPlaybackError: true });
				};

				setState('playing');
				await audio.play();
				return true;
			} catch (e: unknown) {
				if (speakEpochRef.current === epoch) {
					cleanupPlayback();
					setState('idle');
					if (e instanceof DOMException && e.name === 'NotAllowedError') {
						onError?.('autoplay_blocked');
					} else {
						onError?.('synthesize_failed');
					}
				}
				return false;
			}
		},
		[
			cleanupPlayback,
			detachAudioElement,
			enabled,
			featureEnabled,
			onError,
			personaId,
		]
	);

	return {
		enabled,
		setEnabled,
		state,
		isBusy: state !== 'idle',
		speakAssistantReply,
		stopSpeaking,
	};
}
