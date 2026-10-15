/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mic record + transcribe for the doc-editor AI composer.
 *
 * Invariants:
 * - Voice errors are mapped; long backend traces never reach the status line.
 *
 * Related:
 * - aiAssistantErrorMappers.ts, useAIAssistantCompose.ts
 */

import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import type { TFunction } from 'i18next';
import { transcribe, useMicRecorder } from '@/voice-core';
import { mapMicAccessError } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantErrorMappers';

type UseAIAssistantVoiceArgs = {
	t: TFunction<'docEditorPanels'>;
	isStreaming: boolean;
	setPrompt: Dispatch<SetStateAction<string>>;
	success: (title: string, body: string) => void;
};

export function useAIAssistantVoice({
	t,
	isStreaming,
	setPrompt,
	success,
}: UseAIAssistantVoiceArgs) {
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [voiceError, setVoiceError] = useState<string | null>(null);
	const voiceMeterRef = useRef<HTMLDivElement>(null);

	const {
		isRecording,
		level: micLevel,
		durationSec,
		start: startMic,
		stop: stopMic,
		error: micError,
	} = useMicRecorder();

	const formatVoiceDuration = (seconds: number): string => {
		const totalSeconds = Math.max(0, Math.floor(seconds));
		const minutes = Math.floor(totalSeconds / 60)
			.toString()
			.padStart(2, '0');
		const remainingSeconds = (totalSeconds % 60).toString().padStart(2, '0');
		return `${minutes}:${remainingSeconds}`;
	};

	const handleVoiceToggle = async (): Promise<void> => {
		setVoiceError(null);
		if (isStreaming || isTranscribing) {
			return;
		}

		if (isRecording) {
			const blob = await stopMic();
			if (!blob) {
				return;
			}

			setIsTranscribing(true);
			try {
				const file = new File([blob], 'doc-editor-ai.webm', {
					type: blob.type || 'audio/webm',
				});
				const result = await transcribe(file, { language: 'ru' });
				const text = (result.text ?? '').trim();
				if (!text) {
					setVoiceError(t('ai.voiceErrors.emptyTranscript'));
					return;
				}

				setPrompt((currentPrompt) =>
					currentPrompt ? `${currentPrompt}\n${text}` : text
				);
				success(t('ai.toast.voiceAddedTitle'), t('ai.toast.voiceAddedBody'));
			} catch (error: unknown) {
				const detail =
					error &&
					typeof error === 'object' &&
					'response' in error &&
					error.response &&
					typeof error.response === 'object' &&
					'data' in error.response &&
					error.response.data &&
					typeof error.response.data === 'object' &&
					'detail' in error.response.data
						? String(
								(error.response as { data: { detail?: string } }).data.detail
							)
						: error instanceof Error
							? error.message
							: t('ai.voiceErrors.transcribeFailed');

				const safe =
					detail.length > 100 || /Traceback|File "/i.test(detail)
						? t('ai.voiceErrors.transcribeFailed')
						: detail;
				setVoiceError(safe);
			} finally {
				setIsTranscribing(false);
			}

			return;
		}

		try {
			await startMic();
		} catch (err) {
			setVoiceError(mapMicAccessError(err, t));
		}
	};

	const voiceBusy = isRecording || isTranscribing;
	const micErrorDisplay = micError ? mapMicAccessError(micError, t) : null;
	const voiceStatusText = voiceError
		? voiceError
		: micErrorDisplay
			? micErrorDisplay
			: isTranscribing
				? t('ai.voice.statusTranscribing')
				: isRecording
					? t('ai.voice.statusRecording', {
							time: formatVoiceDuration(durationSec),
						})
					: t('ai.voice.statusIdle');
	const voiceStatusTone =
		voiceError || micErrorDisplay
			? 'text-red-300'
			: isRecording
				? 'text-emerald-300'
				: 'text-(--desktop-text-dim)';
	const voiceLevelPercent = Math.max(
		6,
		Math.min(100, Math.round((micLevel / 255) * 100))
	);

	useLayoutEffect(() => {
		const el = voiceMeterRef.current;
		if (!el || !voiceBusy) return;
		el.style.setProperty(
			'--voice-fill',
			`${isTranscribing ? 100 : voiceLevelPercent}%`
		);
	}, [voiceBusy, isTranscribing, voiceLevelPercent]);

	return {
		isRecording,
		isTranscribing,
		voiceBusy,
		voiceError,
		setVoiceError,
		voiceStatusText,
		voiceStatusTone,
		voiceMeterRef: voiceMeterRef as RefObject<HTMLDivElement>,
		handleVoiceToggle,
	};
}
