/**
 * Sonner toast with inline buttons for doc collaboration invites (center hub also has rows).
 */

import { useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import type { NotificationEvent } from '@/services/communication/EmperyworldSocketService';
import { executeServerNotificationAction } from './executeServerNotificationAction';
import type { Notification, NotificationType } from './types';

function toNotification(
	event: NotificationEvent,
	level: NotificationType,
	serverActions: Array<{ label: string; action: string }>,
	metaObj: Record<string, unknown>
): Notification {
	return {
		id: event.id,
		type: level,
		title: event.title,
		message: event.message,
		timestamp: new Date(),
		read: false,
		source: event.source ?? 'server',
		persistent: event.persistent,
		serverActions,
		metadata: metaObj,
	};
}

function DocCollabToastBody({
	tid,
	title,
	message,
	serverActions,
	notification,
}: {
	tid: string | number;
	title: string;
	message: string;
	serverActions: Array<{ label: string; action: string }>;
	notification: Notification;
}) {
	const [busy, setBusy] = useState<string | null>(null);
	return (
		<div className="flex min-w-[min(100vw-2rem,22rem)] max-w-[min(100vw-2rem,26rem)] flex-col gap-2 text-left">
			<div className="text-sm font-medium leading-snug text-slate-50">
				{title}
			</div>
			{message ? (
				<div className="text-xs leading-snug text-slate-300">{message}</div>
			) : null}
			<div className="mt-1 flex flex-wrap gap-2">
				{serverActions.map((sa) => {
					const isPrimary = sa.action === 'doc_collab_invite_accept';
					return (
						<button
							key={sa.action}
							type="button"
							disabled={busy !== null}
							className={
								isPrimary
									? 'rounded-full bg-sky-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50'
									: 'rounded-full border border-white/15 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700/90 disabled:opacity-50'
							}
							onClick={() => {
								if (busy) return;
								setBusy(sa.action);
								void (async () => {
									try {
										await executeServerNotificationAction(
											notification,
											sa.action
										);
										sonnerToast.dismiss(tid);
									} finally {
										setBusy(null);
									}
								})();
							}}
						>
							{busy === sa.action ? '…' : sa.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function showDocCollabInviteToast(opts: {
	level: NotificationType;
	event: NotificationEvent;
	serverActions: Array<{ label: string; action: string }>;
	metaObj: Record<string, unknown>;
}): void {
	const { level, event, serverActions, metaObj } = opts;
	const notification = toNotification(event, level, serverActions, metaObj);
	sonnerToast.custom(
		(tid) => (
			<DocCollabToastBody
				tid={tid}
				title={event.title}
				message={event.message}
				serverActions={serverActions}
				notification={notification}
			/>
		),
		{
			id: event.id,
			duration: Number.POSITIVE_INFINITY,
			classNames: {
				toast:
					'items-start !rounded-2xl !border !border-sky-400/40 !bg-slate-950/90 !px-4 !py-3.5 !backdrop-blur-xl',
			},
		}
	);
}
