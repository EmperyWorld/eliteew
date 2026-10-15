/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Incoming GAF message notification prefs, dedupe BC, deferred sounds, toast/browser push.
 *
 * Invariants:
 * - Foreground Sonner uses stable id per chatId; background uses dedupe key id.
 * - NOTIFY_DEDUPE_MS shared across tabs via eliteew-gaf-chat-notify-v1 BC.
 *
 * Related:
 * - context/GAFChatProvider.tsx
 * - context/useGafChatSocketEventHandlers.ts
 */
import { getNotificationStoreRef } from '@/notifications/context';
import {
	DEFAULT_GAF_NOTIFICATION_PREFERENCES,
	type UgsNotificationBlockSettings,
} from '@/types/profile';
import { showBrowserNotificationWhenTabHidden } from '@/utils/browserSystemNotification';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast as sonnerToast } from 'sonner';
import { requestOpenDesktopApp } from '../utils/desktopDeepLink';
import { subscribeDocumentVisibleSync } from '../utils/subscribeDocumentVisibleSync';
import { GAF_NOTIFY_BC, type GafNotifyBcPayload } from './gafChatProviderTypes';

export function resolveGafIncomingBlock(
	raw: UgsNotificationBlockSettings | undefined
): UgsNotificationBlockSettings {
	return {
		enabled: raw?.enabled !== false,
		in_app: raw?.in_app !== false,
		browser: raw?.browser === true,
	};
}

export function useGafIncomingMessageNotifications(options: {
	userId: string | undefined;
	gafUserId: string | null;
	gafIncomingBlock: UgsNotificationBlockSettings;
}) {
	const { userId, gafUserId, gafIncomingBlock } = options;
	const { t } = useTranslation('gafChat');

	const gafIncomingBlockRef = useRef(gafIncomingBlock);
	gafIncomingBlockRef.current = gafIncomingBlock;

	const pendingIncomingSoundRef = useRef<(() => void) | null>(null);
	const recentNotifyKeysRef = useRef<Map<string, number>>(new Map());
	const notifyBcRef = useRef<BroadcastChannel | null>(null);

	const scheduleIncomingSound = useCallback(
		(playFn: () => void | Promise<void>) => {
			if (!gafUserId || typeof window === 'undefined') return;
			if (typeof document === 'undefined') {
				void Promise.resolve(playFn());
				return;
			}
			if (document.visibilityState === 'visible') {
				pendingIncomingSoundRef.current = null;
				void Promise.resolve(playFn());
				return;
			}
			pendingIncomingSoundRef.current = () => {
				void Promise.resolve(playFn());
			};
		},
		[gafUserId]
	);

	const scheduleIncomingSoundRef = useRef(scheduleIncomingSound);
	scheduleIncomingSoundRef.current = scheduleIncomingSound;

	useEffect(() => {
		return subscribeDocumentVisibleSync(() => {
			const pending = pendingIncomingSoundRef.current;
			if (!pending) return;
			pendingIncomingSoundRef.current = null;
			pending();
		});
	}, []);

	useEffect(() => {
		if (!userId || typeof BroadcastChannel === 'undefined') {
			notifyBcRef.current?.close();
			notifyBcRef.current = null;
			return;
		}
		let ch: BroadcastChannel;
		try {
			ch = new BroadcastChannel(GAF_NOTIFY_BC);
		} catch {
			return;
		}
		notifyBcRef.current = ch;
		const onMsg = (e: MessageEvent) => {
			const d = e.data as Partial<GafNotifyBcPayload> | undefined;
			if (d?.type !== 'gaf-notify' || typeof d.dedupeKey !== 'string') {
				return;
			}
			const msgTime = typeof d.t === 'number' ? d.t : Date.now();
			const map = recentNotifyKeysRef.current;
			map.set(d.dedupeKey, msgTime);
			if (map.size > 80) {
				const first = map.keys().next().value as string | undefined;
				if (first !== undefined) map.delete(first);
			}
		};
		ch.addEventListener('message', onMsg);
		return () => {
			ch.removeEventListener('message', onMsg);
			ch.close();
			if (notifyBcRef.current === ch) {
				notifyBcRef.current = null;
			}
		};
	}, [userId]);

	const pushIncomingMessageNotification = useCallback(
		(chatId: string, preview: string, opts: { dedupeKey: string }) => {
			const b = gafIncomingBlockRef.current;
			if (!b.enabled) {
				return;
			}

			const title = t('desktopProcess.incomingMessageTitle');
			const message = preview || t('desktopProcess.incomingMessageFallback');
			const inForeground =
				typeof document !== 'undefined' &&
				document.visibilityState === 'visible';

			if (b.in_app) {
				const toastId = inForeground
					? `gaf-chat-foreground:${chatId}`
					: `gaf-chat:${opts.dedupeKey}`;
				const openChat = () => {
					requestOpenDesktopApp({
						appComponent: 'GAFChatApp',
						targetChatId: chatId,
					});
				};
				sonnerToast.info(title, {
					description: message,
					duration: 4000,
					id: toastId,
					action: {
						label: t('desktopProcess.actionOpen'),
						onClick: openChat,
					},
				});
				const store = getNotificationStoreRef().current;
				if (store) {
					store.addToCenter({
						type: 'info',
						title,
						message,
						openApp: {
							appComponent: 'GAFChatApp',
							targetChatId: chatId,
						},
						action: {
							label: t('desktopProcess.actionOpenChat'),
							onClick: openChat,
						},
					});
				}
			}

			if (b.browser) {
				showBrowserNotificationWhenTabHidden(title, message, {
					tag: `gaf-chat:${opts.dedupeKey}`,
					onClick: () => {
						requestOpenDesktopApp({
							appComponent: 'GAFChatApp',
							targetChatId: chatId,
						});
					},
				});
			}
		},
		[t]
	);

	const clearIncomingNotificationState = useCallback(() => {
		pendingIncomingSoundRef.current = null;
		recentNotifyKeysRef.current.clear();
	}, []);

	return {
		gafIncomingBlockRef,
		recentNotifyKeysRef,
		notifyBcRef,
		scheduleIncomingSound,
		scheduleIncomingSoundRef,
		pushIncomingMessageNotification,
		clearIncomingNotificationState,
	};
}

export { DEFAULT_GAF_NOTIFICATION_PREFERENCES };
