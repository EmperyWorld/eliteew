/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P9 honesty helpers — do not treat “config ready + empty items” as a real empty desktop
 * while the items GET is still in flight (`isItemsHydrating`).
 *
 * Invariants:
 * - Preloader stays up for items hydrate even after config arrives.
 * - Empty CTA only after items hydrate completes.
 *
 * Related:
 * - hooks/useDesktopStorage.ts (`isItemsHydrating`)
 * - hooks/useDesktopWorkspaceContentViewModel.ts
 * - hooks/useDesktopWorkspaceShellCanvasProps.ts
 */

export function shouldShowDesktopStoragePreloader(params: {
	storageLoading: boolean;
	hasConfig: boolean;
	isItemsHydrating: boolean;
}): boolean {
	return (
		(params.storageLoading && !params.hasConfig) || params.isItemsHydrating
	);
}

export function shouldShowDesktopEmptyState(params: {
	displayItemCount: number;
	isItemsHydrating: boolean;
}): boolean {
	if (params.isItemsHydrating) return false;
	return params.displayItemCount === 0;
}
