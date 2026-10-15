/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types for UGS Hub tab panels extracted from UGSHub.tsx.
 *
 * Invariants:
 * - Task list render callback shape must match Hub `renderTaskList` contract.
 *
 * Related:
 * - components/UGSHub.tsx
 */

import type { ComponentType, ReactNode } from 'react';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';

export interface UgsHubTaskListConfig {
	emptyTitle: string;
	emptyDescription: string;
	emptyActionLabel?: string;
	onEmptyAction?: () => void;
	showViewAction?: boolean;
	showDownloadAction?: boolean;
	highlightErrors?: boolean;
}

export type UgsHubRenderTaskList = (
	tasks: UGSTask[],
	config: UgsHubTaskListConfig
) => ReactNode;

export interface UgsHubPaginatedSlice {
	items: UGSTask[];
	totalPages: number;
	totalItems: number;
	hasPagination: boolean;
	page: number;
}

export type UgsHubActiveTab =
	| 'overview'
	| 'active'
	| 'history'
	| 'results'
	| 'admin_history'
	| 'workflows';

export interface UgsHubTabItem {
	id: UgsHubActiveTab;
	label: string;
	icon: ComponentType<{ className?: string; strokeWidth?: number }>;
	count: number;
	subtitle?: string;
}
