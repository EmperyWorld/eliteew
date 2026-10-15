/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cloud Desktop clipboard policy modes — BYOD sync vs enterprise quarantine.
 *
 * Invariants:
 * - Default `sync` preserves historical OS poll + shell_state history (Cloud / Connected).
 * - FoFline (`foflineNative`) defaults to `quarantine` until the user opts into `sync`.
 * - `quarantine` disables OS clipboard polling, OS write from ClipboardManager, and auto shell_state sync.
 * - Quarantine is not a silent Safe Workspace claim; UI must label the mode honestly.
 *
 * Related:
 * - ClipboardManager.tsx
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
 * - documentation/product/SITE-PROD-LANDING.md §Fact vs Hypothesis
 */

import { getOidcRuntimeProfile } from '@/services/keycloakProfile';

export type ClipboardPolicyMode = 'sync' | 'quarantine';

export const CLIPBOARD_POLICY_STORAGE_KEY =
	'eliteew.desktop.clipboardPolicy.v1' as const;

export function normalizeClipboardPolicyMode(
	raw: unknown
): ClipboardPolicyMode {
	return raw === 'quarantine' ? 'quarantine' : 'sync';
}

export function readClipboardPolicyMode(
	storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.localStorage
): ClipboardPolicyMode {
	try {
		const raw = storage?.getItem(CLIPBOARD_POLICY_STORAGE_KEY);
		if (raw === 'sync' || raw === 'quarantine') {
			return normalizeClipboardPolicyMode(raw);
		}
	} catch {
		/* fall through to edition default */
	}
	// FoFline product SPA: quarantine by default (opt-in sync via explicit toggle).
	if (getOidcRuntimeProfile() === 'foflineNative') {
		return 'quarantine';
	}
	return 'sync';
}

export function writeClipboardPolicyMode(
	mode: ClipboardPolicyMode,
	storage: Pick<Storage, 'setItem'> | null | undefined = globalThis.localStorage
): void {
	try {
		storage?.setItem(CLIPBOARD_POLICY_STORAGE_KEY, mode);
	} catch {
		/* ignore quota / private mode */
	}
}

/** OS clipboard poll (ClipboardManager interval / visibility sync). */
export function allowsOsClipboardPoll(mode: ClipboardPolicyMode): boolean {
	return mode === 'sync';
}

/** Write to OS clipboard from ClipboardManager (explicit click still gated in quarantine). */
export function allowsOsClipboardWrite(mode: ClipboardPolicyMode): boolean {
	return mode === 'sync';
}

/** Auto PATCH of clipboard_history into shell_state. */
export function allowsShellStateClipboardSync(
	mode: ClipboardPolicyMode
): boolean {
	return mode === 'sync';
}
