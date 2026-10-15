/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Virtual list threshold and row height estimates for UGS Hub task lists.
 *
 * Invariants:
 * - Windowing activates only at or above `UGS_HUB_VIRTUAL_LIST_THRESHOLD` rows.
 *
 * Related:
 * - UgsHubVirtualTaskList.tsx, UgsHubTaskList.tsx
 */

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';

/** Rows below this count render without windowing (overview slices stay unvirtualized). */
export const UGS_HUB_VIRTUAL_LIST_THRESHOLD = 48;

/** Scrollport height for virtualized Hub lists inside desktop window. */
export const UGS_HUB_VIRTUAL_LIST_VIEWPORT_PX = 640;

export interface UgsHubTaskRowEstimateOptions {
	showUgsAdminLink: boolean;
	highlightErrors?: boolean;
}

export function shouldVirtualizeUgsHubTaskList(taskCount: number): boolean {
	return taskCount >= UGS_HUB_VIRTUAL_LIST_THRESHOLD;
}

export function estimateUgsHubTaskRowHeight(
	task: UGSTask,
	options: UgsHubTaskRowEstimateOptions
): number {
	let height = 156;
	if (options.showUgsAdminLink) {
		height += 168;
	}
	if (options.highlightErrors && task.status === 'failed') {
		height += 76;
	}
	if (task.status === 'processing') {
		height += 52;
	}
	return height;
}
