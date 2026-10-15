/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for applying UGS SSE stream patches to React Query task caches.
 *
 * Invariants:
 * - Seeded inserts happen once for infinite task caches, not once per loaded page.
 * - Existing task rows are patched in place.
 *
 * Related:
 * - src/services/api/ugs/patchUgsTasksQueryCache.ts
 */

import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { patchUgsTasksQueryCacheFromStream } from '../patchUgsTasksQueryCache';
import type { UGSTask } from '../types';

describe('patchUgsTasksQueryCacheFromStream', () => {
	it('merges progress into an existing task row', () => {
		const queryClient = new QueryClient();
		const key = ['ugs', 'tasks', { limit: 100, offset: 0 }] as const;
		const tasks: UGSTask[] = [
			{
				id: 'req-1',
				type_key: 'image_banner',
				status: 'pending',
				created_at: '2026-05-19T00:00:00Z',
				updated_at: '2026-05-19T00:00:00Z',
				user_id: 'u1',
				priority: 5,
			},
		];
		queryClient.setQueryData(key, tasks);

		patchUgsTasksQueryCacheFromStream(queryClient, {
			request_id: 'req-1',
			status: 'processing',
			progress: 42,
			progress_message: 'Rendering',
		});

		const next = queryClient.getQueryData<UGSTask[]>(key);
		expect(next?.[0]?.status).toBe('processing');
		expect(next?.[0]?.progress).toBe(42);
		expect(next?.[0]?.progress_message).toBe('Rendering');
	});

	it('prepends a new task when seed is provided', () => {
		const queryClient = new QueryClient();
		const key = ['ugs', 'tasks', { limit: 100, offset: 0 }] as const;
		queryClient.setQueryData<UGSTask[]>(key, []);

		patchUgsTasksQueryCacheFromStream(
			queryClient,
			{
				request_id: 'req-new',
				status: 'queued',
			},
			{
				type_key: 'text_chat',
				input_data: { prompt: 'hi' },
				priority: 5,
				user_id: 'u1',
			}
		);

		const next = queryClient.getQueryData<UGSTask[]>(key);
		expect(next).toHaveLength(1);
		expect(next?.[0]?.id).toBe('req-new');
		expect(next?.[0]?.type_key).toBe('text_chat');
	});

	it('inserts a seeded task once into the first page of an infinite cache', () => {
		const queryClient = new QueryClient();
		const key = [
			'ugs',
			'tasks',
			{ limit: 2, offset: 0, infinite: true },
		] as const;
		queryClient.setQueryData<InfiniteData<UGSTask[]>>(key, {
			pageParams: [0, 2],
			pages: [
				[
					{
						id: 'req-1',
						type_key: 'text_chat',
						status: 'completed',
						created_at: '2026-05-28T00:00:00Z',
						updated_at: '2026-05-28T00:00:00Z',
						user_id: 'u1',
						priority: 5,
					},
				],
				[
					{
						id: 'req-2',
						type_key: 'text_chat',
						status: 'completed',
						created_at: '2026-05-28T00:00:00Z',
						updated_at: '2026-05-28T00:00:00Z',
						user_id: 'u1',
						priority: 5,
					},
				],
			],
		});

		patchUgsTasksQueryCacheFromStream(
			queryClient,
			{ request_id: 'req-new', status: 'queued' },
			{
				type_key: 'text_chat',
				input_data: { prompt: 'hi' },
				priority: 5,
				user_id: 'u1',
			}
		);

		const next = queryClient.getQueryData<InfiniteData<UGSTask[]>>(key);
		const allIds = next?.pages.flat().map((task) => task.id) ?? [];
		expect(allIds.filter((id) => id === 'req-new')).toHaveLength(1);
		expect(next?.pages[0]?.[0]?.id).toBe('req-new');
		expect(next?.pages[1]?.[0]?.id).toBe('req-2');
	});
});
