/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Initial FAQ panel open state from session storage and layout mode.
 *
 * Invariants:
 * - Mobile embedded handbook starts with FAQ collapsed (chip path).
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - assistantChatConstants.ts ASSISTANT_FAQ_OPEN_STORAGE_KEY
 */
import { ASSISTANT_FAQ_OPEN_STORAGE_KEY } from './assistantChatConstants';

export function readInitialAssistantFaqOpen(
	embeddedMobileLayout: boolean
): boolean {
	if (embeddedMobileLayout) return false;
	try {
		const stored = sessionStorage.getItem(ASSISTANT_FAQ_OPEN_STORAGE_KEY);
		if (stored === '0') return false;
		if (stored === '1') return true;
	} catch {
		/* sessionStorage unavailable */
	}
	return true;
}

export function persistAssistantFaqOpen(open: boolean): void {
	try {
		sessionStorage.setItem(ASSISTANT_FAQ_OPEN_STORAGE_KEY, open ? '1' : '0');
	} catch {
		/* sessionStorage unavailable */
	}
}
