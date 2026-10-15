/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist dismissal of the latest-reply transcript explainer per companion principal (localStorage).
 *
 * Invariants:
 * - UI-only; does not affect server transcript or memory.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTranscriptLatestReplyHint.tsx
 */

const KEY_PREFIX = 'eliteew.companion.transcriptLatestReplyHint.v1:';

export function isTranscriptLatestReplyHintDismissed(
	principalId: string
): boolean {
	if (typeof window === 'undefined' || !principalId.trim()) return false;
	try {
		return window.localStorage.getItem(`${KEY_PREFIX}${principalId}`) === '1';
	} catch {
		return false;
	}
}

export function dismissTranscriptLatestReplyHint(principalId: string): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		window.localStorage.setItem(`${KEY_PREFIX}${principalId}`, '1');
	} catch {
		/* best-effort */
	}
}
