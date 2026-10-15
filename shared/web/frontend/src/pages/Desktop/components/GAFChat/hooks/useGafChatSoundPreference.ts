/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat notification sound preference (anon localStorage + shell_state sync).
 *
 * Invariants:
 * - Shell custom event updates local toggle; authenticated toggle patches shell_state.
 *
 * Related:
 * - utils/gafChatShellSound.ts · GAFChatApp.tsx
 */
import { useCallback, useEffect, useState } from 'react';
import {
	scheduleShellStateMutation,
	waitForShellStatePipelineFlush,
} from '../../../utils/desktopShellStateMutationPipeline';
import {
	GAF_CHAT_SOUND_ANON_STORAGE_KEY,
	GAF_CHAT_SOUND_SHELL_EVENT,
	setGafChatSoundEnabledCached,
} from '../../../utils/gafChatShellSound';

export function useGafChatSoundPreference(meUserId: string | undefined) {
	const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
		try {
			if (typeof window === 'undefined') return true;
			const raw = window.localStorage.getItem(GAF_CHAT_SOUND_ANON_STORAGE_KEY);
			if (raw === '0') return false;
			if (raw === '1') return true;
			return true;
		} catch {
			return true;
		}
	});

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onShell = (e: Event) => {
			const d = (e as CustomEvent<boolean>).detail;
			if (typeof d === 'boolean') setSoundEnabled(d);
		};
		window.addEventListener(
			GAF_CHAT_SOUND_SHELL_EVENT,
			onShell as EventListener
		);
		return () =>
			window.removeEventListener(
				GAF_CHAT_SOUND_SHELL_EVENT,
				onShell as EventListener
			);
	}, []);

	const toggleSound = useCallback(() => {
		setSoundEnabled((prev) => {
			const next = !prev;
			setGafChatSoundEnabledCached(next);
			if (meUserId) {
				scheduleShellStateMutation({
					source: 'chrome',
					merge: () => ({ gaf_chat_sound_enabled: next }),
				});
				void waitForShellStatePipelineFlush().catch(() => {});
			}
			return next;
		});
	}, [meUserId]);

	return { soundEnabled, toggleSound };
}
