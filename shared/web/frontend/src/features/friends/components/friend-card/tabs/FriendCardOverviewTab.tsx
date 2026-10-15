/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the identity, primary relationship actions, and overview details.
 *
 * Invariants:
 * - The primary chat action remains disabled for blocked or unnamed friends.
 *
 * Related:
 * - ../../FriendPersonCard.tsx
 * ---
 */

import type { TFunction } from 'i18next';
import {
	ChatBubbleLeftRightIcon,
	ClockIcon,
	DocumentTextIcon,
	EyeSlashIcon,
	ShareIcon,
	StarIcon,
	UserCircleIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppStatusBadge,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { FriendAvatar, getFriendDisplayName } from '../../FriendAvatar';
import {
	SH_FRIEND_CARD_DISPLAY_NAME_CLASS,
	SH_FRIEND_CARD_HERO_CLASS,
	SH_FRIEND_CARD_REMINDER_PANEL_CLASS,
	SH_FRIEND_CARD_SECTION_TITLE_CLASS,
	SH_FRIEND_CARD_TABLIST_CLASS,
	SH_FRIEND_CARD_USERNAME_CLASS,
	shFriendCardInsetSectionClass,
	shFriendCardStatusBadgeClass,
	shFriendCardTabBadgeClass,
	shFriendCardTabClass,
} from '../../../social-hub/layout/socialHubLayoutTokens';
import type { FriendCardTab, FriendProfile } from '../friendPersonCardTypes';

type Props = {
	t: TFunction;
	friend: FriendProfile;
	saving: boolean;
	shellInset: string;
	friendshipSince: string | null;
	lastActivity: string | null;
	lastInteraction: string | null;
	relationshipActionDescriptionKey: string;
	onOpenChat?: (friend: FriendProfile) => void;
	onToggleFavorite?: (friend: FriendProfile) => void;
	onSelectTab: (tab: 'shared' | 'privacy') => void;
};

const TAB_ICONS = {
	overview: UserCircleIcon,
	notes: DocumentTextIcon,
	shared: ShareIcon,
	privacy: EyeSlashIcon,
	timeline: ClockIcon,
} as const;

export function FriendCardTabRail({
	t,
	activeTab,
	noteCount,
	sharedCount,
	privacyCount,
	timelineCount,
	onSelect,
}: {
	t: TFunction;
	activeTab: FriendCardTab;
	noteCount: number;
	sharedCount: number | undefined;
	privacyCount: number;
	timelineCount: number;
	onSelect: (tab: FriendCardTab) => void;
}): JSX.Element {
	const tabs: Array<{ id: FriendCardTab; label: string; badge?: string }> = [
		{ id: 'overview', label: t('friends.personCardTabOverview') },
		{
			id: 'notes',
			label: t('friends.personCardTabNotes'),
			badge: noteCount ? '1' : undefined,
		},
		{
			id: 'shared',
			label: t('friends.personCardTabShared'),
			badge: sharedCount?.toString(),
		},
		{
			id: 'privacy',
			label: t('friends.personCardTabPrivacy'),
			badge: privacyCount.toString(),
		},
		{
			id: 'timeline',
			label: t('friends.personCardTabTimeline'),
			badge: timelineCount.toString(),
		},
	];
	return (
		<div
			className={SH_FRIEND_CARD_TABLIST_CLASS}
			role="tablist"
			aria-label={t('friends.personCardTabsLabel')}
		>
			{tabs.map((tab) => {
				const Icon = TAB_ICONS[tab.id];
				const active = activeTab === tab.id;
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={active}
						className={shFriendCardTabClass(active)}
						onClick={() => onSelect(tab.id)}
					>
						<Icon className="h-4 w-4" aria-hidden />
						{tab.label}
						{tab.badge && tab.badge !== '0' ? (
							<span className={shFriendCardTabBadgeClass(active)}>
								{tab.badge}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

export function FriendCardOverviewTab({
	t,
	friend,
	saving,
	shellInset,
	friendshipSince,
	lastActivity,
	lastInteraction,
	relationshipActionDescriptionKey,
	onOpenChat,
	onToggleFavorite,
	onSelectTab,
}: Props): JSX.Element {
	const displayName = getFriendDisplayName(
		friend.username,
		friend.full_name,
		t('friends.anonymousUser')
	);
	const showUsername =
		friend.username?.trim() &&
		friend.full_name?.trim().toLowerCase() !==
			friend.username.trim().toLowerCase();

	return (
		<>
			<div className={SH_FRIEND_CARD_HERO_CLASS}>
				<div className="flex items-start gap-4">
					<FriendAvatar
						avatarUrl={friend.avatar_url}
						username={friend.username}
						fullName={friend.full_name}
						alt={t('friends.avatarAlt')}
						className="h-16 w-16 text-lg"
					/>
					<div className="min-w-0 flex-1">
						<h3 className={SH_FRIEND_CARD_DISPLAY_NAME_CLASS}>{displayName}</h3>
						{showUsername ? (
							<p className={SH_FRIEND_CARD_USERNAME_CLASS}>
								@{friend.username}
							</p>
						) : null}
						<div className="mt-3 flex flex-wrap gap-2">
							{friend.is_favorite ? (
								<DesktopAppStatusBadge
									className={shFriendCardStatusBadgeClass('favorite')}
								>
									{t('friends.favoriteBadge')}
								</DesktopAppStatusBadge>
							) : null}
							{friend.is_muted ? (
								<DesktopAppStatusBadge
									className={shFriendCardStatusBadgeClass('muted')}
								>
									{t('friends.mutedBadge')}
								</DesktopAppStatusBadge>
							) : null}
							{friend.is_blocked ? (
								<DesktopAppStatusBadge
									className={shFriendCardStatusBadgeClass('blocked')}
								>
									{t('friends.blockedBadge')}
								</DesktopAppStatusBadge>
							) : null}
							{lastActivity ? (
								<DesktopAppStatusBadge
									className={shFriendCardStatusBadgeClass('neutral')}
								>
									{t('friends.activityLabel')} {lastActivity}
								</DesktopAppStatusBadge>
							) : null}
						</div>
					</div>
				</div>
			</div>
			<div className="grid gap-3 md:grid-cols-2">
				<DesktopAppButton
					type="button"
					variant="accent"
					onClick={() => onOpenChat?.(friend)}
					disabled={!friend.username?.trim() || friend.is_blocked}
					className="justify-center"
				>
					<ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden />
					{t('friends.startChat')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant={friend.is_favorite ? 'neutral' : 'accent'}
					onClick={() => onToggleFavorite?.(friend)}
					disabled={saving}
					className="justify-center"
				>
					<StarIcon
						className={`h-4 w-4 ${friend.is_favorite ? 'fill-current' : ''}`}
						aria-hidden
					/>
					{friend.is_favorite
						? t('friends.favoriteRemove')
						: t('friends.favoriteAdd')}
				</DesktopAppButton>
			</div>
			<DesktopAppSurface
				role="region"
				aria-label={t('friends.relationshipActionCenterTitle')}
				variant="soft"
				padding="sm"
				className="space-y-3"
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h4 className="text-sm font-semibold text-(--desktop-text-primary)">
							{t('friends.relationshipActionCenterTitle')}
						</h4>
						<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
							{t(relationshipActionDescriptionKey)}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => onOpenChat?.(friend)}
							disabled={!friend.username?.trim() || friend.is_blocked}
						>
							{t('friends.relationshipActionOpenChat')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => onSelectTab('shared')}
						>
							{t('friends.relationshipActionOpenShared')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => onSelectTab('privacy')}
						>
							{t('friends.relationshipActionOpenPrivacy')}
						</DesktopAppButton>
					</div>
				</div>
			</DesktopAppSurface>
			<div className={shFriendCardInsetSectionClass(shellInset)}>
				<div className="flex items-center gap-2">
					<UserCircleIcon className="h-4 w-4 text-cyan-400" aria-hidden />
					<h4 className={SH_FRIEND_CARD_SECTION_TITLE_CLASS}>
						{t('friends.personCardOverviewTitle')}
					</h4>
				</div>
				<div className="mt-3 grid gap-3 text-sm text-(--desktop-text-secondary) sm:grid-cols-2">
					<div>
						<div>{t('friends.friendSinceLabel')}</div>
						<div>{friendshipSince ?? '—'}</div>
					</div>
					<div>
						<div>{t('friends.interactionLabel')}</div>
						<div>{lastInteraction ?? t('friends.personCardNoInteraction')}</div>
					</div>
					<div className={SH_FRIEND_CARD_REMINDER_PANEL_CLASS}>
						<div className="font-medium text-(--desktop-text-secondary)">
							{t('friends.personCardReminderTitle')}
						</div>
						<div className="mt-1 text-xs">
							{t('friends.personCardReminderHint')}
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
