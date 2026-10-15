/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy unified-admin deep links for the retired card-based UGS panel.
 *
 * Invariants:
 * - Legacy `?section=ugs` is still readable; migrate via `migrateLegacyUgsAdminShellUrl`.
 *
 * Related:
 * - pages/Admin/shell/adminShellUrl.ts
 * - pages/Admin/UnifiedAdminPage.tsx
 */

export const UGS_ADMIN_SHELL_SECTION_ID = 'ugsV2' as const;
export const LEGACY_UGS_ADMIN_SECTION_ID = 'ugs' as const;

export function normalizeLegacyUgsAdminSectionId(
	section: string | null | undefined
): typeof UGS_ADMIN_SHELL_SECTION_ID | string | null | undefined {
	if (section === LEGACY_UGS_ADMIN_SECTION_ID) {
		return UGS_ADMIN_SHELL_SECTION_ID;
	}
	return section;
}

/** Rewrite legacy UGS admin deep links to the current UGS Admin v2 section. */
export function migrateLegacyUgsAdminShellUrl(opts?: {
	enabled?: boolean;
}): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== LEGACY_UGS_ADMIN_SECTION_ID) {
			return;
		}
		url.searchParams.set('section', UGS_ADMIN_SHELL_SECTION_ID);
		const next = `${url.pathname}${url.search}${url.hash}`;
		if (
			`${window.location.pathname}${window.location.search}${window.location.hash}` !==
			next
		) {
			window.history.replaceState(null, '', next);
		}
	} catch {
		/* ignore */
	}
}
