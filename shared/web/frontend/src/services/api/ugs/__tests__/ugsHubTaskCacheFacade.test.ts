/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
	mergeUgsHubPollPage,
	mergeUgsHubTasksPoll,
	patchUgsHubTasksFromStream,
} from '../ugsHubTaskCacheFacade';
import type { UGSTask } from '../types';

describe('ugsHubTaskCacheFacade', () => {
	it('preserves SSE progress after compact poll merge (stream → poll boundary)', () => {
		const queryClient = new QueryClient();
		const key = [
			'ugs',
			'tasks',
			{ limit: 100, offset: 0, infinite: true },
		] as const;
		const seedTask: UGSTask = {
			id: 'req-stream',
			type_key: 'image_banner',
			status: 'pending',
			created_at: '2026-05-27T10:00:00Z',
			updated_at: '2026-05-27T10:00:00Z',
			user_id: 'u1',
			priority: 5,
		};
		queryClient.setQueryData(key, [seedTask]);

		patchUgsHubTasksFromStream(queryClient, {
			request_id: 'req-stream',
			status: 'processing',
			progress: 55,
			progress_message: 'Upscaling',
			timestamp: '2026-05-27T10:05:00Z',
		});

		const afterStream = queryClient.getQueryData<UGSTask[]>(key);
		expect(afterStream?.[0]?.progress).toBe(55);

		const compactPoll: UGSTask[] = [
			{
				...seedTask,
				status: 'pending',
				updated_at: '2026-05-27T10:04:00Z',
			},
		];
		const merged = mergeUgsHubTasksPoll(afterStream ?? [], compactPoll);
		expect(merged[0]?.status).toBe('processing');
		expect(merged[0]?.progress).toBe(55);
		expect(merged[0]?.progress_message).toBe('Upscaling');
	});

	it('mergeUgsHubPollPage applies poll merge for infinite query pages', () => {
		const previousSlice: UGSTask[] = [
			{
				id: 'req-page',
				type_key: 'text_chat',
				status: 'processing',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:05:00Z',
				user_id: 'u1',
				priority: 5,
				progress: 40,
			},
		];
		const incomingPage: UGSTask[] = [
			{
				id: 'req-page',
				type_key: 'text_chat',
				status: 'pending',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:04:00Z',
				user_id: 'u1',
				priority: 5,
			},
		];

		const merged = mergeUgsHubPollPage(previousSlice, incomingPage);
		expect(merged[0]?.progress).toBe(40);
		expect(merged[0]?.status).toBe('processing');
	});
});
