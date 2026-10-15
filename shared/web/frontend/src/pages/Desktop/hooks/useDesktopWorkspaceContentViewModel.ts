/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave A1.1 thin composer for DesktopWorkspaceContent: head + tail clusters and
 * loading/recovery preloader flags for the Inner render branches.
 *
 * Invariants:
 * - Storage preloader stays up while `isItemsHydrating` (P9) so config-ready
 *   alone cannot flash an empty canvas.
 *
 * Related:
 * - DesktopWorkspaceContent.tsx
 * - hooks/useDesktopWorkspaceContentHeadCluster.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 * - utils/desktopEmptyStateHonesty.ts
 */

import { useMinimumPreloaderVisible } from '../../../hooks/useMinimumPreloaderVisible';
import { shouldShowDesktopStoragePreloader } from '../utils/desktopEmptyStateHonesty';
import type { UseDesktopStorageReturn } from './useDesktopStorage';
import { useDesktopWorkspaceContentHeadCluster } from './useDesktopWorkspaceContentHeadCluster';
import { useDesktopWorkspaceContentTailCluster } from './useDesktopWorkspaceContentTailCluster';

export type UseDesktopWorkspaceContentViewModelParams = {
	storage: UseDesktopStorageReturn;
};

export function useDesktopWorkspaceContentViewModel(
	params: UseDesktopWorkspaceContentViewModelParams
) {
	const head = useDesktopWorkspaceContentHeadCluster(params);
	const tail = useDesktopWorkspaceContentTailCluster(head);

	const hasHydratedDesktop = head.config != null;
	const showStoragePreloader = useMinimumPreloaderVisible(
		shouldShowDesktopStoragePreloader({
			storageLoading: head.storageLoading,
			hasConfig: hasHydratedDesktop,
			isItemsHydrating: head.isItemsHydrating,
		}),
		{
			minimumMs: head.deferLoadingShellToMaintenance ? 0 : undefined,
		}
	);

	return {
		...head,
		...tail,
		hasHydratedDesktop,
		showStoragePreloader,
	};
}

export type DesktopWorkspaceContentViewModel = ReturnType<
	typeof useDesktopWorkspaceContentViewModel
>;
