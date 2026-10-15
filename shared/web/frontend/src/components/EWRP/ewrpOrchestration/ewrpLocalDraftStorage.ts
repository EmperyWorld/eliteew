/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * LocalStorage helpers for EWRP slide-editor draft autosave (`ewrp-draft-{jobId}`).
 *
 * Invariants:
 * - Key shape `ewrp-draft-${id}` must stay stable for restore prompts.
 *
 * Related:
 * - `useEwrpDraftEditor.ts`, `useEwrpGeneratorPolling.ts` (restore key clear)
 */

import type { EwrpSlide } from '@/services/ewrpApi';
import type { DraftRestorePrompt } from './ewrpOrchestrationTypes';

export function ewrpDraftStorageKey(jobId: string): string {
	return `ewrp-draft-${jobId}`;
}

export function clearEwrpLocalDraft(id: string | null): void {
	if (!id) return;
	try {
		localStorage.removeItem(ewrpDraftStorageKey(id));
	} catch {
		/* ignore */
	}
}

export function readEwrpLocalDraftRaw(jobId: string): string | null {
	try {
		return localStorage.getItem(ewrpDraftStorageKey(jobId));
	} catch {
		return null;
	}
}

export function writeEwrpLocalDraft(jobId: string, slides: EwrpSlide[]): void {
	try {
		localStorage.setItem(
			ewrpDraftStorageKey(jobId),
			JSON.stringify({ savedAt: Date.now(), slides })
		);
	} catch {
		/* quota */
	}
}

/** Parse stored draft; returns prompt when slides differ from server baseline. */
export function parseEwrpDraftRestorePrompt(
	raw: string,
	baselineJson: string
): DraftRestorePrompt | null {
	try {
		const parsed = JSON.parse(raw) as {
			savedAt?: number;
			slides?: EwrpSlide[];
		};
		if (parsed?.slides && JSON.stringify(parsed.slides) !== baselineJson) {
			return {
				slides: parsed.slides,
				savedAt: parsed.savedAt ?? 0,
			};
		}
	} catch {
		/* ignore */
	}
	return null;
}
