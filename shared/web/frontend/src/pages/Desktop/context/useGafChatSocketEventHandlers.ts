/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat global socket listeners (leader + BC relay), query invalidation, incoming UX.
 *
 * Invariants:
 * - First connection-restored with initial:true skips chats refetch (shell-bootstrap seed).
 * - Leader posts socket-relay on DESKTOP_REALTIME_BC for follower tabs.
 *
 * Related:
 * - context/GAFChatProvider.tsx
 * - gafChatConnectionRestorePolicy.ts
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */
import { getNotificationStoreRef } from '@/notifications/context';
import type { UgsNotificationBlockSettings } from '@/types/profile';
import { showBrowserNotificationWhenTabHidden } from '@/utils/browserSystemNotification';
import { Services } from '@/services';
import {
	markInvalidationEnd,
	markInvalidationStart,
} from '@/services/communication/desktopRealtimePerfTelemetry';
import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import { useEffect, useCallback, useRef, type RefObject } from 'react';
import type { TFunction } from 'i18next';
import { toast as sonnerToast } from 'sonner';
import {
	requestCloseDesktopVideoCall,
	requestOpenVideoCallWindow,
} from '../utils/desktopDeepLink';
import { gafChatQueryKeys } from '../components/GAFChat/api/gafChatApi';
import { shouldRefetchGafChatsOnConnectionRestored } from '../components/GAFChat/gafChatConnectionRestorePolicy';
import type { GAFMessageItem } from '../components/GAFChat/types';
import {
	appendGafSocketMessageToInfinitePages,
	gafSocketPayloadToMessageItem,
} from '../components/GAFChat/gafChatMessageUtils';
import { gafChatFocusedChatIdRef } from '../components/GAFChat/gafChatFocusedChatRef';
import {
	playGafReceiveOpenThreadSoundNow,
	playGafStandardIncomingBeepNow,
} from '../utils/gafChatUiSounds';
import { endVideoCall } from '../components/VideoCall/api/videoCallApi';
import { videoCallMissedToastMessage } from '../components/GAFChat/gafVideoCallOutgoing';
import { DESKTOP_REALTIME_BC } from '../utils/desktopRealtimeLeader';
import {
	INVALIDATION_DEBOUNCE_MAX_MS,
	INVALIDATION_DEBOUNCE_MS,
	NOTIFY_DEDUPE_MS,
	VIDEO_CALL_ENDED_BROWSER_EVENT,
	type DesktopRealtimeRelayPayload,
	type GafMessageNewPayload,
	type GafNotifyBcPayload,
	type VideoCallIncomingPayload,
} from './gafChatProviderTypes';
import { usePendingIncomingVideoCallPoll } from './usePendingIncomingVideoCallPoll';

/** Dedup socket + pending-incoming HTTP poll for the same call_id. */
const presentedIncomingVideoCallIds = new Set<string>();

type BackgroundRuntimeController = {
	trackBackgroundInvalidation: () => void;
};

type MuteCheckFn = (
	chatId?: string | null,
	senderId?: string | null,
	payloadMuted?: boolean
) => boolean;

export function useGafChatRealtimeRelayChannel(userId: string | undefined) {
	const relayBcRef = useRef<BroadcastChannel | null>(null);

	useEffect(() => {
		if (!userId || typeof BroadcastChannel === 'undefined') {
			relayBcRef.current?.close();
			relayBcRef.current = null;
			return;
		}
		let ch: BroadcastChannel;
		try {
			ch = new BroadcastChannel(DESKTOP_REALTIME_BC);
		} catch {
			return;
		}
		relayBcRef.current = ch;
		return () => {
			ch.close();
			if (relayBcRef.current === ch) {
				relayBcRef.current = null;
			}
		};
	}, [userId]);

	return relayBcRef;
}

export function useGafChatSocketEventHandlers(options: {
	userId: string | undefined;
	isDesktopRealtimeLeader: boolean;
	relayBcRef: RefObject<BroadcastChannel | null>;
	queryClientRef: RefObject<QueryClient>;
	gafUserIdRef: RefObject<string | null>;
	isMutedIncomingChatRef: RefObject<MuteCheckFn>;
	scheduleIncomingSoundRef: RefObject<
		(playFn: () => void | Promise<void>) => void
	>;
	gafIncomingBlockRef: RefObject<UgsNotificationBlockSettings>;
	recentNotifyKeysRef: RefObject<Map<string, number>>;
	notifyBcRef: RefObject<BroadcastChannel | null>;
	pushIncomingMessageNotification: (
		chatId: string,
		preview: string,
		opts: { dedupeKey: string }
	) => void;
	stopVideoCallRing: (callId?: string | null) => void;
	stopOutgoingJoinPoll: (callId?: string | null) => void;
	startVideoCallRing: (callId: string) => void;
	openMeetAfterOutgoingAccepted: (callId: string) => void;
	localOutgoingVideoCallIdsRef: RefObject<Set<string>>;
	runtimeController: BackgroundRuntimeController;
	tRef: RefObject<TFunction<'gafChat'>>;
}) {
	const {
		userId,
		isDesktopRealtimeLeader,
		relayBcRef,
		queryClientRef,
		gafUserIdRef,
		isMutedIncomingChatRef,
		scheduleIncomingSoundRef,
		gafIncomingBlockRef,
		recentNotifyKeysRef,
		notifyBcRef,
		pushIncomingMessageNotification,
		stopVideoCallRing,
		stopOutgoingJoinPoll,
		startVideoCallRing,
		openMeetAfterOutgoingAccepted,
		localOutgoingVideoCallIdsRef,
		runtimeController,
		tRef,
	} = options;

	const onVideoIncomingHandlerRef = useRef<(raw: unknown) => void>(() => {});
	const relayPendingIncoming = useCallback(
		(payload: VideoCallIncomingPayload) => {
			onVideoIncomingHandlerRef.current(payload);
		},
		[]
	);

	usePendingIncomingVideoCallPoll({
		userId,
		isDesktopRealtimeLeader,
		onVideoIncoming: relayPendingIncoming,
	});

	useEffect(() => {
		if (!userId) return;
		const socket = Services.socket;
		const socketOk = Boolean(
			socket && typeof socket.addEventListener === 'function'
		);

		const postRelay = (event: string, payload: unknown) => {
			try {
				relayBcRef.current?.postMessage({
					type: 'socket-relay',
					event,
					payload,
					t: Date.now(),
				} satisfies DesktopRealtimeRelayPayload);
			} catch {
				/* ignore */
			}
		};

		let debounceTimer: number | null = null;
		let pendingDebounceMs = INVALIDATION_DEBOUNCE_MS;
		const pendingMessageChatIds = new Set<string>();

		const flushInvalidations = () => {
			debounceTimer = null;
			pendingDebounceMs = INVALIDATION_DEBOUNCE_MS;
			const qc = queryClientRef.current;
			markInvalidationStart();
			const invalidations: Array<Promise<unknown>> = [
				qc.invalidateQueries({ queryKey: gafChatQueryKeys.chats }),
			];
			if (pendingMessageChatIds.size === 1) {
				const only = pendingMessageChatIds.values().next().value;
				if (only !== undefined) {
					invalidations.push(
						qc.invalidateQueries({
							queryKey: gafChatQueryKeys.messages(only),
						})
					);
				}
			} else if (pendingMessageChatIds.size > 1) {
				for (const chatId of pendingMessageChatIds) {
					invalidations.push(
						qc.invalidateQueries({
							queryKey: gafChatQueryKeys.messages(chatId),
						})
					);
				}
			}
			pendingMessageChatIds.clear();
			void Promise.all(invalidations).finally(() => {
				markInvalidationEnd();
			});
		};

		const scheduleInvalidate = (chatId?: string | null) => {
			if (chatId) {
				pendingMessageChatIds.add(chatId);
			}
			if (
				typeof document !== 'undefined' &&
				document.visibilityState !== 'visible'
			) {
				runtimeController.trackBackgroundInvalidation();
			}
			if (debounceTimer != null) {
				window.clearTimeout(debounceTimer);
				pendingDebounceMs = Math.min(
					pendingDebounceMs * 2,
					INVALIDATION_DEBOUNCE_MAX_MS
				);
			} else {
				pendingDebounceMs = INVALIDATION_DEBOUNCE_MS;
			}
			debounceTimer = window.setTimeout(flushInvalidations, pendingDebounceMs);
		};

		const mergeIncomingMessageIntoCache = (rawUnknown: unknown) => {
			const data = rawUnknown as GafMessageNewPayload | undefined;
			const chatId = data?.chat_id?.trim();
			if (!chatId) return;
			const item = gafSocketPayloadToMessageItem(data ?? {});
			if (!item) return;
			queryClientRef.current.setQueryData<InfiniteData<GAFMessageItem[]>>(
				gafChatQueryKeys.messages(chatId),
				(old) => {
					if (!old) return old;
					const pages = appendGafSocketMessageToInfinitePages(old.pages, item, {
						myUserId: gafUserIdRef.current,
					});
					if (pages === old.pages) return old;
					return { ...old, pages };
				}
			);
		};

		const onMessageNew = (rawUnknown: unknown) => {
			const data = rawUnknown as GafMessageNewPayload | undefined;
			const chatId = data?.chat_id;
			mergeIncomingMessageIntoCache(rawUnknown);
			scheduleInvalidate(chatId ?? undefined);
			const maybeVideoCallMeta = data?.metadata as
				| { kind?: unknown; event?: unknown; call_id?: unknown }
				| null
				| undefined;
			if (
				maybeVideoCallMeta?.kind === 'video_call_event' &&
				['accepted', 'ended', 'missed'].includes(
					String(maybeVideoCallMeta.event || '')
				) &&
				typeof maybeVideoCallMeta.call_id === 'string'
			) {
				stopVideoCallRing(maybeVideoCallMeta.call_id);
			}

			const gid = gafUserIdRef.current;
			const isIncoming =
				data?.sender_id != null && gid != null && data.sender_id !== gid;
			if (!chatId || !isIncoming) return;
			if (
				isMutedIncomingChatRef.current(
					chatId,
					data.sender_id ?? null,
					data?.recipient_is_muted === true
				)
			) {
				return;
			}

			const dedupeKey =
				data.message_id?.trim() ||
				`${chatId}:${data.sender_id ?? ''}:${data.created_at ?? ''}:${(data.body ?? '').slice(0, 64)}`;
			const now = Date.now();
			const map = recentNotifyKeysRef.current;
			const last = map.get(dedupeKey);
			if (last !== undefined && now - last < NOTIFY_DEDUPE_MS) {
				return;
			}
			map.set(dedupeKey, now);
			if (map.size > 80) {
				const first = map.keys().next().value as string | undefined;
				if (first !== undefined) map.delete(first);
			}

			try {
				notifyBcRef.current?.postMessage({
					type: 'gaf-notify',
					dedupeKey,
					t: now,
				} satisfies GafNotifyBcPayload);
			} catch {
				// ignore BC errors
			}

			const incoming = gafIncomingBlockRef.current;
			if (!incoming.enabled) {
				return;
			}
			if (incoming.in_app) {
				const focused = gafChatFocusedChatIdRef.current;
				const playFn =
					focused === chatId
						? playGafReceiveOpenThreadSoundNow
						: playGafStandardIncomingBeepNow;
				scheduleIncomingSoundRef.current(() => void playFn());
			}
			const preview = (data?.body || '').slice(0, 120);
			pushIncomingMessageNotification(chatId, preview, {
				dedupeKey,
			});
		};

		const onChatCreated = (dataUnknown: unknown) => {
			const data = dataUnknown as { chat_id?: string } | undefined;
			scheduleInvalidate(data?.chat_id);
		};

		const onMessageEdited = (dataUnknown: unknown) => {
			const data = dataUnknown as { chat_id: string };
			scheduleInvalidate(data?.chat_id);
		};

		const onMessageDeleted = (dataUnknown: unknown) => {
			const data = dataUnknown as { chat_id: string };
			scheduleInvalidate(data?.chat_id);
		};

		const onMessageRead = (dataUnknown: unknown) => {
			const data = dataUnknown as
				| {
						chat_id?: string;
						user_id?: string;
						up_to_message_id?: string | null;
				  }
				| undefined;
			void data;
			return;
		};

		const onVideoIncoming = (dataUnknown: unknown) => {
			const data = dataUnknown as VideoCallIncomingPayload | undefined;
			const callId = data?.call_id?.trim();
			if (!callId) return;
			const callTarget = String(data?.call_target || 'both')
				.trim()
				.toLowerCase();
			if (callTarget === 'mobile_only') {
				return;
			}
			if (presentedIncomingVideoCallIds.has(callId)) {
				return;
			}
			presentedIncomingVideoCallIds.add(callId);
			const translate = tRef.current;
			const incomingVideoTitle = translate(
				'desktopProcess.incomingVideoCallTitle'
			);
			const incomingVideoMessage = translate(
				'desktopProcess.incomingVideoCallDescription'
			);
			const videoCallWindowTitle = translate('videoCallAppTitle');
			const openCall = () => {
				stopVideoCallRing(callId);
				requestOpenVideoCallWindow({
					videoCallId: callId,
					videoCallTitle: videoCallWindowTitle,
				});
			};
			const declineCall = () => {
				stopVideoCallRing(callId);
				sonnerToast.dismiss(`video-call:${callId}`);
				void endVideoCall(callId).catch(() => {
					sonnerToast.error(translate('desktopProcess.declineCallFailed'));
				});
			};
			const incoming = gafIncomingBlockRef.current;
			startVideoCallRing(callId);
			sonnerToast.info(incomingVideoTitle, {
				description: incomingVideoMessage,
				duration: 60_000,
				id: `video-call:${callId}`,
				action: {
					label: translate('desktopProcess.actionAnswer'),
					onClick: openCall,
				},
				cancel: {
					label: translate('desktopProcess.actionDecline'),
					onClick: declineCall,
				},
			});
			const store = getNotificationStoreRef().current;
			if (store) {
				store.addToCenter({
					type: 'info',
					title: incomingVideoTitle,
					message: incomingVideoMessage,
					openApp: {
						appComponent: 'VideoCallApp',
						videoCallId: callId,
						videoCallTitle: videoCallWindowTitle,
					},
					action: {
						label: translate('desktopProcess.actionAnswer'),
						onClick: openCall,
					},
				});
			}
			if (incoming.enabled && incoming.browser) {
				showBrowserNotificationWhenTabHidden(
					incomingVideoTitle,
					incomingVideoMessage,
					{
						tag: `video-call:${callId}`,
						onClick: openCall,
					}
				);
			}
		};

		onVideoIncomingHandlerRef.current = onVideoIncoming;

		const onVideoEnded = (dataUnknown: unknown) => {
			const data = dataUnknown as
				| {
						call_id?: string;
						missed_reason?: string;
						status?: string;
				  }
				| undefined;
			const callId = data?.call_id?.trim();
			if (!callId) return;
			presentedIncomingVideoCallIds.delete(callId);
			localOutgoingVideoCallIdsRef.current.delete(callId);
			stopVideoCallRing(callId);
			stopOutgoingJoinPoll(callId);
			sonnerToast.dismiss(`video-call:${callId}`);
			sonnerToast.dismiss(`video-call-outgoing:${callId}`);
			requestCloseDesktopVideoCall(callId);
			window.dispatchEvent(
				new CustomEvent(VIDEO_CALL_ENDED_BROWSER_EVENT, {
					detail: { callId },
				})
			);
			sonnerToast.message(
				videoCallMissedToastMessage(
					data?.missed_reason,
					data?.status,
					tRef.current
				),
				{
					id: `video-call-ended:${callId}`,
				}
			);
		};

		const onVideoAccepted = (dataUnknown: unknown) => {
			const data = dataUnknown as
				| { call_id?: string; chat_id?: string | null }
				| undefined;
			const callId = data?.call_id?.trim();
			if (!callId) return;
			openMeetAfterOutgoingAccepted(callId);
		};

		const dispatchRelay = (event: string, payload: unknown) => {
			switch (event) {
				case 'gaf_chat.message_new':
					onMessageNew(payload);
					break;
				case 'gaf_chat.chat_created':
					onChatCreated(payload);
					break;
				case 'gaf_chat.message_edited':
					onMessageEdited(payload);
					break;
				case 'gaf_chat.message_deleted':
					onMessageDeleted(payload);
					break;
				case 'gaf_chat.message_read':
					onMessageRead(payload);
					break;
				case 'video_call.incoming':
					onVideoIncoming(payload);
					break;
				case 'video_call.accepted':
					onVideoAccepted(payload);
					break;
				case 'video_call.ended':
					onVideoEnded(payload);
					break;
				default:
					break;
			}
		};

		const refetchChatsAfterRestore = () => {
			const focused = gafChatFocusedChatIdRef.current?.trim();
			void queryClientRef.current.invalidateQueries({
				queryKey: gafChatQueryKeys.chats,
			});
			if (focused) {
				void queryClientRef.current.invalidateQueries({
					queryKey: gafChatQueryKeys.messages(focused),
				});
			}
		};

		const onWindowOnline = () => {
			refetchChatsAfterRestore();
		};
		window.addEventListener('online', onWindowOnline);

		const noop = () => {};
		let unsubNew = noop;
		let unsubCreated = noop;
		let unsubEdited = noop;
		let unsubDeleted = noop;
		let unsubRead = noop;
		let unsubVideoIncoming = noop;
		let unsubVideoAccepted = noop;
		let unsubVideoEnded = noop;
		let unsubConnectionRestored = noop;

		if (isDesktopRealtimeLeader && socketOk && socket) {
			unsubNew = socket.addEventListener('gaf_chat.message_new', (raw) => {
				postRelay('gaf_chat.message_new', raw);
				onMessageNew(raw);
			});
			unsubCreated = socket.addEventListener('gaf_chat.chat_created', (raw) => {
				postRelay('gaf_chat.chat_created', raw);
				onChatCreated(raw);
			});
			unsubEdited = socket.addEventListener(
				'gaf_chat.message_edited',
				(raw) => {
					postRelay('gaf_chat.message_edited', raw);
					onMessageEdited(raw);
				}
			);
			unsubDeleted = socket.addEventListener(
				'gaf_chat.message_deleted',
				(raw) => {
					postRelay('gaf_chat.message_deleted', raw);
					onMessageDeleted(raw);
				}
			);
			unsubRead = socket.addEventListener('gaf_chat.message_read', (raw) => {
				postRelay('gaf_chat.message_read', raw);
				onMessageRead(raw);
			});
			unsubVideoIncoming = socket.addEventListener(
				'video_call.incoming',
				(raw) => {
					postRelay('video_call.incoming', raw);
					onVideoIncoming(raw);
				}
			);
			unsubVideoAccepted = socket.addEventListener(
				'video_call.accepted',
				(raw) => {
					postRelay('video_call.accepted', raw);
					onVideoAccepted(raw);
				}
			);
			unsubVideoEnded = socket.addEventListener('video_call.ended', (raw) => {
				postRelay('video_call.ended', raw);
				onVideoEnded(raw);
			});
			unsubConnectionRestored = socket.addEventListener(
				'connection-restored',
				(payload) => {
					if (!shouldRefetchGafChatsOnConnectionRestored(payload)) {
						return;
					}
					refetchChatsAfterRestore();
				}
			);
		}

		let onRelayMessage: ((event: MessageEvent) => void) | null = null;
		const relayCh = relayBcRef.current;
		if (!isDesktopRealtimeLeader && relayCh) {
			onRelayMessage = (event: MessageEvent) => {
				const data = event.data as DesktopRealtimeRelayPayload | undefined;
				if (data?.type !== 'socket-relay') return;
				dispatchRelay(data.event, data.payload);
			};
			relayCh.addEventListener('message', onRelayMessage);
		}

		return () => {
			onVideoIncomingHandlerRef.current = () => {};
			if (debounceTimer != null) {
				window.clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			pendingMessageChatIds.clear();
			unsubNew();
			unsubCreated();
			unsubEdited();
			unsubDeleted();
			unsubRead();
			unsubVideoIncoming();
			unsubVideoAccepted();
			unsubVideoEnded();
			unsubConnectionRestored();
			window.removeEventListener('online', onWindowOnline);
			if (relayCh && onRelayMessage) {
				relayCh.removeEventListener('message', onRelayMessage);
			}
		};
	}, [
		isDesktopRealtimeLeader,
		openMeetAfterOutgoingAccepted,
		pushIncomingMessageNotification,
		runtimeController,
		startVideoCallRing,
		stopOutgoingJoinPoll,
		stopVideoCallRing,
		userId,
		relayBcRef,
		queryClientRef,
		gafUserIdRef,
		isMutedIncomingChatRef,
		scheduleIncomingSoundRef,
		gafIncomingBlockRef,
		recentNotifyKeysRef,
		notifyBcRef,
		localOutgoingVideoCallIdsRef,
		tRef,
	]);
}
