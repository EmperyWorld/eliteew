/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose Social Hub Friends Directory data, mutations, and focused directory sections.
 * Section layout, filter state, and action feedback are delegated to dedicated modules.
 *
 * Invariants:
 * - Friend queries pause when the embedded Social Hub tab is inactive.
 * - Deep-link focus may select a friend, but the server overview remains authoritative.
 *
 * Related:
 * - ./directory/FriendsDirectoryOverviewStrip.tsx
 * - ../hooks/useFriendsDirectoryFilters.ts
 * - api/routers/friends.py
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UsersIcon } from '@heroicons/react/24/outline';

import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

import { useFriendsDirectoryActions } from '../hooks/useFriendsDirectoryActions';
import { useFriendsDirectoryFilters } from '../hooks/useFriendsDirectoryFilters';
import { useFriendProfile, useFriendsOverview } from '../hooks/useFriends';
import {
	getActivitySummary,
	getCircleSummary,
	getRelationshipFlagsSummary,
} from '../utils/friendDirectoryFormat';
import type { Friend, FriendProfile } from '../types';
import { FriendList } from './FriendList';
import { FriendsInfoButton } from './FriendsInfoButton';
import { FriendPersonCard } from './FriendPersonCard';
import {
	type FriendRequestOutcomeFlash,
	FriendRequestList,
} from './FriendRequestList';
import { FriendsDirectoryCirclesSection } from './directory/FriendsDirectoryCirclesSection';
import {
	FriendsDirectoryFilters,
	FriendsDirectoryOverviewStrip,
} from './directory/FriendsDirectoryOverviewStrip';
import { FriendsDirectorySearchSection } from './directory/FriendsDirectorySearchSection';

interface FriendsDirectoryProps {
	enabled?: boolean;
	onSuccess?: (message: string) => void;
	onError?: (message: string) => void;
	onOpenChat?: (friend: Friend) => void;
	initialFriendUserId?: string | null;
	initialSection?: 'friends' | 'circles';
	anchorPrefix?: string;
}

export function FriendsDirectory({
	enabled = true,
	onSuccess,
	onError,
	onOpenChat,
	initialFriendUserId = null,
	initialSection = 'friends',
	anchorPrefix = 'social-hub',
}: FriendsDirectoryProps): JSX.Element {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = getDesktopShellContentPanelClassName(shellFrame);
	const shellInset =
		getDesktopShellToolbarClusterInsetControlClassName(shellFrame);
	const shellField = cn(shellInset, DESKTOP_CHROME_FOCUS_VISIBLE);
	const overviewQuery = useFriendsOverview({ enabled });
	const friends = overviewQuery.data?.friends ?? [];
	const incomingRequests = overviewQuery.data?.incomingRequests ?? [];
	const sentRequests = overviewQuery.data?.sentRequests ?? [];
	const circles = overviewQuery.data?.circles ?? [];
	const stats = overviewQuery.data?.stats ?? {
		friendsCount: friends.length,
		incomingRequestsCount: incomingRequests.length,
		sentRequestsCount: sentRequests.length,
	};
	const filters = useFriendsDirectoryFilters({
		friends,
		circles,
		initialFriendUserId,
		anonymousLabel: t('friends.anonymousUser'),
	});
	const profileQuery = useFriendProfile(filters.selectedFriendId, { enabled });
	const [incomingOutcomeFlash, setIncomingOutcomeFlash] =
		useState<FriendRequestOutcomeFlash>(null);
	const formatter = useMemo(
		() =>
			new Intl.RelativeTimeFormat(
				i18n.resolvedLanguage || i18n.language || 'en',
				{
					numeric: 'auto',
				}
			),
		[i18n.language, i18n.resolvedLanguage]
	);
	const flashIncomingOutcome = useCallback(
		(id: string, kind: 'accepted' | 'rejected') => {
			setIncomingOutcomeFlash({ id, kind });
			window.setTimeout(
				() =>
					setIncomingOutcomeFlash((current) =>
						current?.id === id ? null : current
					),
				1200
			);
		},
		[]
	);
	const {
		actions,
		execute,
		friendActions,
		incomingActions,
		localError,
		openChat,
		sentActions,
	} = useFriendsDirectoryActions({
		onError,
		onIncomingOutcome: flashIncomingOutcome,
		onOpenChat,
		onSuccess,
		t,
	});
	const saveRelationship = (
		friendUserId: string,
		payload: Omit<
			Parameters<typeof actions.updateRelationship.mutateAsync>[0],
			'friendUserId'
		>,
		message: string
	) =>
		execute(
			() =>
				actions.updateRelationship.mutateAsync({ friendUserId, ...payload }),
			message
		);
	const assignBulk = () => {
		const circle = filters.selectedCircle;
		if (!circle || !filters.bulkSelectedFriends.length) return;
		void execute(
			() =>
				Promise.all(
					filters.bulkSelectedFriends.map((friend) => {
						const current = (friend.circles ?? []).map((item) => item.id);
						return current.includes(circle.id)
							? Promise.resolve()
							: actions.updateRelationship.mutateAsync({
									friendUserId: friend.id,
									circle_ids: [...current, circle.id],
								});
					})
				),
			t('friends.circleBulkAssignSuccess', { name: circle.name }),
			() => filters.setBulkSelectedFriendIds([])
		);
	};
	const relationshipSaving =
		actions.updateRelationship.isPending &&
		actions.updateRelationship.variables?.friendUserId ===
			filters.selectedFriendId;

	return (
		<div className="mb-6 space-y-6">
			{overviewQuery.isError ? (
				<DesktopAppPanel className="flex flex-col gap-3 border-rose-500/30 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm text-rose-100">
						{t('friends.networkLoadFailed')} {overviewQuery.error.message}
					</p>
					<DesktopAppButton
						type="button"
						variant="neutral"
						onClick={() => void overviewQuery.refetch()}
					>
						{t('friends.networkRetry')}
					</DesktopAppButton>
				</DesktopAppPanel>
			) : null}
			<FriendsDirectoryOverviewStrip
				anchorPrefix={anchorPrefix}
				initialSection={initialSection}
				shellInset={shellInset}
				shellPanel={shellPanel}
				stats={stats}
			/>
			<div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
				<div className="min-w-0 space-y-6">
					<FriendsDirectorySearchSection
						anchorPrefix={anchorPrefix}
						anonymousLabel={t('friends.anonymousUser')}
						execute={execute}
						localError={localError}
						onOpenChat={openChat}
						relationshipActions={actions}
						shellField={shellField}
						shellInset={shellInset}
						shellPanel={shellPanel}
					/>
					<div
						id={`${anchorPrefix}-requests`}
						className="grid grid-cols-1 gap-6 lg:grid-cols-2"
					>
						<FriendRequestList
							variant="incoming"
							title={t('friends.incomingTitle')}
							description={t('friends.incomingHint')}
							items={incomingRequests}
							loading={overviewQuery.isLoading}
							actionsForItem={incomingActions}
							outcomeFlash={incomingOutcomeFlash}
							emptyMessage={t('friends.incomingEmpty')}
							count={stats.incomingRequestsCount}
							headerAction={
								<FriendsInfoButton
									title={t('friends.incomingTitle')}
									description={t('friends.helpIncoming')}
								/>
							}
						/>
						<FriendRequestList
							variant="sent"
							title={t('friends.sentTitle')}
							description={t('friends.sentHint')}
							items={sentRequests}
							loading={overviewQuery.isLoading}
							actionsForItem={sentActions}
							emptyMessage={t('friends.sentEmpty')}
							count={stats.sentRequestsCount}
							headerAction={
								<FriendsInfoButton
									title={t('friends.sentTitle')}
									description={t('friends.helpSent')}
								/>
							}
						/>
					</div>
					<div id={`${anchorPrefix}-friends`}>
						<FriendList
							title={t('friends.listTitle')}
							description={t('friends.listHint')}
							items={filters.visibleFriends}
							loading={overviewQuery.isLoading}
							emptyMessage={t(
								filters.hasActiveFilter
									? 'friends.directoryFilterEmpty'
									: filters.selectedCircleId
										? 'friends.circleFilterEmpty'
										: 'friends.emptyList'
							)}
							ariaLabel={t('friends.listTitle')}
							selectedFriendId={filters.selectedFriendId}
							onSelectFriend={(friend) =>
								filters.setSelectedFriendId(friend.id)
							}
							count={filters.visibleFriends.length}
							actionsForFriend={friendActions}
							headerAction={
								<FriendsInfoButton
									title={t('friends.listTitle')}
									description={t('friends.helpList')}
								/>
							}
							filterControls={
								<FriendsDirectoryFilters
									filters={filters}
									shellField={shellField}
								/>
							}
							getSubtitle={(friend) => {
								const identity =
									friend.full_name &&
									friend.username &&
									friend.full_name.toLowerCase() !==
										friend.username.toLowerCase()
										? `@${friend.username}`
										: null;
								const parts = [
									identity,
									...getCircleSummary(friend),
									...getRelationshipFlagsSummary(friend, t),
									...getActivitySummary(friend, formatter, t),
								].filter(Boolean);
								return parts.length
									? parts.join(' · ')
									: friend.username
										? null
										: t('friends.noNickname');
							}}
						/>
					</div>
				</div>
				<div className="min-w-0 space-y-6">
					<FriendsDirectoryCirclesSection
						anchorPrefix={anchorPrefix}
						circles={circles}
						friends={friends}
						selectedCircle={filters.selectedCircle}
						selectedCircleId={filters.selectedCircleId}
						visibleFriendsCount={filters.visibleFriends.length}
						bulkSelectedCount={filters.bulkSelectedFriendIds.length}
						shellField={shellField}
						shellInset={shellInset}
						shellPanel={shellPanel}
						isCreating={actions.createCircle.isPending}
						isDeleting={actions.deleteCircle.isPending}
						isRenaming={actions.updateCircle.isPending}
						isSavingRelationship={actions.updateRelationship.isPending}
						onSelectCircle={filters.setSelectedCircleId}
						onSelectVisible={() =>
							filters.setBulkSelectedFriendIds(
								filters.visibleFriends.map((friend) => friend.id)
							)
						}
						onClearBulk={() => filters.setBulkSelectedFriendIds([])}
						onAssignBulk={assignBulk}
						onCreateCircle={(name, after) =>
							void execute(
								() => actions.createCircle.mutateAsync(name.trim()),
								t('friends.circleCreateSuccess', { name: name.trim() }),
								after
							)
						}
						onDeleteCircle={() => {
							const circle = filters.selectedCircle;
							if (!circle) return;
							void execute(
								() => actions.deleteCircle.mutateAsync(circle.id),
								t('friends.circleDeleteSuccess', { name: circle.name }),
								() => filters.setSelectedCircleId(null)
							);
						}}
						onRenameCircle={(name) => {
							const circle = filters.selectedCircle;
							if (!circle) return;
							void execute(
								() =>
									actions.updateCircle.mutateAsync({
										circleId: circle.id,
										name: name.trim(),
									}),
								t('friends.circleRenameSuccess', { name: name.trim() })
							);
						}}
					/>
					<div
						id={`${anchorPrefix}-detail`}
						className="min-w-0 xl:sticky xl:top-6 xl:self-start"
					>
						<FriendPersonCard
							friend={
								(profileQuery.data ??
									filters.selectedFriend) as FriendProfile | null
							}
							loading={
								Boolean(filters.selectedFriendId) && profileQuery.isLoading
							}
							saving={relationshipSaving}
							availableCircles={circles}
							onOpenChat={openChat}
							onToggleFavorite={(friend) =>
								void saveRelationship(
									friend.id,
									{ is_favorite: !friend.is_favorite },
									!friend.is_favorite
										? t('friends.favoriteAdd')
										: t('friends.favoriteRemove')
								)
							}
							onToggleMute={(friend) =>
								void saveRelationship(
									friend.id,
									{ is_muted: !friend.is_muted },
									t('friends.privacyUpdated')
								)
							}
							onToggleBlock={(friend) =>
								void saveRelationship(
									friend.id,
									{ is_blocked: !friend.is_blocked },
									t('friends.privacyUpdated')
								)
							}
							onToggleShareActivity={(friend) =>
								void saveRelationship(
									friend.id,
									{
										share_activity_with_friend:
											!friend.share_activity_with_friend,
									},
									t('friends.privacyUpdated')
								)
							}
							onToggleCircle={(friend, circleId) => {
								const existing = (friend.circles ?? []).map(
									(circle) => circle.id
								);
								void saveRelationship(
									friend.id,
									{
										circle_ids: existing.includes(circleId)
											? existing.filter((id) => id !== circleId)
											: [...existing, circleId],
									},
									t('friends.circleMembershipUpdated')
								);
							}}
							onSaveNote={(friend, note) =>
								void saveRelationship(
									friend.id,
									{ private_note: note },
									t('friends.privateNoteSaved')
								)
							}
							onReport={(friend, report) =>
								void execute(
									() =>
										actions.reportUser.mutateAsync({
											friendUserId: friend.id,
											reason: report.reason,
											details: report.details,
										}),
									t('friends.reportUserSubmitted')
								)
							}
							onClose={() => filters.setSelectedFriendId(null)}
						/>
					</div>
				</div>
			</div>
			{!overviewQuery.isLoading &&
			!friends.length &&
			!incomingRequests.length &&
			!sentRequests.length ? (
				<div
					className={cn(
						'min-h-0',
						shellPanel,
						'flex items-center gap-3 p-4 text-sm text-(--desktop-text-muted)'
					)}
				>
					<UsersIcon
						className="h-4 w-4 text-(--desktop-text-dim)"
						aria-hidden
					/>
					{t('friends.emptyList')}
				</div>
			) : null}
		</div>
	);
}
