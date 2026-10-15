/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Coordinates the Social Hub friend-card shell, state, shared-content query, and tab selection.
 *
 * Invariants:
 * - Public props and relationship callbacks remain stable.
 * - Shared content is fetched only while its tab is active.
 *
 * Related:
 * - ./friend-card/tabs/
 * - ../api/socialHubFeedApi.ts
 * ---
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UserCircleIcon } from '@heroicons/react/24/outline';

import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSkeleton,
	DesktopAppToolbar,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

import { fetchSocialHubSharedContent } from '../api/socialHubFeedApi';
import { SH_FRIEND_CARD_TOOLBAR_TITLE_CLASS } from '../social-hub/layout/socialHubLayoutTokens';
import { FriendsInfoButton } from './FriendsInfoButton';
import { createFriendCardFormatters } from './friend-card/friendPersonCardFormat';
import type {
	FriendCardTab,
	FriendPersonCardProps,
} from './friend-card/friendPersonCardTypes';
import { FriendCardNotesTab } from './friend-card/tabs/FriendCardNotesTab';
import {
	FriendCardOverviewTab,
	FriendCardTabRail,
} from './friend-card/tabs/FriendCardOverviewTab';
import { FriendCardPrivacyTab } from './friend-card/tabs/FriendCardPrivacyTab';
import { FriendCardSharedTab } from './friend-card/tabs/FriendCardSharedTab';
import { FriendCardTimelineTab } from './friend-card/tabs/FriendCardTimelineTab';

export function FriendPersonCard({
	friend,
	loading = false,
	saving = false,
	availableCircles = [],
	onClose,
	onOpenChat,
	onToggleFavorite,
	onToggleMute,
	onToggleBlock,
	onToggleShareActivity,
	onToggleCircle,
	onSaveNote,
	onReport,
}: FriendPersonCardProps): JSX.Element {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const shellInset = useMemo(
		() => getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		[shellFrame]
	);
	const noteTextareaClass = useMemo(
		() =>
			cn(
				'min-h-[132px] w-full rounded-xl border border-transparent bg-transparent px-3 py-3 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
				DESKTOP_CHROME_FOCUS_VISIBLE,
				'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb))]/30'
			),
		[]
	);
	const [draftNote, setDraftNote] = useState('');
	const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [reportReason, setReportReason] = useState('safety_concern');
	const [reportDetails, setReportDetails] = useState('');
	const [activeTab, setActiveTab] = useState<FriendCardTab>('overview');
	const friendId = friend?.id ?? null;
	const sharedContentQuery = useQuery({
		queryKey: ['social-hub', 'friend-shared-content', friendId],
		queryFn: () => fetchSocialHubSharedContent(friendId ?? '', { limit: 12 }),
		enabled: activeTab === 'shared' && Boolean(friendId),
		staleTime: 30_000,
		gcTime: 5 * 60_000,
		retry: 1,
	});
	const formatters = useMemo(
		() =>
			createFriendCardFormatters(
				t,
				i18n.resolvedLanguage || i18n.language || 'en'
			),
		[i18n.language, i18n.resolvedLanguage, t]
	);

	useEffect(
		() => setDraftNote(friend?.private_note ?? ''),
		[friend?.private_note]
	);
	useEffect(() => {
		void friendId;
		setBlockConfirmOpen(false);
		setReportOpen(false);
		setReportReason('safety_concern');
		setReportDetails('');
		setActiveTab('overview');
	}, [friendId]);

	if (loading) {
		return (
			<div
				className={cn('min-h-0', shellPanel, 'flex flex-col gap-4 p-5')}
				role="status"
				aria-live="polite"
				aria-busy="true"
				aria-label={t('friends.personCardLoading')}
			>
				<div className="flex items-center justify-between">
					<div>{t('friends.personCardLoading')}</div>
					{onClose ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							onClick={onClose}
							aria-label={t('friends.closePersonCard')}
						>
							<span aria-hidden>×</span>
						</DesktopAppButton>
					) : null}
				</div>
				<DesktopAppSkeleton className="h-24" />
				<DesktopAppSkeleton className="h-16" />
				<DesktopAppSkeleton className="h-40" />
			</div>
		);
	}
	if (!friend) {
		return (
			<div className={cn('min-h-0', shellPanel, 'p-0')}>
				<DesktopAppToolbar className="justify-between px-4 py-4">
					<div className={SH_FRIEND_CARD_TOOLBAR_TITLE_CLASS}>
						<span>{t('friends.personCardTitle')}</span>
						<FriendsInfoButton
							title={t('friends.personCardTitle')}
							description={t('friends.helpPersonCard')}
						/>
					</div>
					{onClose ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							onClick={onClose}
							aria-label={t('friends.closePersonCard')}
						>
							<span aria-hidden>×</span>
						</DesktopAppButton>
					) : null}
				</DesktopAppToolbar>
				<DesktopAppEmptyState
					className="py-12"
					icon={
						<UserCircleIcon
							className="h-7 w-7 text-(--desktop-text-dim)"
							aria-hidden
						/>
					}
					title={t('friends.personCardEmptyTitle')}
					description={t('friends.personCardEmptyDescription')}
				/>
			</div>
		);
	}

	const friendshipSince = formatters.formatCalendarDate(
		friend.friendship_created_at
	);
	const lastActivity = formatters.formatRelativeTimestamp(
		friend.last_activity_at
	);
	const lastInteraction = formatters.formatRelativeTimestamp(
		friend.last_interaction_at
	);
	const timelineItems = [
		friend.friendship_created_at
			? {
					id: 'friendship',
					label: t('friends.personCardTimelineFriendship'),
					value: friendshipSince,
				}
			: null,
		friend.last_activity_at
			? {
					id: 'activity',
					label: t('friends.personCardTimelineActivity'),
					value: lastActivity,
				}
			: null,
		friend.last_interaction_at
			? {
					id: 'interaction',
					label: t('friends.personCardTimelineInteraction'),
					value: lastInteraction,
				}
			: null,
		friend.note_updated_at
			? {
					id: 'note',
					label: t('friends.personCardTimelineNote'),
					value: formatters.formatRelativeTimestamp(friend.note_updated_at),
				}
			: null,
	].filter((item): item is NonNullable<typeof item> => item !== null);
	const privacyCount = [
		friend.is_muted,
		friend.is_blocked,
		!friend.share_activity_with_friend,
		!friend.activity_visible_to_current_user,
	].filter(Boolean).length;
	const relationshipActionDescriptionKey = friend.is_blocked
		? 'friends.relationshipActionBlocked'
		: friend.is_muted
			? 'friends.relationshipActionMuted'
			: !friend.share_activity_with_friend ||
					!friend.activity_visible_to_current_user
				? 'friends.relationshipActionPrivacy'
				: !friend.last_interaction_at
					? 'friends.relationshipActionStart'
					: 'friends.relationshipActionReady';
	return (
		<div className={cn('min-h-0 overflow-hidden', shellPanel, 'p-0')}>
			<DesktopAppToolbar className="justify-between border-b px-4 py-4">
				<div className={SH_FRIEND_CARD_TOOLBAR_TITLE_CLASS}>
					<span>{t('friends.personCardTitle')}</span>
					<FriendsInfoButton
						title={t('friends.personCardTitle')}
						description={t('friends.helpPersonCard')}
					/>
				</div>
				{onClose ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
						aria-label={t('friends.closePersonCard')}
					>
						<span aria-hidden>×</span>
					</DesktopAppButton>
				) : null}
			</DesktopAppToolbar>
			<div className="space-y-5 px-5 pb-5">
				<FriendCardTabRail
					t={t}
					activeTab={activeTab}
					noteCount={friend.private_note?.trim() ? 1 : 0}
					sharedCount={sharedContentQuery.data?.items.length}
					privacyCount={privacyCount}
					timelineCount={timelineItems.length}
					onSelect={setActiveTab}
				/>
				{activeTab !== 'overview' ? (
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => setActiveTab('shared')}
						>
							{t('friends.relationshipActionOpenShared')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => setActiveTab('privacy')}
						>
							{t('friends.relationshipActionOpenPrivacy')}
						</DesktopAppButton>
					</div>
				) : null}
				{activeTab === 'overview' ? (
					<FriendCardOverviewTab
						t={t}
						friend={friend}
						saving={saving}
						shellInset={shellInset}
						friendshipSince={friendshipSince}
						lastActivity={lastActivity}
						lastInteraction={lastInteraction}
						relationshipActionDescriptionKey={relationshipActionDescriptionKey}
						onOpenChat={onOpenChat}
						onToggleFavorite={onToggleFavorite}
						onSelectTab={setActiveTab}
					/>
				) : null}
				{activeTab === 'notes' ? (
					<FriendCardNotesTab
						t={t}
						friend={friend}
						saving={saving}
						draftNote={draftNote}
						noteTextareaClass={noteTextareaClass}
						onSaveNote={onSaveNote}
						setDraftNote={setDraftNote}
					/>
				) : null}
				{activeTab === 'privacy' ? (
					<FriendCardPrivacyTab
						t={t}
						friend={friend}
						saving={saving}
						availableCircles={availableCircles}
						blockConfirmOpen={blockConfirmOpen}
						reportOpen={reportOpen}
						reportReason={reportReason}
						reportDetails={reportDetails}
						onToggleMute={onToggleMute}
						onToggleBlock={onToggleBlock}
						onToggleShareActivity={onToggleShareActivity}
						onToggleCircle={onToggleCircle}
						onReport={onReport}
						setBlockConfirmOpen={setBlockConfirmOpen}
						setReportOpen={setReportOpen}
						setReportReason={setReportReason}
						setReportDetails={setReportDetails}
					/>
				) : null}
				{activeTab === 'shared' ? (
					<FriendCardSharedTab
						t={t}
						items={sharedContentQuery.data?.items ?? []}
						isLoading={sharedContentQuery.isLoading}
						isError={sharedContentQuery.isError}
						isFetching={sharedContentQuery.isFetching}
						onRefresh={() => void sharedContentQuery.refetch()}
					/>
				) : null}
				{activeTab === 'timeline' ? (
					<FriendCardTimelineTab
						t={t}
						friend={friend}
						items={timelineItems}
						onOpenChat={onOpenChat}
						onSelectNotes={() => setActiveTab('notes')}
					/>
				) : null}
			</div>
		</div>
	);
}

export default FriendPersonCard;
