import type { Notification } from '@/notifications';

/** Serializable snapshot for export (no React nodes or functions). */
export function notificationsToExportPayload(items: Notification[]) {
	return {
		exportedAt: new Date().toISOString(),
		count: items.length,
		items: items.map((n) => ({
			id: n.id,
			type: n.type,
			title: n.title,
			message: n.message,
			timestamp: n.timestamp.toISOString(),
			read: n.read,
			persistent: n.persistent,
			source: n.source,
			expiresAt: n.expiresAt?.toISOString(),
		})),
	};
}

export function downloadNotificationsJson(items: Notification[]): void {
	const payload = notificationsToExportPayload(items);
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: 'application/json',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `notifications-${new Date().toISOString().slice(0, 10)}.json`;
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
