/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for UGS Hub virtual list threshold and row height estimates.
 */

import { describe, expect, it } from 'vitest';

import type { UGSTask } from '../../../../hooks/api/useUgsDashboard';
import {
	UGS_HUB_VIRTUAL_LIST_THRESHOLD,
	estimateUgsHubTaskRowHeight,
	shouldVirtualizeUgsHubTaskList,
} from '../ugsHubVirtualList';

const baseTask = {
	id: 'task-1',
	type_key: 'text_gen',
	status: 'completed',
	created_at: '2026-01-01T00:00:00Z',
	priority: 5,
	input_data: {},
} as UGSTask;

describe('ugsHubVirtualList', () => {
	it('does not virtualize small lists', () => {
		expect(
			shouldVirtualizeUgsHubTaskList(UGS_HUB_VIRTUAL_LIST_THRESHOLD - 1)
		).toBe(false);
		expect(shouldVirtualizeUgsHubTaskList(UGS_HUB_VIRTUAL_LIST_THRESHOLD)).toBe(
			true
		);
	});

	it('estimates taller rows for admin and failed/processing states', () => {
		const compact = estimateUgsHubTaskRowHeight(baseTask, {
			showUgsAdminLink: false,
		});
		const admin = estimateUgsHubTaskRowHeight(baseTask, {
			showUgsAdminLink: true,
		});
		const failed = estimateUgsHubTaskRowHeight(
			{ ...baseTask, status: 'failed' },
			{ showUgsAdminLink: false, highlightErrors: true }
		);
		const processing = estimateUgsHubTaskRowHeight(
			{ ...baseTask, status: 'processing', progress: 42 },
			{ showUgsAdminLink: false }
		);

		expect(admin).toBeGreaterThan(compact);
		expect(failed).toBeGreaterThan(compact);
		expect(processing).toBeGreaterThan(compact);
	});
});
