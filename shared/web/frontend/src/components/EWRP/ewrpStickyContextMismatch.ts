/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for EWRP generate-tab sticky context chips — slide/theme mismatch vs active job.
 *
 * Invariants:
 * - Theme ids normalize empty to `classic`; slide count prefers `slides.length` over `num_slides`.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md` §5.1
 */

/** Normalize presentation theme id for comparisons (empty → classic). */
export function normalizeEwrpPresentationThemeId(
	theme: string | null | undefined
): string {
	const trimmed = (theme ?? '').trim();
	return trimmed || 'classic';
}

/** Slide count from status payload for sticky/status meta chips. */
export function resolveEwrpStatusSlideCount(
	status:
		| {
				slides?: unknown[] | null;
				num_slides?: number | null;
		  }
		| null
		| undefined
): number | null {
	if (!status) return null;
	if (Array.isArray(status.slides) && status.slides.length > 0) {
		return status.slides.length;
	}
	if (typeof status.num_slides === 'number' && status.num_slides > 0) {
		return status.num_slides;
	}
	return null;
}

/** True when form slide count differs from the active job while a job is selected. */
export function ewrpStickySlidesMismatch(args: {
	hasActiveJob: boolean;
	formNumSlides: number;
	jobSlideCount: number | null | undefined;
}): boolean {
	if (!args.hasActiveJob || args.jobSlideCount == null) return false;
	return args.jobSlideCount !== args.formNumSlides;
}

/** True when form PDF theme differs from the active job theme. */
export function ewrpStickyThemeMismatch(args: {
	hasActiveJob: boolean;
	formTheme: string | null | undefined;
	jobTheme: string | null | undefined;
}): boolean {
	if (!args.hasActiveJob) return false;
	return (
		normalizeEwrpPresentationThemeId(args.formTheme) !==
		normalizeEwrpPresentationThemeId(args.jobTheme)
	);
}
