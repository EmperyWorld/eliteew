/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Partner friendship indicator and quick friend-request actions in the GAF thread header.
 *
 * Invariants:
 * - Hidden for blocked chats, system accounts, and when friends overview is disabled.
 *
 * Related:
 * - GafChatThreadPanel.tsx · gafChatMapUserError.ts
 */

import { useAuth } from '@/contexts/AuthContext';
import { useFriendActions } from '@/features/friends/hooks/useFriends';
import { useFriendsOverview } from '@/features/friends/hooks/useFriendsOverview';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useMemo } from 'react';
import {
	ArrowPathIcon,
	CheckIcon,
	UserPlusIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { mapGafChatUserError } from './gafChatMapUserError';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { GafChatDesktopIconTooltip } from './gafChatDesktopIconTooltip';

export function GafChatPartnerFriendStrip({
	partnerId,
	chatBlocked,
	isSystemAccount,
	className,
}: {
	partnerId: string;
	chatBlocked: boolean;
	isSystemAccount?: boolean;
	className?: string;
}): React.JSX.Element | null {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const { user } = useAuth();
	const enabled = Boolean(
		user && partnerId && !chatBlocked && !isSystemAccount
	);
	const overview = useFriendsOverview({ enabled });
	const actions = useFriendActions();

	const friends = overview.data?.friends ?? [];
	const incoming = overview.data?.incomingRequests ?? [];
	const sent = overview.data?.sentRequests ?? [];

	const isFriend = useMemo(
		() => friends.some((f) => f.id === partnerId),
		[friends, partnerId]
	);
	const incomingReq = useMemo(
		() => incoming.find((r) => r.from_user_id === partnerId) ?? null,
		[incoming, partnerId]
	);
	const outgoingReq = useMemo(
		() => sent.find((r) => r.to_user_id === partnerId) ?? null,
		[sent, partnerId]
	);

	const busy =
		actions.sendRequestToUser.isPending ||
		actions.acceptRequest.isPending ||
		actions.rejectRequest.isPending ||
		actions.cancelRequest.isPending;

	const sendRequest = async (): Promise<void> => {
		try {
			await actions.sendRequestToUser.mutateAsync(partnerId);
			toast.success(t('friendRequestSentToast'));
		} catch (e: unknown) {
			toast.error(mapGafChatUserError(e, t, 'friend'));
		}
	};

	const acceptIncoming = async (): Promise<void> => {
		if (!incomingReq) return;
		try {
			await actions.acceptRequest.mutateAsync(incomingReq.id);
			toast.success(t('friendRequestAcceptedToast'));
		} catch (e: unknown) {
			toast.error(mapGafChatUserError(e, t, 'friend'));
		}
	};

	const rejectIncoming = async (): Promise<void> => {
		if (!incomingReq) return;
		try {
			await actions.rejectRequest.mutateAsync(incomingReq.id);
			toast.success(t('friendRequestDeclinedToast'));
		} catch (e: unknown) {
			toast.error(mapGafChatUserError(e, t, 'friend'));
		}
	};

	const cancelOutgoing = async (): Promise<void> => {
		if (!outgoingReq) return;
		try {
			await actions.cancelRequest.mutateAsync(outgoingReq.id);
			toast.success(t('friendRequestCancelledToast'));
		} catch (e: unknown) {
			toast.error(mapGafChatUserError(e, t, 'friend'));
		}
	};

	if (!enabled) return null;

	if (overview.isLoading && !overview.data) {
		return (
			<div
				className={cn(
					'shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-(--desktop-border-subtle)/50 bg-(--desktop-surface-soft)/40',
					className
				)}
				aria-hidden
			>
				<ArrowPathIcon
					className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none text-(--desktop-text-muted)"
					strokeWidth={lucideStroke}
				/>
			</div>
		);
	}

	if (isFriend) {
		return (
			<DesktopChromeTooltip
				content={t('partnerIsFriendTitle')}
				placement="bottom"
				offsetExtra={4}
			>
				<div
					className={cn(
						'shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-fg-primary-rgb)/0.95)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
						className
					)}
					role="status"
					aria-label={t('partnerIsFriendAria')}
				>
					<CheckIcon
						className="h-4 w-4"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
				</div>
			</DesktopChromeTooltip>
		);
	}

	if (incomingReq) {
		return (
			<div
				className={cn(
					'shrink-0 flex items-center gap-0.5',
					DESKTOP_TYPOGRAPHY.shellMeta10,
					className
				)}
			>
				<GafChatDesktopIconTooltip content={t('friendAcceptTitle')}>
					<DesktopAppButton
						type="button"
						variant="accent"
						size="icon"
						className="h-8 w-8 min-h-8 min-w-8"
						disabled={busy}
						aria-label={t('friendAcceptAria')}
						onClick={() => void acceptIncoming()}
					>
						{actions.acceptRequest.isPending ? (
							<ArrowPathIcon
								className="h-4 w-4 animate-spin motion-reduce:animate-none"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						) : (
							<CheckIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						)}
					</DesktopAppButton>
				</GafChatDesktopIconTooltip>
				<GafChatDesktopIconTooltip content={t('friendDeclineTitle')}>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 min-h-8 min-w-8"
						disabled={busy}
						aria-label={t('friendDeclineAria')}
						onClick={() => void rejectIncoming()}
					>
						{actions.rejectRequest.isPending ? (
							<ArrowPathIcon
								className="h-4 w-4 animate-spin motion-reduce:animate-none"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						) : (
							<XMarkIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={lucideStroke}
							/>
						)}
					</DesktopAppButton>
				</GafChatDesktopIconTooltip>
			</div>
		);
	}

	if (outgoingReq) {
		return (
			<GafChatDesktopIconTooltip content={t('friendCancelOutgoingTitle')}>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className={cn(
						'shrink-0 touch-manipulation px-2 py-1',
						DESKTOP_TYPOGRAPHY.captionInherit,
						className
					)}
					disabled={busy}
					aria-label={t('friendCancelOutgoingAria')}
					onClick={() => void cancelOutgoing()}
				>
					{actions.cancelRequest.isPending ? (
						<ArrowPathIcon
							className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
							aria-hidden
							strokeWidth={lucideStroke}
						/>
					) : null}
					<span className="max-w-28 truncate">{t('friendCancelOutgoing')}</span>
				</DesktopAppButton>
			</GafChatDesktopIconTooltip>
		);
	}

	return (
		<GafChatDesktopIconTooltip content={t('friendSendRequestTitle')}>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="icon"
				className={cn(
					'shrink-0 h-8 w-8 min-h-8 min-w-8 touch-manipulation',
					className
				)}
				disabled={busy}
				aria-label={t('friendSendRequestAria')}
				onClick={() => void sendRequest()}
			>
				{actions.sendRequestToUser.isPending ? (
					<ArrowPathIcon
						className="h-4 w-4 animate-spin motion-reduce:animate-none"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
				) : (
					<UserPlusIcon
						className="h-4 w-4"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
				)}
			</DesktopAppButton>
		</GafChatDesktopIconTooltip>
	);
}
