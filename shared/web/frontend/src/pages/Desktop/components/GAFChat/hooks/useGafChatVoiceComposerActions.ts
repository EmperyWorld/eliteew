/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Voice recording start/finish guards for GAF Chat composer (mic button UX).
 *
 * Invariants:
 * - Start blocked when composer locked, no selected chat, or pending attachments exist.
 *
 * Related:
 * - GAFChatApp.tsx
 * - useGafVoiceRecorder.ts
 */
import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { toast } from 'sonner';

export function useGafChatVoiceComposerActions(options: {
	t: TFunction<'gafChat'>;
	selectedChatId: string | null;
	composerLocked: boolean;
	pendingAttachmentsLength: number;
	isVoiceRecording: boolean;
	startVoiceRecording: () => Promise<void>;
	/** Stop may resolve with the recorded blob; composer only awaits completion. */
	stopVoiceRecording: () => Promise<unknown>;
}) {
	const {
		t,
		selectedChatId,
		composerLocked,
		pendingAttachmentsLength,
		isVoiceRecording,
		startVoiceRecording,
		stopVoiceRecording,
	} = options;

	const finishVoiceRecording = useCallback(async () => {
		if (!isVoiceRecording) return;
		await stopVoiceRecording();
	}, [isVoiceRecording, stopVoiceRecording]);

	const beginVoiceRecording = useCallback(async () => {
		if (!selectedChatId || composerLocked || pendingAttachmentsLength > 0)
			return;
		try {
			await startVoiceRecording();
		} catch (err) {
			const msg =
				err instanceof Error && err.message
					? err.message
					: t('voiceStartFailed');
			toast.error(msg);
		}
	}, [
		selectedChatId,
		composerLocked,
		pendingAttachmentsLength,
		startVoiceRecording,
		t,
	]);

	return { beginVoiceRecording, finishVoiceRecording };
}
