/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';

import {
	resolveUgsHubTasksPollIntervalMs,
	UGS_HUB_ACTIVE_POLL_INTERVAL_MS,
	UGS_HUB_IDLE_POLL_INTERVAL_MS,
	UGS_HUB_STREAMING_POLL_INTERVAL_MS,
	ugsHubTasksHaveRecentActive,
} from '../ugsHubTasksPolling';
import type { UGSTask } from '../types';

const baseTask = (overrides: Partial<UGSTask>): UGSTask => ({
	id: 'req-1',
	type_key: 'text_chat',
	status: 'pending',
	created_at: '2026-05-27T10:00:00Z',
	updated_at: '2026-05-27T10:00:00Z',
	user_id: 'u1',
	priority: 5,
	...overrides,
});

describe('ugsHubTasksPolling', () => {
	it('returns false when polling is disabled', () => {
		expect(
			resolveUgsHubTasksPollIntervalMs([baseTask({ status: 'processing' })], {
				pollingEnabled: false,
			})
		).toBe(false);
	});

	it('uses streaming interval when SSE streams are active', () => {
		expect(resolveUgsHubTasksPollIntervalMs([], { activeStreamCount: 1 })).toBe(
			UGS_HUB_STREAMING_POLL_INTERVAL_MS
		);
	});

	it('uses idle interval for empty task list without streams', () => {
		expect(resolveUgsHubTasksPollIntervalMs([])).toBe(
			UGS_HUB_IDLE_POLL_INTERVAL_MS
		);
	});

	it('uses active interval for recently updated processing tasks', () => {
		const now = Date.parse('2026-05-27T10:05:00Z');
		const tasks = [
			baseTask({
				status: 'processing',
				updated_at: '2026-05-27T10:04:30Z',
			}),
		];
		expect(resolveUgsHubTasksPollIntervalMs(tasks, { now })).toBe(
			UGS_HUB_ACTIVE_POLL_INTERVAL_MS
		);
		expect(ugsHubTasksHaveRecentActive(tasks, now)).toBe(true);
	});

	it('uses idle interval when active tasks are stale', () => {
		const now = Date.parse('2026-05-27T12:00:00Z');
		const tasks = [
			baseTask({
				status: 'processing',
				updated_at: '2026-05-27T10:00:00Z',
			}),
		];
		expect(resolveUgsHubTasksPollIntervalMs(tasks, { now })).toBe(
			UGS_HUB_IDLE_POLL_INTERVAL_MS
		);
		expect(ugsHubTasksHaveRecentActive(tasks, now)).toBe(false);
	});

	it('returns false when document tab is hidden', () => {
		expect(
			resolveUgsHubTasksPollIntervalMs(
				[
					baseTask({
						status: 'processing',
						updated_at: '2026-05-27T10:04:30Z',
					}),
				],
				{ documentVisible: false }
			)
		).toBe(false);
	});
});
