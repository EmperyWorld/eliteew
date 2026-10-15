/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable fingerprint of non-minimized desktop apps for companion left-rail recent-actions filtering.
 * Used so polling can skip React setState when the open-app set did not change.
 *
 * Invariants:
 * - Empty / null snapshot → empty string.
 * - Order-independent (sorted) so window z-order churn alone does not change the fingerprint.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionLeftRailController.ts
 */

export type CompanionShellOpenAppsSnapshot = {
	windows: ReadonlyArray<{
		minimized?: boolean;
		app_component?: string | null;
	}>;
} | null;

/** Canonical open-apps key for recent-server-actions filtering (no React). */
export function companionShellOpenAppsFingerprint(
	snap: CompanionShellOpenAppsSnapshot
): string {
	if (!snap || !Array.isArray(snap.windows)) return '';
	const apps: string[] = [];
	for (const row of snap.windows) {
		if (!row || row.minimized) continue;
		const id =
			typeof row.app_component === 'string' ? row.app_component.trim() : '';
		if (id) apps.push(id);
	}
	if (apps.length === 0) return '';
	apps.sort();
	return apps.join('\0');
}
