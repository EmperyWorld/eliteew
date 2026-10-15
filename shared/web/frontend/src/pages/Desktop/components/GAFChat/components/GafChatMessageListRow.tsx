/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat message list row chrome: avatars, bubble shell, video-call system row,
 * footer meta, and pointer/context-menu capture for a single thread message.
 *
 * Invariants:
 * - Row layout and empty-state copy stay unchanged from pre-extract GAFChatMessageBubble.
 * - Video-call event rows render as centered pills without bubble avatars.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatMessageBubble.tsx
 * - src/pages/Desktop/components/GAFChat/GafChatVirtualizedThread.tsx
 */
import { UserAccountBadges } from '@/components/ui/UserAccountBadges';
import { SecureAvatar } from '@/components/profile/SecureAvatar';
import { getFriendDisplayName } from '@/features/friends/components/FriendAvatar';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	PhoneArrowDownLeftIcon,
	PhoneXMarkIcon,
	VideoCameraIcon,
	CheckIcon,
} from '@heroicons/react/24/outline';
import {
	memo,
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
} from 'react';
import type { TFunction } from 'i18next';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { GAFChatAvatar } from './GAFChatAvatar';
import {
	formatGafCallDuration,
	type GafBubbleFooterTimes,
	type GafVideoCallEventMeta,
} from '../gafChatMessageViewUtils';
import type { GAFChatListItem } from '../types';

function GafBubbleTimestamp({
	absoluteTitle,
	className,
	children,
}: {
	absoluteTitle: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<DesktopChromeTooltip
			content={absoluteTitle}
			placement="top"
			offsetExtra={4}
		>
			<span className={className}>{children}</span>
		</DesktopChromeTooltip>
	);
}

export function GafBubbleFooterMeta({
	footer,
	isReadByPartner,
	replyButton,
	copyButton,
	overflowMenu,
	t,
	lucideStroke,
}: {
	footer: GafBubbleFooterTimes;
	isReadByPartner?: boolean;
	replyButton: ReactNode;
	copyButton: ReactNode;
	overflowMenu: ReactNode;
	t: TFunction<'gafChat'>;
	lucideStroke: number;
}) {
	return (
		<div
			className={cn(
				'mt-1 flex items-end justify-between gap-2 text-(--desktop-text-dim)',
				DESKTOP_TYPOGRAPHY.captionInherit,
				'font-normal'
			)}
		>
			<div className="min-w-0 flex-1">
				<GafBubbleTimestamp absoluteTitle={footer.absoluteTitle}>
					{footer.clock}
				</GafBubbleTimestamp>
				{footer.relativeHint ? (
					<GafBubbleTimestamp
						absoluteTitle={footer.absoluteTitle}
						className="text-(--desktop-text-muted) before:content-['·'] before:mx-1"
					>
						{footer.relativeHint}
					</GafBubbleTimestamp>
				) : null}
				{footer.editedSuffix ? (
					<GafBubbleTimestamp
						absoluteTitle={footer.absoluteTitle}
						className="text-(--desktop-text-muted) before:content-['·'] before:mx-1 italic"
					>
						{footer.editedSuffix}
					</GafBubbleTimestamp>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-0.5">
				{replyButton}
				{copyButton}
				{overflowMenu}
				{isReadByPartner != null ? (
					<DesktopChromeTooltip
						content={
							isReadByPartner ? t('readReceiptRead') : t('readReceiptSent')
						}
						placement="top"
						offsetExtra={4}
					>
						<span
							role="img"
							className="inline-flex shrink-0 items-center justify-center"
							aria-label={
								isReadByPartner
									? t('readReceiptReadAria')
									: t('readReceiptSentAria')
							}
						>
							{isReadByPartner ? (
								<CheckIcon
									className="h-3.5 w-3.5 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
									strokeWidth={lucideStroke}
									aria-hidden
								/>
							) : (
								<CheckIcon
									className="h-3.5 w-3.5 text-(--desktop-text-dim)"
									strokeWidth={lucideStroke}
									aria-hidden
								/>
							)}
						</span>
					</DesktopChromeTooltip>
				) : null}
			</div>
		</div>
	);
}

export type GafChatMessageListRowProps = {
	messageId: string;
	isMine: boolean;
	isReadByPartner: boolean;
	partner: GAFChatListItem['partner'] | null;
	footer: GafBubbleFooterTimes;
	bubbleOutgoingClass: string;
	bubbleIncomingClass: string;
	lucideStroke: number;
	t: TFunction<'gafChat'>;
	videoCallEvent: GafVideoCallEventMeta | null;
	legacyPostCallLabel: string | null;
	showVideoCallRow: boolean;
	onMessageRowContextMenuCapture: (e: MouseEvent) => void;
	onBubblePointerDown: (e: PointerEvent) => void;
	clearLongPressTimer: () => void;
	replyButton: ReactNode;
	copyButton: ReactNode;
	overflowMenu: ReactNode;
	bubbleBody: ReactNode;
};

export const GafChatMessageListRow = memo(function GafChatMessageListRow({
	messageId,
	isMine,
	isReadByPartner,
	partner,
	footer,
	bubbleOutgoingClass,
	bubbleIncomingClass,
	lucideStroke,
	t,
	videoCallEvent,
	legacyPostCallLabel,
	showVideoCallRow,
	onMessageRowContextMenuCapture,
	onBubblePointerDown,
	clearLongPressTimer,
	replyButton,
	copyButton,
	overflowMenu,
	bubbleBody,
}: GafChatMessageListRowProps) {
	if (showVideoCallRow) {
		const Icon =
			legacyPostCallLabel ||
			videoCallEvent?.event === 'ended' ||
			videoCallEvent?.event === 'missed'
				? PhoneXMarkIcon
				: videoCallEvent?.event === 'accepted'
					? PhoneArrowDownLeftIcon
					: VideoCameraIcon;
		const label =
			legacyPostCallLabel ??
			(videoCallEvent?.event === 'missed' && videoCallEvent.missedReason
				? t(`videoCallEvent.missedReason.${videoCallEvent.missedReason}`, {
						defaultValue: t('videoCallEvent.missed'),
					})
				: t(`videoCallEvent.${videoCallEvent?.event ?? 'ended'}`));
		const duration =
			legacyPostCallLabel || videoCallEvent?.durationSeconds == null
				? null
				: t('videoCallEvent.duration', {
						duration: formatGafCallDuration(videoCallEvent.durationSeconds),
					});
		return (
			<div className="py-2" data-gaf-message-id={messageId}>
				<div className="mx-auto flex w-full max-w-[min(100%,40rem)] justify-center px-2">
					<DesktopChromeTooltip
						content={footer.absoluteTitle}
						placement="top"
						offsetExtra={4}
					>
						<div
							className={cn(
								'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5',
								'border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.09)]',
								'text-(--desktop-text-secondary) shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							<Icon
								className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
								strokeWidth={lucideStroke}
								aria-hidden
							/>
							<span className="truncate font-medium text-(--desktop-text-primary)">
								{label}
							</span>
							{duration ? (
								<span className="shrink-0 text-(--desktop-text-muted)">
									{duration}
								</span>
							) : null}
							<span className="shrink-0 text-(--desktop-text-dim)">
								{footer.clock}
							</span>
						</div>
					</DesktopChromeTooltip>
				</div>
			</div>
		);
	}

	const outgoingAvatar = (
		<div
			className="pointer-events-none h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-(--desktop-surface-app) shadow-md ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.14)] ring-offset-2 ring-offset-[color-mix(in_srgb,var(--desktop-surface-app)_100%,transparent)]"
			aria-hidden
		>
			<SecureAvatar
				useProfileApi
				alt=""
				className="h-full w-full object-cover"
			/>
		</div>
	);

	const incomingAvatar =
		partner != null ? (
			<div className="relative shrink-0 self-end pb-0.5">
				<div className="relative h-9 w-9 overflow-hidden rounded-full border border-(--desktop-border-strong)/90 bg-(--desktop-surface-app) shadow-md ring-1 ring-(--desktop-border-subtle)/80">
					<GAFChatAvatar
						avatarUrl={partner.avatar_url ?? null}
						className="h-full w-full object-cover"
						alt={getFriendDisplayName(
							partner.username,
							partner.full_name,
							t('counterpartFallback')
						)}
					/>
					{partner.is_trusted ||
					partner.admin_badge_label?.trim() ||
					partner.is_system_account ? (
						<span className="absolute -bottom-0.5 -right-0.5 max-w-[min(100%,7rem)] rounded-full bg-(--desktop-surface-app) p-px shadow-sm">
							<UserAccountBadges
								isTrusted={partner.is_trusted}
								adminBadgeLabel={partner.admin_badge_label}
								adminBadgeHint={partner.admin_badge_hint}
								isSystemAccount={partner.is_system_account}
								className="origin-bottom-right scale-[0.72]"
							/>
						</span>
					) : null}
				</div>
			</div>
		) : null;

	const bubblePointerHandlers = {
		onPointerDown: onBubblePointerDown,
		onPointerUp: clearLongPressTimer,
		onPointerCancel: clearLongPressTimer,
		onPointerLeave: clearLongPressTimer,
	};

	return (
		<div
			className="py-2"
			data-gaf-message-id={messageId}
			onContextMenuCapture={onMessageRowContextMenuCapture}
		>
			<div className="mx-auto w-full max-w-[min(100%,40rem)]">
				{isMine ? (
					<div className="flex justify-end">
						<div className="flex max-w-full min-w-0 flex-row-reverse items-end gap-2.5">
							<div className="flex min-w-0 max-w-[min(100%,88%)] flex-col items-end">
								<div className={bubbleOutgoingClass} {...bubblePointerHandlers}>
									<div className="min-w-0 wrap-anywhere leading-normal [&_strong]:font-semibold">
										{bubbleBody}
									</div>
									<GafBubbleFooterMeta
										footer={footer}
										isReadByPartner={isReadByPartner}
										replyButton={replyButton}
										copyButton={copyButton}
										overflowMenu={overflowMenu}
										t={t}
										lucideStroke={lucideStroke}
									/>
								</div>
							</div>
							{outgoingAvatar}
						</div>
					</div>
				) : (
					<div className="flex justify-start">
						<div className="flex max-w-full min-w-0 items-end gap-2.5">
							{incomingAvatar}
							<div className="flex min-w-0 max-w-[min(100%,88%)] flex-col items-start">
								<div className={bubbleIncomingClass} {...bubblePointerHandlers}>
									<div className="min-w-0 wrap-anywhere leading-normal [&_strong]:font-semibold">
										{bubbleBody}
									</div>
									<GafBubbleFooterMeta
										footer={footer}
										replyButton={replyButton}
										copyButton={copyButton}
										overflowMenu={overflowMenu}
										t={t}
										lucideStroke={lucideStroke}
									/>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
});
