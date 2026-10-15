/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * STT mic + TTS playback wiring for Desktop AI Chat compose (Silero via voice gateway).
 *
 * Invariants:
 * - Chat switch stops in-flight mic/TTS; skipTtsRef honors Stop mid-stream.
 *
 * Related:
 * - useDesktopAiChatAppCompose.ts, api/desktopChatClient voiceGatewaySynthesize
 */
import * as React from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { useMicRecorder } from '@/voice-core';

import { voiceGatewaySynthesize } from '../api/desktopChatClient';
import { desktopHeroSileroVoice } from '../desktopAiHeroes';

export function useDesktopAiChatAppVoice({
	t,
	activeId,
	activeHeroId,
	voiceOut,
	voiceAllowed,
	setTtsBusy,
}: {
	t: TFunction<'desktopAiChat'>;
	activeId: string | null;
	activeHeroId: string | null;
	voiceOut: boolean;
	voiceAllowed: boolean;
	setTtsBusy: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const audioRef = React.useRef<HTMLAudioElement | null>(null);
	const skipTtsRef = React.useRef(false);
	const sttCancelNextBlobRef = React.useRef(false);

	const sttMic = useMicRecorder({
		onError: (err) => {
			toast.error(err.message || t('micPermissionDenied'));
		},
	});
	const sttMicRef = React.useRef(sttMic);
	sttMicRef.current = sttMic;
	const sttLevelMeterRef = React.useRef<HTMLDivElement>(null);

	React.useLayoutEffect(() => {
		const el = sttLevelMeterRef.current;
		if (!el || !sttMic.isRecording) return;
		el.style.setProperty(
			'--stt-level',
			`${Math.min(100, (sttMic.level / 255) * 100)}%`
		);
	}, [sttMic.isRecording, sttMic.level]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: stop mic/TTS on chat switch
	React.useEffect(() => {
		const mic = sttMicRef.current;
		if (mic.isRecording) {
			sttCancelNextBlobRef.current = true;
			void mic.stop().catch(() => {});
		}
		const a = audioRef.current;
		if (a) {
			a.pause();
			a.removeAttribute('src');
			a.load();
		}
		setTtsBusy(false);
	}, [activeId, setTtsBusy]);

	const playTts = React.useCallback(
		async (text: string) => {
			if (!voiceOut || !voiceAllowed || !text.trim()) return;
			if (skipTtsRef.current) {
				skipTtsRef.current = false;
				return;
			}
			setTtsBusy(true);
			try {
				const url = await voiceGatewaySynthesize(text, {
					voice: desktopHeroSileroVoice(activeHeroId),
				});
				if (!audioRef.current) audioRef.current = new Audio();
				audioRef.current.src = url;
				await audioRef.current.play();
			} catch {
				toast.error(t('voiceOutFailed'));
			} finally {
				setTtsBusy(false);
			}
		},
		[voiceOut, voiceAllowed, activeHeroId, t, setTtsBusy]
	);

	return {
		sttMic,
		sttLevelMeterRef,
		sttCancelNextBlobRef,
		skipTtsRef,
		playTts,
	};
}
