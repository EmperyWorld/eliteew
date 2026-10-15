/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize ensemble plan validation API/detail payloads for operator UI display.
 *
 * Invariants:
 * - Never throws on unknown detail shapes; returns empty string when nothing to show.
 *
 * Related:
 * - pages/Admin/ensemblePlan/EnsemblePlanWorkbench.tsx
 * - pages/Admin/desktopAiChat/DesktopAiChatBlueprintTab.tsx
 */

/** Format validate/save error detail for monospace hint blocks. */
export function formatEnsemblePlanValidationDisplay(detail: unknown): string {
	if (detail == null) {
		return '';
	}
	if (typeof detail === 'string') {
		return detail.trim();
	}
	if (Array.isArray(detail)) {
		return JSON.stringify(detail, null, 2);
	}
	if (typeof detail === 'object') {
		return JSON.stringify(detail, null, 2);
	}
	return String(detail);
}

/** True when a non-empty validation hint should use assertive live region. */
export function hasEnsemblePlanValidationHint(
	hint: string | null
): hint is string {
	return typeof hint === 'string' && hint.trim().length > 0;
}
