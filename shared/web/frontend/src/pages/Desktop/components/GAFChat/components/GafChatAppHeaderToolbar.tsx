/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat app-level header toolbar: title, connection status, partner card,
 * E2EE/video/sound/actions cluster, and chats load error bar.
 *
 * Invariants:
 * - Partner card hidden when chats list failed to load; E2EE/video actions respect system-account and block flags.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md §6
 */
import { getFriendDisplayName } from '@/features/friends/components/FriendAvatar';
import { cn } from '@/utils/cn';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppToolbar,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { GAFChatChatActionsMenu } from '../GAFChatChatActionsMenu';
import { GAFChatEncryptionIconButton } from '../GAFChatEncryptionIconButton';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import { GafChatPartnerFriendStrip } from '../GafChatPartnerFriendStrip';
import type { GafE2eeStatus } from '../api/gafChatApi';
import type { GAFChatPartner } from '../types';
import { GAFChatAvatar } from './GAFChatAvatar';
import { GAFChatErrorBar } from './GAFChatErrorBar';
import {
	ArrowPathIcon,
	AtSymbolIcon,
	ChatBubbleLeftRightIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
	UsersIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';

export type GafChatAppHeaderToolbarProps = {
	shellAppToolbarClass: string;
	unreadTotal: number;
	socketConnected: boolean;
	onOpenNewChat: () => void;
	partner: GAFChatPartner | null | undefined;
	chatsError: boolean;
	chatsErrorCode: number | undefined;
	chatsErrorDismissed: boolean;
	onRefetchChats: () => void;
	onDismissChatsError: () => void;
	onCopyPartnerUsername: (username: string) => void;
	selectedChatId: string | null;
	partnerIsSystemAccount: boolean;
	e2eeStatus: GafE2eeStatus | undefined;
	myUserId: string | null;
	e2eeConsentBusy: boolean;
	onProposeE2ee?: () => void;
	onAcceptE2ee?: () => void;
	onDeclineE2ee?: () => void;
	onDisableE2ee?: () => void;
	onSetupE2eeKeys: () => void;
	onStartVideoCall: () => void;
	onStartGroupVideoCall: () => void;
	startVideoCallPending: boolean;
	startGroupVideoCallPending: boolean;
	chatBlocked: boolean;
	soundEnabled: boolean;
	onToggleSound: () => void;
	onClearHistory: () => void;
	onArchiveChat: () => void;
	onDeleteForEveryone: () => void;
};

export const GafChatAppHeaderToolbar = memo(function GafChatAppHeaderToolbar({
	shellAppToolbarClass,
	unreadTotal,
	socketConnected,
	onOpenNewChat,
	partner,
	chatsError,
	chatsErrorCode,
	chatsErrorDismissed,
	onRefetchChats,
	onDismissChatsError,
	onCopyPartnerUsername,
	selectedChatId,
	partnerIsSystemAccount,
	e2eeStatus,
	myUserId,
	e2eeConsentBusy,
	onProposeE2ee,
	onAcceptE2ee,
	onDeclineE2ee,
	onDisableE2ee,
	onSetupE2eeKeys,
	onStartVideoCall,
	onStartGroupVideoCall,
	startVideoCallPending,
	startGroupVideoCallPending,
	chatBlocked,
	soundEnabled,
	onToggleSound,
	onClearHistory,
	onArchiveChat,
	onDeleteForEveryone,
}: GafChatAppHeaderToolbarProps) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;

	return (
		<>
			<DesktopAppToolbar
				className={shellAppToolbarClass}
				data-gaf-guide="toolbar"
			>
				<div className="flex min-w-0 flex-col gap-1.5 sm:justify-self-start">
					<div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
						<div
							className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
							aria-hidden
						>
							<ChatBubbleLeftRightIcon
								className="h-[18px] w-[18px] text-[rgb(var(--desktop-accent-rgb))]"
								strokeWidth={lucideStroke}
							/>
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
								<span className="flex min-w-0 items-center gap-1.5">
									<span
										className={cn(
											'truncate font-semibold tracking-tight text-(--desktop-text-primary)',
											DESKTOP_TYPOGRAPHY.shellCopy15
										)}
									>
										{t('appTitle')}
									</span>
									{unreadTotal > 0 ? (
										<span
											className={`${DESKTOP_APP_STYLE_CONTRACT.counterBadge} shrink-0 tabular-nums bg-[rgb(var(--desktop-accent-rgb))] text-[rgb(var(--desktop-fg-primary-rgb))]`}
										>
											{unreadTotal > 99 ? '99+' : unreadTotal}
										</span>
									) : null}
								</span>
								<span
									className={cn(
										'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 font-medium transition-[color,background-color,border-color] duration-200 motion-reduce:transition-none',
										DESKTOP_TYPOGRAPHY.captionInherit,
										socketConnected
											? 'border-[rgb(var(--desktop-accent-rgb)/0.3)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-fg-primary-rgb)/0.92)]'
											: 'border-amber-400/35 bg-amber-500/12 text-amber-100'
									)}
									role="status"
									aria-live="polite"
									aria-label={
										socketConnected
											? t('serverOnlineAria')
											: t('serverOfflineAria')
									}
								>
									<span
										className={`h-1.5 w-1.5 shrink-0 rounded-full ${
											socketConnected
												? 'bg-[rgb(var(--desktop-accent-rgb))] shadow-[0_0_8px_rgb(var(--desktop-accent-rgb)/0.65)]'
												: 'motion-safe:animate-pulse motion-reduce:animate-none bg-amber-400'
										}`}
										aria-hidden
									/>
									<DesktopChromeTooltip
										content={
											socketConnected
												? t('serverOnlineTooltip')
												: t('serverOffline')
										}
										placement="bottom"
										offsetExtra={4}
									>
										<span className="truncate">
											{socketConnected
												? t('serverOnlineShort')
												: t('serverOfflineShort')}
										</span>
									</DesktopChromeTooltip>
								</span>
							</div>
							<DesktopChromeTooltip
								content={t('newChat')}
								placement="bottom"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									data-gaf-guide="new-chat"
									onClick={onOpenNewChat}
									variant="accent"
									size="sm"
									className="mt-1.5 shrink-0 touch-manipulation shadow-[0_1px_12px_rgba(var(--desktop-accent-rgb),0.22)]"
								>
									<span className="hidden sm:inline">{t('newChat')}</span>
									<span className="sm:hidden">{t('newChatShort')}</span>
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</div>
					</div>
				</div>
				<div className="flex min-w-0 justify-center px-1 sm:justify-self-center">
					{partner && !chatsError ? (
						<DesktopChromeTooltip
							content={(() => {
								const n = getFriendDisplayName(
									partner.username,
									partner.full_name,
									t('counterpartFallback')
								);
								const b = partner.bio?.trim();
								return b ? `${n} — ${b}` : n;
							})()}
							placement="bottom"
							offsetExtra={6}
						>
							<div className="flex min-w-0 max-w-[min(100%,20rem)] items-center gap-2 rounded-xl border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-app)/35 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color] duration-200 motion-reduce:transition-none hover:border-(--desktop-border-strong)/40 hover:bg-(--desktop-surface-soft-hover)/50">
								<GAFChatAvatar
									avatarUrl={partner.avatar_url ?? null}
									className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-(--desktop-border-subtle)/80"
									alt=""
								/>
								<GafChatPartnerFriendStrip
									partnerId={partner.id}
									chatBlocked={Boolean(
										partner.is_blocked || partner.blocked_by_partner
									)}
									isSystemAccount={Boolean(partner.is_system_account)}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex min-w-0 items-center gap-0.5">
										<span
											className={cn(
												'block min-w-0 flex-1 truncate font-semibold text-(--desktop-text-primary)',
												DESKTOP_TYPOGRAPHY.shellCopy13
											)}
										>
											{getFriendDisplayName(
												partner.username,
												partner.full_name,
												t('counterpartFallback')
											)}
										</span>
										{partner.username?.trim() ? (
											<GafChatDesktopIconTooltip
												content={t('copyUsernameTitle')}
											>
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="icon"
													className="h-7 w-7 shrink-0 touch-manipulation opacity-80 hover:opacity-100"
													aria-label={t('copyUsernameAria')}
													onClick={(e) => {
														e.stopPropagation();
														void onCopyPartnerUsername(partner.username ?? '');
													}}
												>
													<AtSymbolIcon
														className="h-3.5 w-3.5 text-(--desktop-text-muted)"
														aria-hidden
														strokeWidth={lucideStroke}
													/>
												</DesktopAppButton>
											</GafChatDesktopIconTooltip>
										) : null}
									</div>
									{partner.bio?.trim() ? (
										<span
											className={cn(
												'mt-0.5 hidden min-w-0 truncate text-(--desktop-text-muted) sm:block',
												DESKTOP_TYPOGRAPHY.caption
											)}
										>
											{partner.bio.trim()}
										</span>
									) : null}
								</div>
							</div>
						</DesktopChromeTooltip>
					) : null}
				</div>
				<div className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:justify-self-end sm:gap-1.5">
					<div className="flex items-center gap-0.5 rounded-xl border border-(--desktop-border-subtle)/45 bg-(--desktop-surface-soft)/40 p-0.5">
						{!chatsError && !partnerIsSystemAccount ? (
							<GAFChatEncryptionIconButton
								className="shrink-0"
								status={e2eeStatus ?? null}
								currentUserId={myUserId}
								busy={e2eeConsentBusy}
								onPropose={selectedChatId ? onProposeE2ee : undefined}
								onAccept={selectedChatId ? onAcceptE2ee : undefined}
								onDecline={selectedChatId ? onDeclineE2ee : undefined}
								onDisable={selectedChatId ? onDisableE2ee : undefined}
								onSetupKeys={onSetupE2eeKeys}
							/>
						) : null}
						{!partnerIsSystemAccount ? (
							<>
								<GafChatDesktopIconTooltip content={t('videoCallStartTitle')}>
									<DesktopAppButton
										type="button"
										onClick={onStartVideoCall}
										size="icon"
										variant="accent"
										disabled={
											!selectedChatId || chatBlocked || startVideoCallPending
										}
										className="h-8 w-8 min-h-8 min-w-8 shrink-0 touch-manipulation"
										aria-label={t('videoCallStartAria')}
									>
										{startVideoCallPending ? (
											<ArrowPathIcon
												className="h-4 w-4 animate-spin"
												aria-hidden
												strokeWidth={lucideStroke}
											/>
										) : (
											<VideoCameraIcon
												className="h-4 w-4"
												aria-hidden
												strokeWidth={lucideStroke}
											/>
										)}
									</DesktopAppButton>
								</GafChatDesktopIconTooltip>
								<GafChatDesktopIconTooltip
									content={t('videoCallGroupStartTitle')}
								>
									<DesktopAppButton
										type="button"
										onClick={onStartGroupVideoCall}
										size="icon"
										variant="accent"
										disabled={
											!selectedChatId ||
											!partner?.id ||
											chatBlocked ||
											startGroupVideoCallPending
										}
										className="h-8 w-8 min-h-8 min-w-8 shrink-0 touch-manipulation"
										aria-label={t('videoCallGroupStartAria')}
									>
										{startGroupVideoCallPending ? (
											<ArrowPathIcon
												className="h-4 w-4 animate-spin"
												aria-hidden
												strokeWidth={lucideStroke}
											/>
										) : (
											<UsersIcon
												className="h-4 w-4"
												aria-hidden
												strokeWidth={lucideStroke}
											/>
										)}
									</DesktopAppButton>
								</GafChatDesktopIconTooltip>
							</>
						) : null}
						<GafChatDesktopIconTooltip
							content={soundEnabled ? t('soundOffTitle') : t('soundOnTitle')}
						>
							<DesktopAppButton
								type="button"
								onClick={onToggleSound}
								size="icon"
								variant={soundEnabled ? 'accent' : 'neutral'}
								active={soundEnabled}
								aria-pressed={soundEnabled}
								className="h-8 w-8 min-h-8 min-w-8 shrink-0 touch-manipulation"
								aria-label={soundEnabled ? t('soundOffAria') : t('soundOnAria')}
							>
								{soundEnabled ? (
									<SpeakerWaveIcon
										className="h-4 w-4"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								) : (
									<SpeakerXMarkIcon
										className="h-4 w-4"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								)}
							</DesktopAppButton>
						</GafChatDesktopIconTooltip>
						<GAFChatChatActionsMenu
							disabled={!selectedChatId}
							onClear={onClearHistory}
							onArchive={onArchiveChat}
							onDelete={onDeleteForEveryone}
						/>
					</div>
				</div>
			</DesktopAppToolbar>
			<div
				className="h-1 shrink-0 bg-linear-to-r from-transparent via-[rgb(var(--desktop-accent-rgb)/0.65)] to-transparent opacity-90"
				aria-hidden
			/>
			{chatsError && !chatsErrorDismissed ? (
				<GAFChatErrorBar
					message={
						chatsErrorCode === 401 || chatsErrorCode === 403
							? t('chatsLoadErrorAuth')
							: chatsErrorCode === 404
								? t('chatsLoadError404')
								: t('chatsLoadErrorGeneric')
					}
					onAction={() => onRefetchChats()}
					onDismiss={onDismissChatsError}
				/>
			) : null}
		</>
	);
});
