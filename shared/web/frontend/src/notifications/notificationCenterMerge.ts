/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge local notification rows with the server inbox snapshot and serialize PUT/GET payloads.
 *
 * Invariants:
 * - Union by id; newer timestamp wins fields; read/persistent are OR; cap 200.
 * - Tombstoned ids must be dropped before the merged list is shown or PUT.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
 */

import type { Notification, NotificationType } from './types';

const MAX = 200;

export type NotificationCenterApiItem = {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	timestamp: string;
	read: boolean;
	persistent?: boolean | null;
	source?: string | null;
	expiresAt?: string | null;
};

function mergePair(a: Notification, b: Notification): Notification {
	const ta = a.timestamp.getTime();
	const tb = b.timestamp.getTime();
	const primary = ta >= tb ? a : b;
	const secondary = ta >= tb ? b : a;
	return {
		...primary,
		read: a.read || b.read,
		persistent: Boolean(a.persistent || b.persistent),
		serverActions: primary.serverActions?.length
			? primary.serverActions
			: secondary.serverActions,
		metadata: primary.metadata ?? secondary.metadata,
	};
}

/** Union by id; newer timestamp wins fields; read if either read; max 200 by recency. */
export function mergeNotificationLists(
	local: Notification[],
	server: Notification[]
): Notification[] {
	const map = new Map<string, Notification>();
	for (const n of server) {
		const prev = map.get(n.id);
		map.set(n.id, prev ? mergePair(prev, n) : n);
	}
	for (const n of local) {
		const prev = map.get(n.id);
		map.set(n.id, prev ? mergePair(prev, n) : n);
	}
	return Array.from(map.values())
		.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
		.slice(0, MAX);
}

export function dropDismissedNotificationIds<T extends { id: string }>(
	rows: T[],
	dismissed: Iterable<string>
): T[] {
	const drop = new Set(dismissed);
	if (drop.size === 0) {
		return rows;
	}
	return rows.filter((row) => !drop.has(row.id));
}

/** Union local ∪ server, then drop server tombstones and in-session pending dismissals. */
export function mergeInboxSnapshot(
	local: Notification[],
	server: Notification[],
	serverDismissedIds: Iterable<string>,
	pendingDismissedIds: Iterable<string>
): Notification[] {
	return dropDismissedNotificationIds(mergeNotificationLists(local, server), [
		...serverDismissedIds,
		...pendingDismissedIds,
	]);
}

export type InboxGetApplyResult = {
	notifications: Notification[];
	/** GET is not a PUT confirmation; caller must not treat this as lastSentHash. */
	lastSentHash: null;
};

export function applyNotificationCenterGetSnapshot(
	local: Notification[],
	server: Notification[],
	serverDismissedIds: Iterable<string>,
	pendingDismissedIds: Iterable<string>
): InboxGetApplyResult {
	return {
		notifications: mergeInboxSnapshot(
			local,
			server,
			serverDismissedIds,
			pendingDismissedIds
		),
		lastSentHash: null,
	};
}

export function apiItemsToNotifications(
	items: NotificationCenterApiItem[]
): Notification[] {
	const now = Date.now();
	const out: Notification[] = [];
	for (const row of items) {
		const ts = new Date(row.timestamp);
		if (Number.isNaN(ts.getTime())) continue;
		const expiresAt = row.expiresAt ? new Date(row.expiresAt) : undefined;
		if (expiresAt && expiresAt.getTime() <= now) continue;
		out.push({
			id: row.id,
			type: row.type,
			title: row.title,
			message: row.message,
			timestamp: ts,
			read: row.read,
			persistent: row.persistent ?? undefined,
			source: row.source ?? undefined,
			expiresAt,
		});
	}
	return out;
}

export function notificationsToApiPayload(
	items: Notification[]
): NotificationCenterApiItem[] {
	return items.slice(0, MAX).map((n) => ({
		id: n.id,
		type: n.type,
		title: n.title,
		message: n.message,
		timestamp: n.timestamp.toISOString(),
		read: n.read,
		persistent: n.persistent ?? false,
		source: n.source ?? null,
		expiresAt: n.expiresAt?.toISOString() ?? null,
	}));
}

export function notificationCenterPayloadHash(items: Notification[]): string {
	return JSON.stringify(notificationsToApiPayload(items));
}
