/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map voice STT/TTS/recording errors to user-facing docEditorPanels i18n messages.
 *
 * Invariants:
 * - NotAllowedError → micDenied; synth/transcribe heuristics unchanged from monolith.
 *
 * Related:
 * - useVoiceTranscriptionPanel.ts
 */

import type { TFunction } from 'i18next';

export function voiceUserMessage(
	error: unknown,
	t: TFunction<'docEditorPanels'>
): string {
	if (error && typeof error === 'object' && 'name' in error) {
		const name = String((error as DOMException).name);
		if (name === 'NotAllowedError') {
			return t('voice.errors.micDenied');
		}
		if (name === 'NotFoundError') {
			return t('voice.errors.micNotFound');
		}
	}
	if (error instanceof Error) {
		const m = error.message;
		if (/synth|audio url|tts|speech/i.test(m)) {
			return t('voice.errors.synthFailed');
		}
		if (m.length < 140 && !/Traceback|File "/i.test(m)) {
			if (/No transcription|empty/i.test(m)) {
				return t('voice.errors.transcribeFailed');
			}
			return m;
		}
	}
	return t('voice.errors.generic');
}
