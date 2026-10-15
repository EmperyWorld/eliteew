/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Social Hub friend list surface with filters, selection state and row actions.
 *
 * Invariants:
 * - Row actions stay delegated to `FriendActionMenu`; this component does not mutate relationships directly.
 * - Selection is caller-owned so Friends/Circles tabs can share the same focused profile card.
 *
 * Related:
 * - FriendsDirectory.tsx
 * - FriendPersonCard.tsx
 */

import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopAppEmptyState } from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { UserAccountBadges } from '@/components/ui/UserAccountBadges';
import { cn } from '@/utils/cn';

import type { Friend } from '../types';
import {
	SH_DIRECTORY_DESC_CLASS,
	SH_DIRECTORY_FILTER_WRAP_CLASS,
	SH_DIRECTORY_LIST_TITLE_CLASS,
	SH_DIRECTORY_LOADING_WRAP_CLASS,
	SH_DIRECTORY_METRIC_ROW_CLASS,
	SH_FRIEND_LIST_ROW_ACCENT_CLASS,
	shDirectoryCountBadgeClass,
	shDirectoryMetricChipClass,
	shDirectoryPanelGlowClass,
	shFriendListRowClass,
} from '../social-hub/layout/socialHubLayoutTokens';
import {
	FriendActionMenu,
	type FriendActionDescriptor,
} from './FriendActionMenu';
import { FriendAvatar, getFriendDisplayName } from './FriendAvatar';
import {
	ArrowPathIcon,
	BellSlashIcon,
	NoSymbolIcon,
	StarIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

interface FriendListProps {
	title: string;
	items: Friend[];
	loading?: boolean;
	emptyMessage: string;
	ariaLabel?: string;
	getSubtitle?: (friend: Friend) => string | null;
	actionsForFriend?: (friend: Friend) => FriendActionDescriptor[];
	onSelectFriend?: (friend: Friend) => void;
	selectedFriendId?: string | null;
	description?: string;
	count?: number;
	headerAction?: ReactNode;
	filterControls?: ReactNode;
}

export function FriendList({
	title,
	items,
	loading = false,
	emptyMessage,
	ariaLabel,
	getSubtitle,
	actionsForFriend,
	onSelectFriend,
	selectedFriendId = null,
	description,
	count,
	headerAction,
	filterControls,
}: FriendListProps): JSX.Element {
	const { t } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const listRowIdle = useMemo(
		() => getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		[shellFrame]
	);
	const shownCount = items.length;
	const favoriteCount = items.filter((friend) => friend.is_favorite).length;
	const limitedCount = items.filter(
		(friend) => friend.is_muted || friend.is_blocked
	).length;

	return (
		<div className={cn('relative min-h-0 overflow-hidden', shellPanel, 'p-5')}>
			<span aria-hidden className={shDirectoryPanelGlowClass('friends')} />
			<div className="relative mb-4 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<h3 className={SH_DIRECTORY_LIST_TITLE_CLASS}>{title}</h3>
						<span
							className={shDirectoryCountBadgeClass(listRowIdle, 'neutral')}
						>
							{count ?? items.length}
						</span>
					</div>
					{description ? (
						<p className={SH_DIRECTORY_DESC_CLASS}>{description}</p>
					) : null}
					<div className={SH_DIRECTORY_METRIC_ROW_CLASS}>
						<span className={shDirectoryMetricChipClass('neutral')}>
							{t('friends.friendListMetricShown', { count: shownCount })}
						</span>
						<span className={shDirectoryMetricChipClass('favorite')}>
							{t('friends.friendListMetricFavorites', { count: favoriteCount })}
						</span>
						<span
							className={shDirectoryMetricChipClass(
								limitedCount > 0 ? 'limitedAlert' : 'limitedClear'
							)}
						>
							{t('friends.friendListMetricLimited', { count: limitedCount })}
						</span>
					</div>
				</div>
				{headerAction}
			</div>
			{filterControls ? (
				<div className={cn(listRowIdle, SH_DIRECTORY_FILTER_WRAP_CLASS)}>
					{filterControls}
				</div>
			) : null}
			{loading ? (
				<div
					className={SH_DIRECTORY_LOADING_WRAP_CLASS}
					role="status"
					aria-live="polite"
					aria-busy="true"
					aria-label={t('friends.socialHubDirectoryLoadingAria')}
				>
					<ArrowPathIcon
						className="h-6 w-6 animate-spin motion-reduce:animate-none"
						aria-hidden
					/>
				</div>
			) : items.length === 0 ? (
				<DesktopAppEmptyState
					className="py-10"
					icon={
						<UsersIcon
							className="h-6 w-6 text-(--desktop-text-dim)"
							aria-hidden
						/>
					}
					title={emptyMessage}
				/>
			) : (
				<ul className="relative space-y-2.5" aria-label={ariaLabel ?? title}>
					{items.map((friend) => {
						const subtitle = getSubtitle?.(friend) ?? null;
						const actions = actionsForFriend?.(friend) ?? [];
						const isSelected = selectedFriendId === friend.id;
						const displayName = getFriendDisplayName(
							friend.username,
							friend.full_name,
							t('friends.anonymousUser')
						);

						return (
							<li
								key={friend.id}
								className={shFriendListRowClass(isSelected, listRowIdle)}
							>
								<span
									aria-hidden
									className={cn(
										'pointer-events-none absolute inset-x-0 top-0 h-10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_72%)] transition-opacity',
										isSelected
											? 'opacity-100'
											: 'opacity-0 group-hover:opacity-100'
									)}
								/>
								{isSelected ? (
									<span
										aria-hidden
										className={SH_FRIEND_LIST_ROW_ACCENT_CLASS}
									/>
								) : null}
								<button
									type="button"
									onClick={() => onSelectFriend?.(friend)}
									className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40 focus-visible:ring-offset-2  focus-visible:ring-offset-(--desktop-surface-soft)"
									aria-label={
										onSelectFriend
											? t('friends.openPersonCardNamed', { name: displayName })
											: undefined
									}
									aria-current={isSelected ? 'true' : undefined}
								>
									<FriendAvatar
										avatarUrl={friend.avatar_url}
										username={friend.username}
										fullName={friend.full_name}
										alt={title}
									/>
									<div className="min-w-0">
										<span
											className={`flex items-center gap-2 truncate font-medium ${isSelected ? 'text-cyan-50' : 'text-(--desktop-text-primary)'}`}
										>
											<span className="truncate">{displayName}</span>
											<UserAccountBadges
												isTrusted={friend.is_trusted}
												adminBadgeLabel={friend.admin_badge_label}
												adminBadgeHint={friend.admin_badge_hint}
												className="shrink-0"
											/>
											{friend.is_favorite ? (
												<StarIcon
													className="h-3.5 w-3.5 fill-current text-amber-400"
													aria-hidden
												/>
											) : null}
											{friend.is_muted ? (
												<BellSlashIcon
													className="h-3.5 w-3.5 text-slate-400"
													aria-hidden
												/>
											) : null}
											{friend.is_blocked ? (
												<NoSymbolIcon
													className="h-3.5 w-3.5 text-rose-400"
													aria-hidden
												/>
											) : null}
										</span>
										{subtitle ? (
											<span
												className={`block truncate text-xs ${isSelected ? 'text-cyan-100/75' : 'text-(--desktop-text-muted)'}`}
											>
												{subtitle}
											</span>
										) : null}
									</div>
								</button>
								<FriendActionMenu actions={actions} />
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
