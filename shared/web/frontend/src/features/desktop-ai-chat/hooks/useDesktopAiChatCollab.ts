/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collaboration UX state: pending invites inbox, members panel, leave confirm, stream-lock poll arming.
 *
 * Invariants:
 * - Pending invites refresh after accept/decline and on list refresh.
 *
 * Related:
 * - components/DesktopAiChatMembersPanel.tsx, DesktopAiChatSidebar.tsx
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import {
	acceptDesktopAiChatInvite,
	declineDesktopAiChatInvite,
	leaveDesktopAiChat,
	listDesktopAiChatPendingInvites,
	type DesktopAiChatItem,
	type DesktopAiChatMember,
} from '../api/desktopChatClient';
import type { DesktopAiChatPanelPrefs } from '../app/desktopAiChatAppPrefs';
import { removeChatFromLocalList } from '../utils/desktopChatCollabLocal';
import { useDesktopAiChatStreamLockPoll } from './useDesktopAiChatStreamLockPoll';
import { writeChatPins } from '../utils/desktopAiChatPins';
import { removeChatDraft } from '../utils/desktopAiChatDraft';

export const DESKTOP_AI_CHAT_ME_QUERY_KEY = ['desktop-ai-chat', 'me'] as const;

export type UseDesktopAiChatCollabParams = {
	t: TFunction<'desktopAiChat'>;
	activeId: string | null;
	sending: boolean;
	streamLockForcePoll: boolean;
	/** DB users.id from GET /desktop/ai-chat/me */
	currentUserId: string | null;
	setChats: React.Dispatch<React.SetStateAction<DesktopAiChatItem[]>>;
	setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
	setChatPins: React.Dispatch<React.SetStateAction<string[]>>;
	setPanelPrefsByChatId: React.Dispatch<
		React.SetStateAction<Record<string, DesktopAiChatPanelPrefs>>
	>;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	abortActiveStream: () => void;
	refreshAll: () => Promise<void>;
};

export function useDesktopAiChatCollab({
	t,
	activeId,
	sending,
	streamLockForcePoll,
	currentUserId,
	setChats,
	setActiveId,
	setChatPins,
	setPanelPrefsByChatId,
	setInput,
	abortActiveStream,
	refreshAll,
}: UseDesktopAiChatCollabParams) {
	const { lockedByOther, armStreamLockPoll } = useDesktopAiChatStreamLockPoll({
		chatId: activeId,
		currentUserId,
		sending,
		forcePoll: streamLockForcePoll,
	});

	const [pendingInvites, setPendingInvites] = React.useState<
		DesktopAiChatMember[]
	>([]);
	const [pendingInvitesLoading, setPendingInvitesLoading] =
		React.useState(false);
	const [membersPanelOpen, setMembersPanelOpen] = React.useState(false);
	const [leaveConfirmOpen, setLeaveConfirmOpen] = React.useState(false);
	const [leaveBusy, setLeaveBusy] = React.useState(false);
	const [inviteActionBusyId, setInviteActionBusyId] = React.useState<
		string | null
	>(null);

	const refreshPendingInvites = React.useCallback(async () => {
		setPendingInvitesLoading(true);
		try {
			const items = await listDesktopAiChatPendingInvites();
			setPendingInvites(items);
		} catch {
			/* inbox optional degrade */
		} finally {
			setPendingInvitesLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void refreshPendingInvites();
	}, [refreshPendingInvites]);

	const teardownChatLocally = React.useCallback(
		(chatId: string) => {
			removeChatDraft(chatId);
			setInput('');
			setChatPins((prev) => {
				const next = prev.filter((x) => x !== chatId);
				if (next.length !== prev.length) writeChatPins(next);
				return next;
			});
			setChats((prev) => removeChatFromLocalList(prev, chatId));
			setPanelPrefsByChatId((prev) => {
				const { [chatId]: _removed, ...rest } = prev;
				return rest;
			});
			setActiveId((prev) => (prev === chatId ? null : prev));
		},
		[setActiveId, setChatPins, setChats, setInput, setPanelPrefsByChatId]
	);

	const handleLeaveChat = React.useCallback(async () => {
		if (!activeId) return;
		setLeaveBusy(true);
		try {
			abortActiveStream();
			const id = activeId;
			await leaveDesktopAiChat(id);
			teardownChatLocally(id);
			setLeaveConfirmOpen(false);
			toast.success(t('collabLeaveSuccessToast'));
		} catch {
			toast.error(t('collabLeaveErrorToast'));
		} finally {
			setLeaveBusy(false);
		}
	}, [abortActiveStream, activeId, t, teardownChatLocally]);

	const requestLeaveChat = React.useCallback(() => {
		if (!activeId || sending) return;
		setLeaveConfirmOpen(true);
	}, [activeId, sending]);

	const handleAcceptInvite = React.useCallback(
		async (memberId: string) => {
			setInviteActionBusyId(memberId);
			try {
				await acceptDesktopAiChatInvite(memberId);
				await Promise.all([refreshAll(), refreshPendingInvites()]);
				toast.success(t('collabInviteAcceptedToast'));
			} catch {
				toast.error(t('collabInviteActionErrorToast'));
			} finally {
				setInviteActionBusyId(null);
			}
		},
		[refreshAll, refreshPendingInvites, t]
	);

	const handleDeclineInvite = React.useCallback(
		async (memberId: string) => {
			setInviteActionBusyId(memberId);
			try {
				await declineDesktopAiChatInvite(memberId);
				setPendingInvites((prev) => prev.filter((x) => x.id !== memberId));
				toast.message(t('collabInviteDeclinedToast'));
			} catch {
				toast.error(t('collabInviteActionErrorToast'));
			} finally {
				setInviteActionBusyId(null);
			}
		},
		[t]
	);

	return {
		currentUserId,
		lockedByOther,
		armStreamLockPoll,
		pendingInvites,
		pendingInvitesLoading,
		refreshPendingInvites,
		membersPanelOpen,
		setMembersPanelOpen,
		leaveConfirmOpen,
		setLeaveConfirmOpen,
		leaveBusy,
		inviteActionBusyId,
		handleLeaveChat,
		requestLeaveChat,
		handleAcceptInvite,
		handleDeclineInvite,
	};
}
