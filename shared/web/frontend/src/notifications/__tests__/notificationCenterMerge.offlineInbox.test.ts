/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: GET snapshot rows that never arrived over the socket still survive local merge.
 *
 * Invariants:
 * - Server-only ids remain after merge with a stale/empty local list.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
 */

import { describe, expect, it } from 'vitest';
import {
	apiItemsToNotifications,
	applyNotificationCenterGetSnapshot,
	dropDismissedNotificationIds,
	mergeNotificationLists,
} from '../notificationCenterMerge';
import type { Notification } from '../types';

function localRow(id: string, iso: string, title: string): Notification {
	return {
		id,
		type: 'info',
		title,
		message: 'local',
		timestamp: new Date(iso),
		read: false,
		persistent: true,
		source: 'ugs',
	};
}

describe('notification center merge (server persist / offline GET)', () => {
	it('keeps a server-only inbox row when local store never saw the socket event', () => {
		const server = apiItemsToNotifications([
			{
				id: 'ugs_done_offline',
				type: 'success',
				title: 'UGS: Image',
				message: 'Генерация завершена',
				timestamp: '2026-08-17T12:00:00.000Z',
				read: false,
				persistent: true,
				source: 'ugs',
				expiresAt: null,
			},
		]);
		const merged = mergeNotificationLists([], server);
		expect(merged.map((row) => row.id)).toEqual(['ugs_done_offline']);
		expect(merged[0]?.title).toBe('UGS: Image');
	});

	it('does not drop a newer server row when local snapshot is stale', () => {
		const local = [
			localRow('older_local', '2026-08-17T11:00:00.000Z', 'Old local'),
		];
		const server = apiItemsToNotifications([
			{
				id: 'friend_request_offline',
				type: 'info',
				title: 'Новый запрос в друзья',
				message: 'Alice отправил вам запрос в друзья.',
				timestamp: '2026-08-17T12:30:00.000Z',
				read: false,
				persistent: true,
				source: 'friends',
				expiresAt: null,
			},
		]);
		const merged = mergeNotificationLists(local, server);
		expect(merged.map((row) => row.id)).toEqual([
			'friend_request_offline',
			'older_local',
		]);
	});

	it('drops locally dismissed ids so a later GET cannot revive them in-session', () => {
		const server = apiItemsToNotifications([
			{
				id: 'dismissed_offline',
				type: 'info',
				title: 'Gone',
				message: 'should not return',
				timestamp: '2026-08-17T12:00:00.000Z',
				read: false,
				persistent: true,
				source: 'ugs',
				expiresAt: null,
			},
			{
				id: 'keep_offline',
				type: 'info',
				title: 'Keep',
				message: 'still here',
				timestamp: '2026-08-17T12:01:00.000Z',
				read: false,
				persistent: true,
				source: 'ugs',
				expiresAt: null,
			},
		]);
		const merged = dropDismissedNotificationIds(server, ['dismissed_offline']);
		expect(merged.map((row) => row.id)).toEqual(['keep_offline']);
	});

	it('drops a localStorage row when GET returns that id in dismissed_ids', () => {
		const local = [
			localRow('dismissed_offline', '2026-08-17T12:00:00.000Z', 'Gone'),
			localRow('keep_offline', '2026-08-17T12:01:00.000Z', 'Keep'),
		];
		const applied = applyNotificationCenterGetSnapshot(
			local,
			apiItemsToNotifications([
				{
					id: 'keep_offline',
					type: 'info',
					title: 'Keep',
					message: 'local',
					timestamp: '2026-08-17T12:01:00.000Z',
					read: false,
					persistent: true,
					source: 'ugs',
					expiresAt: null,
				},
			]),
			['dismissed_offline'],
			[]
		);
		expect(applied.notifications.map((row) => row.id)).toEqual([
			'keep_offline',
		]);
		expect(applied.lastSentHash).toBeNull();
	});
});
