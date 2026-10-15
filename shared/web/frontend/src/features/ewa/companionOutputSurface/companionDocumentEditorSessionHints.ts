/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Principal-scoped one-shot UX hints for embedded companion document editor.
 *
 * Invariants:
 * - Hints are local-only; missing principal id skips persistence.
 *
 * Related:
 * - CompanionDocumentEditorMode.tsx
 */

const DISCUSS_HINT_PREFIX = 'eliteew.ewaCompanion.documentDiscussHint.v1::';

function discussHintKey(principalId: string): string {
	return `${DISCUSS_HINT_PREFIX}${principalId.trim()}`;
}

export function shouldShowDocumentDiscussHint(principalId: string): boolean {
	if (typeof window === 'undefined' || !principalId.trim()) return false;
	try {
		return window.localStorage.getItem(discussHintKey(principalId)) !== '1';
	} catch {
		return false;
	}
}

export function markDocumentDiscussHintSeen(principalId: string): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		window.localStorage.setItem(discussHintKey(principalId), '1');
	} catch {
		// local hint only — safe to ignore
	}
}
