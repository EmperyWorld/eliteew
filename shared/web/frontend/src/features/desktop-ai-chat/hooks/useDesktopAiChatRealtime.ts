/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Socket.IO room join/leave and inbound fan-out for shared Desktop AI Chat collaboration.
 *
 * Invariants:
 * - Join when activeChatId is set and socket becomes connected (late-connect safe).
 * - No live SSE token fan-out — peers get message_new DTOs + turn_done reconcile.
 *
 * Related:
 * - hooks/useDesktopAiChatCollab.ts, types/desktopAiChatRealtimeTypes.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
 */
import { Services } from '@/services';
import { useSocketConnectionState } from '@/services/communication/socketConnectionStore';
import * as React from 'react';
import type { DesktopAiMessage } from '../api/desktopChatClient';
import {
	DESKTOP_AI_CHAT_SOCKET,
	isDesktopAiChatMemberChangedPayload,
	isDesktopAiChatMessageNewPayload,
	isDesktopAiChatTurnEventPayload,
	type DesktopAiChatMemberChangedPayload,
} from '../types/desktopAiChatRealtimeTypes';

export type UseDesktopAiChatRealtimeParams = {
	activeChatId: string | null;
	currentUserId: string | null;
	sending: boolean;
	armStreamLockPoll: () => void;
	onRemoteTurnDone: () => void;
	onMemberChanged: (payload: DesktopAiChatMemberChangedPayload) => void;
	onRemoteMessage: (message: DesktopAiMessage) => void;
};

export function useDesktopAiChatRealtime({
	activeChatId,
	currentUserId,
	sending,
	armStreamLockPoll,
	onRemoteTurnDone,
	onMemberChanged,
	onRemoteMessage,
}: UseDesktopAiChatRealtimeParams): void {
	const { connected: socketConnected } = useSocketConnectionState();
	const joinedChatRef = React.useRef<string | null>(null);
	const armStreamLockPollRef = React.useRef(armStreamLockPoll);
	const onRemoteTurnDoneRef = React.useRef(onRemoteTurnDone);
	const onMemberChangedRef = React.useRef(onMemberChanged);
	const onRemoteMessageRef = React.useRef(onRemoteMessage);
	const sendingRef = React.useRef(sending);
	const currentUserIdRef = React.useRef(currentUserId);
	const activeChatIdRef = React.useRef(activeChatId);

	React.useEffect(() => {
		armStreamLockPollRef.current = armStreamLockPoll;
		onRemoteTurnDoneRef.current = onRemoteTurnDone;
		onMemberChangedRef.current = onMemberChanged;
		onRemoteMessageRef.current = onRemoteMessage;
		sendingRef.current = sending;
		currentUserIdRef.current = currentUserId;
		activeChatIdRef.current = activeChatId;
	}, [
		activeChatId,
		armStreamLockPoll,
		currentUserId,
		onMemberChanged,
		onRemoteMessage,
		onRemoteTurnDone,
		sending,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: socketConnected re-runs join when late-connect completes (connection-restored alone is not enough on first mount)
	React.useEffect(() => {
		const socketService = Services.socket;
		if (!socketService) return;

		const client = socketService.getClientSocket?.();

		const emitLeave = (chatId: string): void => {
			client?.emit(DESKTOP_AI_CHAT_SOCKET.LEAVE, { chat_id: chatId });
		};

		const emitJoin = (): void => {
			const chatId = activeChatIdRef.current;
			if (!chatId) return;
			if (!socketService.isConnected?.()) return;
			const liveClient = socketService.getClientSocket?.();
			if (!liveClient) return;
			if (joinedChatRef.current && joinedChatRef.current !== chatId) {
				liveClient.emit(DESKTOP_AI_CHAT_SOCKET.LEAVE, {
					chat_id: joinedChatRef.current,
				});
			}
			liveClient.emit(DESKTOP_AI_CHAT_SOCKET.JOIN, { chat_id: chatId });
			joinedChatRef.current = chatId;
		};

		if (!activeChatId) {
			if (joinedChatRef.current) {
				emitLeave(joinedChatRef.current);
				joinedChatRef.current = null;
			}
			return;
		}

		const unsubTurnStarted = socketService.addEventListener(
			DESKTOP_AI_CHAT_SOCKET.TURN_STARTED,
			(data: unknown) => {
				if (!isDesktopAiChatTurnEventPayload(data)) return;
				if (data.chat_id !== activeChatIdRef.current) return;
				const selfId = currentUserIdRef.current;
				if (selfId && data.actor_user_id !== selfId) {
					armStreamLockPollRef.current();
				}
			}
		);

		const unsubTurnDone = socketService.addEventListener(
			DESKTOP_AI_CHAT_SOCKET.TURN_DONE,
			(data: unknown) => {
				if (!isDesktopAiChatTurnEventPayload(data)) return;
				if (data.chat_id !== activeChatIdRef.current) return;
				const selfId = currentUserIdRef.current;
				if (selfId && data.actor_user_id === selfId && sendingRef.current) {
					return;
				}
				onRemoteTurnDoneRef.current();
			}
		);

		const unsubMessageNew = socketService.addEventListener(
			DESKTOP_AI_CHAT_SOCKET.MESSAGE_NEW,
			(data: unknown) => {
				if (!isDesktopAiChatMessageNewPayload(data)) return;
				if (data.chat_id !== activeChatIdRef.current) return;
				onRemoteMessageRef.current(data.message);
			}
		);

		const unsubMemberChanged = socketService.addEventListener(
			DESKTOP_AI_CHAT_SOCKET.MEMBER_CHANGED,
			(data: unknown) => {
				if (!isDesktopAiChatMemberChangedPayload(data)) return;
				const active = activeChatIdRef.current;
				const selfId = currentUserIdRef.current;
				const targetsActive = Boolean(active && data.chat_id === active);
				const targetsSelf =
					Boolean(selfId) &&
					(data.target_user_id === selfId || data.actor_user_id === selfId);
				if (!targetsActive && !targetsSelf) return;
				onMemberChangedRef.current(data);
			}
		);

		const unsubRestored = socketService.addEventListener(
			'connection-restored',
			() => {
				emitJoin();
			}
		);

		emitJoin();

		return () => {
			unsubTurnStarted();
			unsubTurnDone();
			unsubMessageNew();
			unsubMemberChanged();
			unsubRestored();
			if (joinedChatRef.current === activeChatId) {
				emitLeave(activeChatId);
				joinedChatRef.current = null;
			}
		};
	}, [activeChatId, socketConnected]);
}
