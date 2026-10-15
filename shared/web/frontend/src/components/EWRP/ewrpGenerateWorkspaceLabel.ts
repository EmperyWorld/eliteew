/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for EWRP generate/presentations workspace headline — form draft vs active job status.
 *
 * Invariants:
 * - Form topic/title always wins over status title/topic when non-empty after trim.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md` §5.1
 */

/** Title or topic from job status for banners and sticky bar fallback. */
export function resolveEwrpStatusPresentationLabel(args: {
	statusTitle?: string | null;
	statusTopic?: string | null;
}): string | null {
	const presentationTitle = (args.statusTitle ?? '').trim();
	const presentationTopic = (args.statusTopic ?? '').trim();
	return presentationTitle || presentationTopic || null;
}

/** Headline for generate sticky bar and active-job banner. */
export function resolveEwrpGenerateWorkspaceLabel(args: {
	formTopic: string;
	formTitle: string;
	statusTitle?: string | null;
	statusTopic?: string | null;
}): string | null {
	const fromForm = args.formTopic.trim() || args.formTitle.trim();
	if (fromForm) return fromForm;
	return resolveEwrpStatusPresentationLabel(args);
}
