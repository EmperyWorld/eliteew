/**
 * localStorage persistence for notification center rows (no ReactNode icons/actions).
 */

import { STORAGE_KEYS } from '@/pages/Desktop/constants';
import type {
	Notification,
	NotificationType,
	ServerNotificationAction,
} from './types';

type PersistedRow = {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	timestamp: string;
	read: boolean;
	persistent?: boolean;
	source?: string;
	expiresAt?: string;
	serverActions?: ServerNotificationAction[];
	metadata?: Record<string, unknown>;
};

type PersistedPayload = { v: number; items: PersistedRow[] };

export function loadPersistedNotifications(): Notification[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_CENTER);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as PersistedPayload;
		if (!parsed?.items?.length) return [];
		const now = Date.now();
		return parsed.items
			.map((row): Notification | null => {
				const expiresAt = row.expiresAt ? new Date(row.expiresAt) : undefined;
				if (expiresAt && expiresAt.getTime() <= now) return null;
				const ts = new Date(row.timestamp);
				if (Number.isNaN(ts.getTime())) return null;
				return {
					id: row.id,
					type: row.type,
					title: row.title,
					message: row.message,
					timestamp: ts,
					read: row.read,
					persistent: row.persistent,
					source: row.source,
					expiresAt,
					...(row.serverActions?.length
						? { serverActions: row.serverActions }
						: {}),
					...(row.metadata && Object.keys(row.metadata).length
						? { metadata: row.metadata }
						: {}),
				};
			})
			.filter((n): n is Notification => n !== null);
	} catch {
		return [];
	}
}

export function persistNotificationsToStorage(items: Notification[]): void {
	try {
		const rows: PersistedRow[] = items.map((n) => ({
			id: n.id,
			type: n.type,
			title: n.title,
			message: n.message,
			timestamp: n.timestamp.toISOString(),
			read: n.read,
			persistent: n.persistent,
			source: n.source,
			expiresAt: n.expiresAt?.toISOString(),
			...(n.serverActions?.length ? { serverActions: n.serverActions } : {}),
			...(n.metadata && Object.keys(n.metadata).length
				? { metadata: n.metadata }
				: {}),
		}));
		localStorage.setItem(
			STORAGE_KEYS.NOTIFICATION_CENTER,
			JSON.stringify({ v: 1, items: rows } satisfies PersistedPayload)
		);
	} catch {
		// quota / private mode
	}
}

export function clearPersistedNotifications(): void {
	try {
		localStorage.removeItem(STORAGE_KEYS.NOTIFICATION_CENTER);
	} catch {
		// ignore
	}
}
