/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Релизы dual-flag: suppress silent Linux auto-install while Hub shows notes.
 *
 * Invariants:
 * - Default policy: no silent auto-apply while notes UI is active for that version.
 * - Install/Restart remain explicit user actions.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.2
 */

export type AutoApplyPolicy = 'suppress_while_notes' | 'keep_auto_apply';

export const DEFAULT_AUTO_APPLY_POLICY: AutoApplyPolicy =
	'suppress_while_notes';

export type AutoApplyGateInput = {
	policy: AutoApplyPolicy;
	updateAvailable: boolean;
	/** Hub Релизы is showing notes for this available version. */
	notesVisibleForAvailableVersion: boolean;
	platform: 'linux' | 'windows' | 'macos' | 'other';
};

/**
 * Whether Core/FE may call silent updater install on this tick.
 * Linux RPM historically auto-applied; Journey default suppresses while notes show.
 */
export function maySilentAutoApplyUpdate(input: AutoApplyGateInput): boolean {
	if (!input.updateAvailable) return false;
	if (input.platform !== 'linux') return false;
	if (input.policy === 'keep_auto_apply') return true;
	if (input.notesVisibleForAvailableVersion) return false;
	return true;
}

export type ReleaseNotesSource = {
	/** Bundle / OTA sidecar path relative to desktop-client. */
	userNotesRelPath: string;
	historyJsonRelPath: string;
};

export const RELEASE_NOTES_SOURCES: ReleaseNotesSource = {
	userNotesRelPath: 'docs/RELEASE-NOTES-user.ru.txt',
	historyJsonRelPath: 'docs/RELEASE-NOTES-history.ru.json',
};

/** User-facing notes must not contain ops/bake jargon markers. */
export function notesCopyLooksOpsJargon(text: string): boolean {
	return /bake[_-]?id|STACK0_|eeprodbaked|podman|XDG_RUNTIME|SOPS/i.test(
		text
	);
}
