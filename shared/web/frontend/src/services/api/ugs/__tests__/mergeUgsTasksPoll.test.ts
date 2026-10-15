/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for merging polled UGS task rows with richer realtime/cache rows.
 *
 * Invariants:
 * - Compact polling must not erase fresher progress or heavy retry/result fields.
 * - Newer terminal poll rows still win status/progress.
 *
 * Related:
 * - src/services/api/ugs/taskRealtime.ts
 */

import { describe, expect, it } from 'vitest';

import { mergeUgsTasksPoll } from '../taskRealtime';
import type { UGSTask } from '../types';

describe('mergeUgsTasksPoll', () => {
	it('preserves fresher SSE progress when compact poll strips fields', () => {
		const previous: UGSTask[] = [
			{
				id: 'req-1',
				type_key: 'image_banner',
				status: 'processing',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:05:00Z',
				user_id: 'u1',
				priority: 5,
				progress: 72,
				stage: 'render',
				progress_message: 'Rendering',
				last_heartbeat_at: '2026-05-27T10:05:00Z',
			},
		];
		const incoming: UGSTask[] = [
			{
				id: 'req-1',
				type_key: 'image_banner',
				status: 'pending',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:04:00Z',
				user_id: 'u1',
				priority: 5,
			},
		];

		const merged = mergeUgsTasksPoll(previous, incoming);
		expect(merged[0]?.status).toBe('processing');
		expect(merged[0]?.progress).toBe(72);
		expect(merged[0]?.progress_message).toBe('Rendering');
		expect(merged[0]?.last_heartbeat_at).toBe('2026-05-27T10:05:00Z');
	});

	it('accepts newer polled terminal status', () => {
		const previous: UGSTask[] = [
			{
				id: 'req-2',
				type_key: 'text_chat',
				status: 'processing',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:05:00Z',
				user_id: 'u1',
				priority: 5,
				progress: 90,
			},
		];
		const incoming: UGSTask[] = [
			{
				id: 'req-2',
				type_key: 'text_chat',
				status: 'completed',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:06:00Z',
				user_id: 'u1',
				priority: 5,
				progress: 100,
			},
		];

		const merged = mergeUgsTasksPoll(previous, incoming);
		expect(merged[0]?.status).toBe('completed');
		expect(merged[0]?.progress).toBe(100);
	});

	it('preserves heavy cached fields when compact poll omits them', () => {
		const previous: UGSTask[] = [
			{
				id: 'req-3',
				type_key: 'text_chat',
				status: 'processing',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:05:00Z',
				user_id: 'u1',
				priority: 5,
				input_data: { prompt: 'retry me' },
				result: { text: 'partial' },
				metadata: { source: 'sse' },
			},
		];
		const incoming: UGSTask[] = [
			{
				id: 'req-3',
				type_key: 'text_chat',
				status: 'processing',
				created_at: '2026-05-27T10:00:00Z',
				updated_at: '2026-05-27T10:04:00Z',
				user_id: 'u1',
				priority: 5,
				input_data: null,
				result: null,
				metadata: null,
			},
		];

		const merged = mergeUgsTasksPoll(previous, incoming);
		expect(merged[0]?.input_data).toEqual({ prompt: 'retry me' });
		expect(merged[0]?.result).toEqual({ text: 'partial' });
		expect(merged[0]?.metadata).toEqual({ source: 'sse' });
	});
});
