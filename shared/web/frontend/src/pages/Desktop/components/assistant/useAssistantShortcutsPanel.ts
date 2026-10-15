/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composer shortcuts panel open state and scroll-into-view helper (collapsed spoiler by default).
 *
 * Invariants:
 * - Desktop shortcuts `<details>` starts closed; user/tour opens explicitly (no first-visit auto-open).
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - assistantChatConstants.ts ASSISTANT_SHORTCUTS_OPEN_STORAGE_KEY
 * - useAssistantFlashTimeout.ts
 */
import * as React from 'react';
import { ASSISTANT_SHORTCUTS_OPEN_STORAGE_KEY } from './assistantChatConstants';
import { useAssistantFlashTimeout } from './useAssistantFlashTimeout';

export type UseAssistantShortcutsPanelInput = {
	embeddedMobileLayout: boolean;
};

export function useAssistantShortcutsPanel({
	embeddedMobileLayout: _embeddedMobileLayout,
}: UseAssistantShortcutsPanelInput) {
	const shortcutsPanelRef = React.useRef<HTMLDetailsElement | null>(null);
	const [shortcutsOpen, setShortcutsOpen] = React.useState(() => {
		try {
			return (
				sessionStorage.getItem(ASSISTANT_SHORTCUTS_OPEN_STORAGE_KEY) === '1'
			);
		} catch {
			return false;
		}
	});
	const [shortcutsOpenFlash, setShortcutsOpenFlash] = React.useState(false);

	useAssistantFlashTimeout(shortcutsOpenFlash, () =>
		setShortcutsOpenFlash(false)
	);

	const openShortcutsPanel = React.useCallback(() => {
		setShortcutsOpen(true);
		setShortcutsOpenFlash(true);
		try {
			sessionStorage.setItem(ASSISTANT_SHORTCUTS_OPEN_STORAGE_KEY, '1');
		} catch {
			/* sessionStorage unavailable */
		}
		window.requestAnimationFrame(() => {
			shortcutsPanelRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		});
	}, []);

	return {
		shortcutsOpen,
		setShortcutsOpen,
		shortcutsOpenFlash,
		shortcutsPanelRef,
		openShortcutsPanel,
	};
}
