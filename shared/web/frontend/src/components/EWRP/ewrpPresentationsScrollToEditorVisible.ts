/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure gates for EWRP «scroll to slide editor» affordances on the presentations tab.
 *
 * Invariants:
 * - Toolbar CTA when status is visible but editor anchor left viewport; mini-bar CTA when both are off-screen.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpPresentationsMiniStatusBar.tsx`
 */

/** Toolbar «To editor» when editing and status panel is on-screen but editor scrolled away. */
export function ewrpPresentationsScrollToEditorVisible(args: {
	showSlideEditorPanel: boolean;
	statusPanelVisible: boolean;
	slideEditorPanelVisible: boolean;
}): boolean {
	return (
		args.showSlideEditorPanel &&
		args.statusPanelVisible &&
		!args.slideEditorPanelVisible
	);
}

/** Mini status bar «To editor» when sticky bar is shown and editor is still below fold. */
export function ewrpMiniStatusScrollToEditorVisible(args: {
	showPresentationsMiniStatus: boolean;
	slideEditorPanelVisible: boolean;
}): boolean {
	return args.showPresentationsMiniStatus && !args.slideEditorPanelVisible;
}
