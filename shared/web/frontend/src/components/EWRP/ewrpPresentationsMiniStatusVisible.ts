/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure gate for EWRP sticky mini status bar while slide editor is open and status panel scrolled away.
 *
 * Invariants:
 * - Requires active job, status payload, visible editor panel, and status anchor off-screen.
 *
 * Related:
 * - `EwrpPresentationsMiniStatusBar.tsx`, `EWRPGeneratorMain.tsx`
 */

/** Whether the presentations mini status bar should render. */
export function ewrpPresentationsMiniStatusVisible(args: {
	hasJobId: boolean;
	hasStatus: boolean;
	statusPanelVisible: boolean;
	showSlideEditorPanel: boolean;
}): boolean {
	return (
		args.hasJobId &&
		args.hasStatus &&
		args.showSlideEditorPanel &&
		!args.statusPanelVisible
	);
}
