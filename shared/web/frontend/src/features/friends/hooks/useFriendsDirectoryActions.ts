/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Centralize Friends Directory mutation feedback and chat-launch behavior.
 * Section components receive focused callbacks instead of owning error handling.
 *
 * Invariants:
 * - Every failed mutation reports the API-safe message through the caller boundary.
 * - Blocked friends never open a GAF chat.
 *
 * Related:
 * - ../components/FriendsDirectory.tsx
 * - ./useFriends.ts
 */

import { createElement, useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import {
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
	CheckIcon,
	UserMinusIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import { requestOpenGafChatByUsername } from '@/pages/Desktop/utils/desktopDeepLink';
import { getApiErrorMessage } from '@/utils/apiError';

import type {
	Friend,
	IncomingFriendRequest,
	SentFriendRequest,
} from '../types';
import type { FriendActionDescriptor } from '../components/FriendActionMenu';
import { useFriendActions } from './useFriends';

interface UseFriendsDirectoryActionsOptions {
	onError?: (message: string) => void;
	onIncomingOutcome?: (id: string, kind: 'accepted' | 'rejected') => void;
	onOpenChat?: (friend: Friend) => void;
	onSuccess?: (message: string) => void;
	t: TFunction;
}

export function useFriendsDirectoryActions({
	onError,
	onIncomingOutcome,
	onOpenChat,
	onSuccess,
	t,
}: UseFriendsDirectoryActionsOptions) {
	const actions = useFriendActions();
	const [localError, setLocalError] = useState<string | null>(null);

	const reportError = useCallback(
		(message: string) => {
			setLocalError(message);
			onError?.(message);
		},
		[onError]
	);
	const execute = useCallback(
		async <T>(
			run: () => Promise<T>,
			successMessage: string,
			afterSuccess?: () => void
		): Promise<void> => {
			try {
				await run();
				setLocalError(null);
				afterSuccess?.();
				onSuccess?.(successMessage);
			} catch (error) {
				reportError(getApiErrorMessage(error));
			}
		},
		[onSuccess, reportError]
	);
	const openChat = useCallback(
		(friend: Friend): void => {
			if (friend.is_blocked) return;
			if (onOpenChat) {
				onOpenChat(friend);
				return;
			}
			const username = friend.username?.trim();
			if (username) requestOpenGafChatByUsername(username);
		},
		[onOpenChat]
	);
	const incomingActions = useCallback(
		(item: IncomingFriendRequest): FriendActionDescriptor[] => [
			{
				id: `${item.id}-accept`,
				label: t('friends.accept'),
				icon:
					actions.acceptRequest.isPending &&
					actions.acceptRequest.variables === item.id
						? createElement(ArrowPathIcon, {
								className: 'h-4 w-4 animate-spin',
								'aria-hidden': true,
							})
						: createElement(CheckIcon, {
								className: 'h-4 w-4',
								'aria-hidden': true,
							}),
				onClick: () =>
					execute(
						() => actions.acceptRequest.mutateAsync(item.id),
						t('friends.requestAccepted'),
						() => onIncomingOutcome?.(item.id, 'accepted')
					),
				variant: 'accent',
				size: 'sm',
				showLabel: true,
				disabled:
					actions.acceptRequest.isPending || actions.rejectRequest.isPending,
			},
			{
				id: `${item.id}-reject`,
				label: t('friends.reject'),
				icon: createElement(XMarkIcon, {
					className: 'h-4 w-4',
					'aria-hidden': true,
				}),
				onClick: () =>
					execute(
						() => actions.rejectRequest.mutateAsync(item.id),
						t('friends.requestRejected'),
						() => onIncomingOutcome?.(item.id, 'rejected')
					),
				variant: 'neutral',
				size: 'sm',
				showLabel: true,
				disabled:
					actions.acceptRequest.isPending || actions.rejectRequest.isPending,
			},
		],
		[
			actions.acceptRequest,
			actions.rejectRequest,
			execute,
			onIncomingOutcome,
			t,
		]
	);
	const sentActions = useCallback(
		(item: SentFriendRequest): FriendActionDescriptor[] => [
			{
				id: `${item.id}-cancel`,
				label: t('friends.cancelRequest'),
				icon: createElement(XMarkIcon, {
					className: 'h-4 w-4',
					'aria-hidden': true,
				}),
				onClick: () =>
					execute(
						() => actions.cancelRequest.mutateAsync(item.id),
						t('friends.requestCancelled')
					),
				variant: 'neutral',
				size: 'sm',
				showLabel: true,
				disabled: actions.cancelRequest.isPending,
			},
		],
		[actions.cancelRequest, execute, t]
	);
	const friendActions = useCallback(
		(friend: Friend): FriendActionDescriptor[] => [
			{
				id: `${friend.id}-chat`,
				label: t('friends.startChat'),
				icon: createElement(ChatBubbleLeftRightIcon, {
					className: 'h-4 w-4',
					'aria-hidden': true,
				}),
				onClick: () => openChat(friend),
				disabled: !friend.username?.trim() || friend.is_blocked,
			},
			{
				id: `${friend.id}-remove`,
				label: t('friends.removeFriend'),
				icon:
					actions.removeFriend.isPending &&
					actions.removeFriend.variables === friend.id
						? createElement(ArrowPathIcon, {
								className: 'h-4 w-4 animate-spin',
								'aria-hidden': true,
							})
						: createElement(UserMinusIcon, {
								className: 'h-4 w-4',
								'aria-hidden': true,
							}),
				onClick: () =>
					execute(
						() => actions.removeFriend.mutateAsync(friend.id),
						t('friends.removedFriend')
					),
				disabled: actions.removeFriend.isPending,
			},
		],
		[actions.removeFriend, execute, openChat, t]
	);

	return {
		actions,
		execute,
		friendActions,
		incomingActions,
		localError,
		openChat,
		sentActions,
	};
}
