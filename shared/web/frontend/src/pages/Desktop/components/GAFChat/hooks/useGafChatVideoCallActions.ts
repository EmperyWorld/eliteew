/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat 1:1 and group video-call start actions (mutations + picker open/confirm).
 *
 * Invariants:
 * - Outgoing 1:1 ring uses `startOutgoingVideoCall` from gafVideoCallOutgoing (no circular import).
 * - Actions no-op when chat is blocked or mutations are pending.
 *
 * Related:
 * - GAFChatApp.tsx
 * - gafVideoCallOutgoing.ts
 * - components/VideoCall/api/videoCallApi.ts
 */
import { useMutation } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { requestOpenVideoCallWindow } from '../../../utils/desktopDeepLink';
import {
	createGafGroupVideoCall,
	createGafVideoCall,
} from '../../VideoCall/api/videoCallApi';
import { startOutgoingVideoCall } from '../gafVideoCallOutgoing';

export type GafChatVideoCallPartner = {
	id?: string | null;
	full_name?: string | null;
	username?: string | null;
} | null;

export function useGafChatVideoCallActions(options: {
	t: TFunction<'gafChat'>;
	selectedChatId: string | null;
	chatBlocked: boolean;
	partner: GafChatVideoCallPartner;
}) {
	const { t, selectedChatId, chatBlocked, partner } = options;
	const [groupCallPickerOpen, setGroupCallPickerOpen] = useState(false);

	const startVideoCallMutation = useMutation({
		mutationFn: (chatId: string) => createGafVideoCall(chatId),
		onSuccess: (call) => {
			if (call.awaiting_accept || !call.join_url) {
				const partnerName =
					partner?.full_name?.trim() ||
					partner?.username?.trim() ||
					t('videoCallWindowTitle');
				startOutgoingVideoCall({
					callId: call.call_id,
					chatId: call.chat_id ?? selectedChatId ?? '',
					partnerLabel: partnerName,
				});
				toast.message(t('videoCallOutgoingRinging'));
				return;
			}
			// Active join_url: fresh create (group/host) OR callee reused ringing → accept.
			requestOpenVideoCallWindow({
				videoCallId: call.call_id,
				videoCallJoinUrl: call.join_url,
				videoCallTitle: t('videoCallWindowTitle'),
			});
			toast.success(
				call.reused_existing
					? t('videoCallAcceptedReuseToast')
					: t('videoCallStartedToast')
			);
		},
		onError: () => toast.error(t('videoCallStartFailed')),
	});

	const startGroupVideoCallMutation = useMutation({
		mutationFn: ({
			chatId,
			additionalParticipantIds,
		}: {
			chatId: string;
			additionalParticipantIds: string[];
		}) =>
			createGafGroupVideoCall(chatId, {
				additional_participant_ids: additionalParticipantIds,
			}),
		onSuccess: (call) => {
			setGroupCallPickerOpen(false);
			requestOpenVideoCallWindow({
				videoCallId: call.call_id,
				videoCallJoinUrl: call.join_url,
				videoCallTitle: t('videoCallGroupWindowTitle'),
			});
			toast.success(t('videoCallGroupStartedToast'));
		},
		onError: () => toast.error(t('videoCallGroupStartFailed')),
	});

	const handleStartVideoCall = useCallback(() => {
		if (!selectedChatId || chatBlocked || startVideoCallMutation.isPending)
			return;
		startVideoCallMutation.mutate(selectedChatId);
	}, [
		chatBlocked,
		selectedChatId,
		startVideoCallMutation.isPending,
		startVideoCallMutation.mutate,
	]);

	const handleStartGroupVideoCall = useCallback(() => {
		if (
			!selectedChatId ||
			chatBlocked ||
			startGroupVideoCallMutation.isPending ||
			!partner?.id
		) {
			return;
		}
		setGroupCallPickerOpen(true);
	}, [
		chatBlocked,
		partner?.id,
		selectedChatId,
		startGroupVideoCallMutation.isPending,
	]);

	const handleConfirmGroupVideoCall = useCallback(
		(additionalParticipantIds: string[]) => {
			if (!selectedChatId || additionalParticipantIds.length === 0) return;
			startGroupVideoCallMutation.mutate({
				chatId: selectedChatId,
				additionalParticipantIds,
			});
		},
		[selectedChatId, startGroupVideoCallMutation]
	);

	return {
		groupCallPickerOpen,
		setGroupCallPickerOpen,
		startVideoCallMutation,
		startGroupVideoCallMutation,
		handleStartVideoCall,
		handleStartGroupVideoCall,
		handleConfirmGroupVideoCall,
	};
}
