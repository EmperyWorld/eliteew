/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure filter/sort helpers for the UGS Workflows tab catalog (search, visibility, project, sort).
 *
 * Invariants:
 * - Does not mutate the input workflows array; returns a new sorted list.
 *
 * Related:
 * - useUgsWorkflowsTabController.ts
 * - UGSWorkflowsTab.tsx
 */

import type { WorkflowRecord } from './types';

export type UgsWorkflowsSortBy = 'name' | 'date' | 'executions';

export interface UgsWorkflowsFilterInput {
	searchQuery: string;
	filterPublic: string;
	filterProject: string;
	sortBy: UgsWorkflowsSortBy;
}

export function filterAndSortWorkflows(
	workflows: WorkflowRecord[],
	{ searchQuery, filterPublic, filterProject, sortBy }: UgsWorkflowsFilterInput
): WorkflowRecord[] {
	let filtered = [...workflows];
	if (searchQuery.trim()) {
		const q = searchQuery.toLowerCase();
		filtered = filtered.filter(
			(w) =>
				w.workflow_name.toLowerCase().includes(q) ||
				w.description?.toLowerCase().includes(q)
		);
	}
	if (filterPublic === 'public') filtered = filtered.filter((w) => w.is_public);
	else if (filterPublic === 'private')
		filtered = filtered.filter((w) => !w.is_public);
	if (filterProject !== 'all')
		filtered = filtered.filter((w) => w.project_id === filterProject);
	filtered.sort((a, b) => {
		switch (sortBy) {
			case 'name':
				return a.workflow_name.localeCompare(b.workflow_name);
			case 'executions':
				return (b.execution_count || 0) - (a.execution_count || 0);
			default:
				return (
					new Date(b.updated_at || b.created_at).getTime() -
					new Date(a.updated_at || a.created_at).getTime()
				);
		}
	});
	return filtered;
}

export function collectWorkflowProjectIds(
	workflows: WorkflowRecord[]
): string[] {
	const set = new Set<string>();
	workflows.forEach((w) => {
		if (w.project_id) set.add(w.project_id);
	});
	return Array.from(set);
}

export function workflowsFiltersApplied({
	searchQuery,
	filterPublic,
	filterProject,
}: Pick<
	UgsWorkflowsFilterInput,
	'searchQuery' | 'filterPublic' | 'filterProject'
>): boolean {
	return (
		Boolean(searchQuery.trim()) ||
		filterPublic !== 'all' ||
		filterProject !== 'all'
	);
}
