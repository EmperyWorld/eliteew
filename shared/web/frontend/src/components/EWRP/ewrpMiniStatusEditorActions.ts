/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure gates for save/cancel actions on EWRP presentations mini status bar.
 *
 * Invariants:
 * - Save only when draft differs from baseline; both blocked during save/rebuild.
 *
 * Related:
 * - `EwrpPresentationsMiniStatusBar.tsx`, `EWRPGeneratorMain.tsx`
 */

/** Whether mini status bar editor action buttons are enabled. */
export function ewrpMiniStatusEditorActionsEnabled(args: {
	draftIsDirty: boolean;
	saving: boolean;
	slideRebuildInProgress: boolean;
}): { save: boolean; cancel: boolean } {
	const blocked = args.saving || args.slideRebuildInProgress;
	return {
		save: args.draftIsDirty && !blocked,
		cancel: !blocked,
	};
}
