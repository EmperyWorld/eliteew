/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure-unit coverage for UGS Workflows tab filter/sort/project helpers.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - ugsWorkflowsFilterUtils.ts
 */

import { describe, expect, it } from 'vitest';
import type { WorkflowRecord } from '../types';
import {
	collectWorkflowProjectIds,
	filterAndSortWorkflows,
	workflowsFiltersApplied,
} from '../ugsWorkflowsFilterUtils';

function wf(
	partial: Partial<WorkflowRecord> &
		Pick<WorkflowRecord, 'id' | 'workflow_name'>
): WorkflowRecord {
	return {
		created_at: '2026-01-01T00:00:00Z',
		is_public: false,
		...partial,
	};
}

describe('filterAndSortWorkflows', () => {
	const catalog = [
		wf({
			id: '1',
			workflow_name: 'Alpha Flow',
			description: 'first',
			is_public: true,
			project_id: 'proj-aaa',
			execution_count: 2,
			updated_at: '2026-01-02T00:00:00Z',
		}),
		wf({
			id: '2',
			workflow_name: 'Beta Flow',
			description: 'second secret',
			is_public: false,
			project_id: 'proj-bbb',
			execution_count: 9,
			updated_at: '2026-01-03T00:00:00Z',
		}),
		wf({
			id: '3',
			workflow_name: 'Gamma',
			is_public: true,
			execution_count: 1,
			updated_at: '2026-01-01T12:00:00Z',
		}),
	];

	it('filters by search query on name and description', () => {
		const byName = filterAndSortWorkflows(catalog, {
			searchQuery: 'alpha',
			filterPublic: 'all',
			filterProject: 'all',
			sortBy: 'name',
		});
		expect(byName.map((w) => w.id)).toEqual(['1']);

		const byDesc = filterAndSortWorkflows(catalog, {
			searchQuery: 'secret',
			filterPublic: 'all',
			filterProject: 'all',
			sortBy: 'name',
		});
		expect(byDesc.map((w) => w.id)).toEqual(['2']);
	});

	it('filters by public/private and project', () => {
		const publics = filterAndSortWorkflows(catalog, {
			searchQuery: '',
			filterPublic: 'public',
			filterProject: 'all',
			sortBy: 'name',
		});
		expect(publics.map((w) => w.id)).toEqual(['1', '3']);

		const byProject = filterAndSortWorkflows(catalog, {
			searchQuery: '',
			filterPublic: 'all',
			filterProject: 'proj-bbb',
			sortBy: 'name',
		});
		expect(byProject.map((w) => w.id)).toEqual(['2']);
	});

	it('sorts by name, date, and executions without mutating input', () => {
		const snapshot = catalog.map((w) => w.id);

		const byName = filterAndSortWorkflows(catalog, {
			searchQuery: '',
			filterPublic: 'all',
			filterProject: 'all',
			sortBy: 'name',
		});
		expect(byName.map((w) => w.workflow_name)).toEqual([
			'Alpha Flow',
			'Beta Flow',
			'Gamma',
		]);

		const byDate = filterAndSortWorkflows(catalog, {
			searchQuery: '',
			filterPublic: 'all',
			filterProject: 'all',
			sortBy: 'date',
		});
		expect(byDate.map((w) => w.id)).toEqual(['2', '1', '3']);

		const byExec = filterAndSortWorkflows(catalog, {
			searchQuery: '',
			filterPublic: 'all',
			filterProject: 'all',
			sortBy: 'executions',
		});
		expect(byExec.map((w) => w.id)).toEqual(['2', '1', '3']);

		expect(catalog.map((w) => w.id)).toEqual(snapshot);
	});
});

describe('collectWorkflowProjectIds', () => {
	it('collects unique project ids and skips missing', () => {
		const ids = collectWorkflowProjectIds([
			wf({ id: '1', workflow_name: 'A', project_id: 'p1' }),
			wf({ id: '2', workflow_name: 'B' }),
			wf({ id: '3', workflow_name: 'C', project_id: 'p1' }),
			wf({ id: '4', workflow_name: 'D', project_id: 'p2' }),
		]);
		expect(ids.sort()).toEqual(['p1', 'p2']);
	});
});

describe('workflowsFiltersApplied', () => {
	it('detects active search or non-default filters', () => {
		expect(
			workflowsFiltersApplied({
				searchQuery: '',
				filterPublic: 'all',
				filterProject: 'all',
			})
		).toBe(false);
		expect(
			workflowsFiltersApplied({
				searchQuery: '  x  ',
				filterPublic: 'all',
				filterProject: 'all',
			})
		).toBe(true);
		expect(
			workflowsFiltersApplied({
				searchQuery: '',
				filterPublic: 'public',
				filterProject: 'all',
			})
		).toBe(true);
		expect(
			workflowsFiltersApplied({
				searchQuery: '',
				filterPublic: 'all',
				filterProject: 'proj-1',
			})
		).toBe(true);
	});
});
