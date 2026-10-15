/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Workers Admin URL tab sync and pool KPI helper.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - `pages/Admin/workers/adminWorkersUrl.ts`
 * - `pages/Admin/workers/workersOpsApi.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	isWorkersAdminTab,
	readWorkersAdminTabFromUrl,
} from '../adminWorkersUrl';
import {
	countOnlinePools,
	type WorkersOpsExpectedPool,
} from '../workersOpsApi';

describe('adminWorkersUrl', () => {
	it('validates workers tabs', () => {
		expect(isWorkersAdminTab('overview')).toBe(true);
		expect(isWorkersAdminTab('actions')).toBe(true);
		expect(isWorkersAdminTab('nope')).toBe(false);
	});

	it('reads workersTab from search string', () => {
		expect(
			readWorkersAdminTabFromUrl('?section=workers&workersTab=celery')
		).toBe('celery');
		expect(readWorkersAdminTabFromUrl('?section=workers&workersTab=bad')).toBe(
			null
		);
	});
});

describe('countOnlinePools', () => {
	it('counts online and unknown', () => {
		const pools: WorkersOpsExpectedPool[] = [
			{
				id: 'a',
				label: 'A',
				container: 'c-a',
				queues: [],
				role: 'celery',
				online: true,
			},
			{
				id: 'b',
				label: 'B',
				container: 'c-b',
				queues: [],
				role: 'celery',
				online: false,
			},
			{
				id: 'c',
				label: 'C',
				container: 'c-c',
				queues: [],
				role: 'rabbitmq',
				online: null,
			},
		];
		expect(countOnlinePools(pools)).toEqual({
			online: 1,
			total: 3,
			unknown: 1,
		});
	});
});

describe('WorkersOpsSnapshot contract', () => {
	it('accepts queue_depths, rate_limit_policy, inspect_phases, pool match fields', () => {
		const snap = {
			celery: {
				status: 'ok',
				ping: {},
				stats: {},
				active_queues: {},
				active: [],
				reserved: [],
				scheduled: [],
				registered: {},
				workers_online: ['worker@h1'],
				queues: [],
				known_queue_names: ['short'],
				queue_depths: {
					status: 'ok',
					error: null,
					depths: { short: 0 },
				},
				rate_limit_policy: {
					default_rate_limit: '100/m',
					exempt_tasks: ['api.tasks.demo'],
				},
				inspect_phases: {
					essential_sec: 1.2,
					detail_sec: 3.4,
					detail_skipped: [],
				},
			},
			beat: { health: {}, schedule: [] },
			rabbitmq: {},
			expected_pools: [
				{
					id: 'celery-general',
					label: 'Celery general',
					container: 'stack0-eliteew-celery-worker-prod-baked',
					queues: ['short'],
					role: 'celery',
					online: true,
					matched_workers: ['worker@h1'],
					online_reason: 'hostname',
				},
			],
		};
		expect(snap.celery.queue_depths.depths.short).toBe(0);
		expect(snap.celery.rate_limit_policy.exempt_tasks).toHaveLength(1);
		expect(snap.celery.inspect_phases.essential_sec).toBe(1.2);
		expect(snap.expected_pools[0]?.matched_workers).toEqual(['worker@h1']);
	});
});
