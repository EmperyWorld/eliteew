/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Social Hub home section: single KPI row, recent contacts, and activity preview.
 *
 * Invariants:
 * - Uses bounded existing client APIs; no heavy friend profile or mobile download calls on mount.
 * - Navigation delegates to SocialHubShell section state only.
 * - Feed event types render as localized UI badges, never raw backend enum names.
 * - Home section eyebrows + KPI labels are sentence-case (no chrome uppercase shout).
 *
 * Related:
 * - SocialHubShell.tsx
 * - ../hooks/useSocialHubOverviewStats.ts
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	ChevronRightIcon,
	DevicePhoneMobileIcon,
	EyeSlashIcon,
	ShieldCheckIcon,
	SparklesIcon,
	UserGroupIcon,
	UserPlusIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSkeleton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import {
	fetchMobileAppOverview,
	formatMobileBuildLabel,
} from '@/services/mobileAppApi';
import { getProfilePrivacy } from '@/services/profileService';
import { cn } from '@/utils/cn';

import { fetchSocialHubFeed } from '../../api/socialHubFeedApi';
import type { Friend } from '../../types';
import { getFriendDisplayName } from '../../components/FriendAvatar';
import type { SocialHubPeopleSubview } from '../socialHubNavigation';
import { useSocialHubOverviewStats } from '../hooks/useSocialHubOverviewStats';
import { SocialHubKpiCard } from '../layout/SocialHubKpiCard';
import { SocialHubQuickActions } from '../layout/SocialHubQuickActions';
import {
	SH_ATTENTION_ROW_ACCENT_CLASS,
	SH_ATTENTION_ROW_CLASS,
	SH_FEED_CARD_CLASS,
	SH_FEED_EVENT_BADGE_CLASS,
	SH_FEED_STATUS_DOT_CLASS,
	SH_FEED_TIMESTAMP_CLASS,
	SH_FRIEND_INITIALS_AVATAR_CLASS,
	shHomeKpiGridClass,
	shHomeOverviewColumnsClass,
	SH_LIST_INTERACTIVE_ROW_CLASS,
	SH_PANEL_INSET_CLASS,
	SH_SECTION_EYEBROW_CLASS,
	SH_SECTION_STACK_CLASS,
	SH_SUBPANEL_HINT_CLASS,
	SH_SUBPANEL_TITLE_CLASS,
} from '../layout/socialHubLayoutTokens';

type SocialHubAttentionTarget =
	| { kind: 'people'; subview: SocialHubPeopleSubview }
	| { kind: 'privacy' }
	| { kind: 'phone' };

interface SocialHubHomeSectionProps {
	embeddedMobile?: boolean;
	onOpenPeople: (subview: SocialHubPeopleSubview) => void;
	onOpenPrivacy: () => void;
	onOpenPhone: () => void;
	onOpenFriend?: (friendId: string) => void;
}

type SocialHubAttentionItem = {
	id: string;
	label: string;
	action: string;
	target: SocialHubAttentionTarget;
};

const privacyQueryKey = ['profile', 'privacy', 'social-hub-overview'] as const;
const mobileOverviewQueryKey = [
	'mobile-app',
	'overview',
	'social-hub',
] as const;
const socialHubFeedQueryKey = ['social-hub', 'feed', 'overview'] as const;

function timestampOf(value?: string | null): number {
	if (!value) {
		return 0;
	}
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : 0;
}

function privacyRiskCount(
	privacy: Awaited<ReturnType<typeof getProfilePrivacy>>
): number {
	return [
		privacy.discoverability === 'hidden',
		privacy.avatar_visibility !== 'everyone',
		privacy.full_name_visibility !== 'everyone',
		privacy.bio_visibility !== 'everyone',
	].filter(Boolean).length;
}

function humanizeFeedType(type: string): string {
	return type.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function openAttentionTarget(
	target: SocialHubAttentionTarget,
	handlers: Pick<
		SocialHubHomeSectionProps,
		'onOpenPeople' | 'onOpenPrivacy' | 'onOpenPhone'
	>
): void {
	if (target.kind === 'people') {
		handlers.onOpenPeople(target.subview);
		return;
	}
	if (target.kind === 'privacy') {
		handlers.onOpenPrivacy();
		return;
	}
	handlers.onOpenPhone();
}

export default function SocialHubHomeSection({
	embeddedMobile = false,
	onOpenPeople,
	onOpenPrivacy,
	onOpenPhone,
	onOpenFriend,
}: SocialHubHomeSectionProps): JSX.Element {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = getDesktopShellContentPanelClassName(shellFrame);
	const {
		query: friendsOverviewQuery,
		friends,
		circles,
		incomingPending: overviewIncoming,
	} = useSocialHubOverviewStats(true);
	const privacyQuery = useQuery({
		queryKey: privacyQueryKey,
		queryFn: getProfilePrivacy,
		staleTime: 60_000,
		gcTime: 5 * 60_000,
		retry: 1,
	});
	const mobileQuery = useQuery({
		queryKey: mobileOverviewQueryKey,
		queryFn: fetchMobileAppOverview,
		staleTime: 60_000,
		gcTime: 5 * 60_000,
		retry: 1,
		enabled: !embeddedMobile,
	});
	const feedQuery = useQuery({
		queryKey: socialHubFeedQueryKey,
		queryFn: () => fetchSocialHubFeed({ limit: 5 }),
		staleTime: 30_000,
		gcTime: 5 * 60_000,
		retry: 1,
	});

	const incoming = friendsOverviewQuery.data?.incomingRequests ?? [];
	const sent = friendsOverviewQuery.data?.sentRequests ?? [];
	const favoriteCount = friends.filter((friend) => friend.is_favorite).length;
	const blockedOrMutedCount = friends.filter(
		(friend) => friend.is_blocked || friend.is_muted
	).length;
	const recentFriends = useMemo(
		() =>
			[...friends]
				.sort(
					(a, b) =>
						Math.max(
							timestampOf(b.last_interaction_at),
							timestampOf(b.last_activity_at)
						) -
						Math.max(
							timestampOf(a.last_interaction_at),
							timestampOf(a.last_activity_at)
						)
				)
				.slice(0, 4),
		[friends]
	);
	const anonymousLabel = t('friends.anonymousUser');
	const feedItems = feedQuery.data?.items ?? [];
	const relativeTimeFormatter = useMemo(
		() =>
			new Intl.RelativeTimeFormat(
				i18n.resolvedLanguage || i18n.language || 'en',
				{ numeric: 'auto' }
			),
		[i18n.language, i18n.resolvedLanguage]
	);

	const formatRelative = (value?: string | null): string | null => {
		const timestamp = timestampOf(value);
		if (!timestamp) {
			return null;
		}
		const diffMinutes = Math.round((timestamp - Date.now()) / (1000 * 60));
		const absMinutes = Math.abs(diffMinutes);
		if (absMinutes < 60) {
			return relativeTimeFormatter.format(diffMinutes, 'minute');
		}
		const diffHours = Math.round(diffMinutes / 60);
		if (Math.abs(diffHours) < 24) {
			return relativeTimeFormatter.format(diffHours, 'hour');
		}
		return relativeTimeFormatter.format(Math.round(diffHours / 24), 'day');
	};
	const formatFeedType = (type: string): string =>
		t(`friends.socialHubOverviewFeedTypes.${type}`, {
			defaultValue: t('friends.socialHubOverviewFeedTypes.unknown', {
				type: humanizeFeedType(type),
			}),
		});

	const attentionItems: SocialHubAttentionItem[] = [];
	if (incoming.length > 0) {
		attentionItems.push({
			id: 'incoming',
			label: t('friends.socialHubOverviewIncomingAttention', {
				count: incoming.length,
			}),
			action: t('friends.socialHubOverviewOpenInbox'),
			target: { kind: 'people', subview: 'requests' },
		});
	}
	if (sent.length > 0) {
		attentionItems.push({
			id: 'sent',
			label: t('friends.socialHubOverviewSentAttention', {
				count: sent.length,
			}),
			action: t('friends.socialHubOverviewOpenInbox'),
			target: { kind: 'people', subview: 'requests' },
		});
	}
	if (privacyQuery.data && privacyRiskCount(privacyQuery.data) > 0) {
		attentionItems.push({
			id: 'privacy',
			label: t('friends.socialHubOverviewPrivacyAttention', {
				count: privacyRiskCount(privacyQuery.data),
			}),
			action: t('friends.socialHubOverviewOpenPrivacy'),
			target: { kind: 'privacy' },
		});
	}
	if (mobileQuery.data && !mobileQuery.data.apk_available && !embeddedMobile) {
		attentionItems.push({
			id: 'mobile',
			label: t('friends.socialHubOverviewMobileAttention'),
			action: t('friends.socialHubOverviewOpenMobile'),
			target: { kind: 'phone' },
		});
	}

	const kpis: Array<{
		id: string;
		label: string;
		value: number;
		icon: typeof UsersIcon;
		onClick: () => void;
	}> = [
		{
			id: 'friends',
			label: t('friends.socialHubOverviewKpiFriends'),
			value: friendsOverviewQuery.data?.stats.friendsCount ?? friends.length,
			icon: UsersIcon,
			onClick: () => onOpenPeople('contacts'),
		},
		{
			id: 'incoming',
			label: t('friends.socialHubOverviewKpiIncoming'),
			value:
				friendsOverviewQuery.data?.stats.incomingRequestsCount ??
				incoming.length,
			icon: UserPlusIcon,
			onClick: () => onOpenPeople('requests'),
		},
		{
			id: 'sent',
			label: t('friends.socialHubOverviewKpiSent'),
			value: friendsOverviewQuery.data?.stats.sentRequestsCount ?? sent.length,
			icon: UserGroupIcon,
			onClick: () => onOpenPeople('requests'),
		},
		{
			id: 'favorites',
			label: t('friends.socialHubOverviewKpiFavorites'),
			value: favoriteCount,
			icon: SparklesIcon,
			onClick: () => onOpenPeople('contacts'),
		},
		{
			id: 'limited',
			label: t('friends.socialHubOverviewKpiLimited'),
			value: blockedOrMutedCount,
			icon: EyeSlashIcon,
			onClick: () => onOpenPeople('contacts'),
		},
	];

	return (
		<section
			className={cn(SH_SECTION_STACK_CLASS, 'text-(--desktop-text-primary)')}
			aria-label={t('friends.socialHubKpiAria')}
		>
			<SocialHubQuickActions
				incomingCount={overviewIncoming}
				onOpenPeople={onOpenPeople}
				onOpenPrivacy={onOpenPrivacy}
				onOpenPhone={onOpenPhone}
			/>

			<div>
				<div className={cn(SH_SECTION_EYEBROW_CLASS, 'mb-3 px-0.5')}>
					{t('friends.socialHubHomeKpiSectionLabel')}
				</div>
				<div className={shHomeKpiGridClass(embeddedMobile)}>
					{kpis.map((item) => (
						<SocialHubKpiCard
							key={item.id}
							label={item.label}
							value={item.value}
							icon={item.icon}
							emphasize={item.id === 'incoming' && item.value > 0}
							shellPanel={shellPanel}
							onClick={item.onClick}
						/>
					))}
				</div>
			</div>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
				<DesktopAppPanel className={SH_PANEL_INSET_CLASS}>
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<h3 className={SH_SUBPANEL_TITLE_CLASS}>
								{t('friends.socialHubOverviewAttentionTitle')}
							</h3>
							<p className={SH_SUBPANEL_HINT_CLASS}>
								{t('friends.socialHubOverviewAttentionHint')}
							</p>
						</div>
						{friendsOverviewQuery.isFetching ? (
							<ArrowPathIcon
								className="h-4 w-4 animate-spin text-(--desktop-text-muted) motion-reduce:animate-none"
								aria-hidden
							/>
						) : null}
					</div>
					{friendsOverviewQuery.isLoading ? (
						<div
							role="status"
							aria-live="polite"
							aria-busy="true"
							aria-label={t('friends.socialHubOverviewLoading')}
						>
							<DesktopAppSkeleton className="h-28 rounded-(--desktop-radius-lg)" />
						</div>
					) : attentionItems.length === 0 ? (
						<DesktopAppEmptyState
							className="py-10"
							icon={
								<CheckCircleIcon
									className="h-6 w-6 text-(--desktop-text-dim)"
									aria-hidden
								/>
							}
							title={t('friends.socialHubOverviewAttentionEmpty')}
							description={t('friends.socialHubOverviewAttentionEmptyHint')}
						>
							<div className="flex flex-wrap justify-center gap-2">
								<DesktopAppButton
									type="button"
									size="sm"
									variant="neutral"
									onClick={() => onOpenPeople('contacts')}
								>
									{t('friends.socialHubOverviewOpenFriends')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="neutral"
									onClick={onOpenPrivacy}
								>
									{t('friends.socialHubOverviewOpenPrivacy')}
								</DesktopAppButton>
							</div>
						</DesktopAppEmptyState>
					) : (
						<div className="space-y-2">
							{attentionItems.map((item) => (
								<div key={item.id} className={SH_ATTENTION_ROW_CLASS}>
									<span aria-hidden className={SH_ATTENTION_ROW_ACCENT_CLASS} />
									<p className="relative text-sm text-(--desktop-text-secondary)">
										{item.label}
									</p>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										onClick={() =>
											openAttentionTarget(item.target, {
												onOpenPeople,
												onOpenPrivacy,
												onOpenPhone,
											})
										}
									>
										{item.action}
									</DesktopAppButton>
								</div>
							))}
						</div>
					)}
				</DesktopAppPanel>

				<DesktopAppPanel className={SH_PANEL_INSET_CLASS}>
					<h3 className={SH_SUBPANEL_TITLE_CLASS}>
						{t('friends.socialHubOverviewRecentTitle')}
					</h3>
					<p className={SH_SUBPANEL_HINT_CLASS}>
						{t('friends.socialHubOverviewRecentHint')}
					</p>
					<div className="mt-4 space-y-2">
						{recentFriends.length === 0 ? (
							<DesktopAppEmptyState
								className="py-8"
								icon={
									<UsersIcon
										className="h-6 w-6 text-(--desktop-text-dim)"
										aria-hidden
									/>
								}
								title={t('friends.socialHubOverviewRecentEmpty')}
							>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="accent"
									onClick={() => onOpenPeople('contacts')}
								>
									{t('friends.socialHubOverviewRecentEmptyAction')}
								</DesktopAppButton>
							</DesktopAppEmptyState>
						) : (
							recentFriends.map((friend: Friend) => {
								const activity =
									formatRelative(friend.last_interaction_at) ??
									formatRelative(friend.last_activity_at) ??
									t('friends.socialHubOverviewRecentNoActivity');
								return (
									<button
										key={friend.id}
										type="button"
										onClick={() => onOpenFriend?.(friend.id)}
										className={cn(SH_LIST_INTERACTIVE_ROW_CLASS, 'group')}
									>
										<div className="flex items-center justify-between gap-3">
											<div className="flex min-w-0 items-center gap-3">
												<span
													aria-hidden
													className={SH_FRIEND_INITIALS_AVATAR_CLASS}
												>
													{getFriendDisplayName(
														friend.username,
														friend.full_name,
														anonymousLabel
													)
														.trim()
														.charAt(0)
														.toUpperCase() || '?'}
												</span>
												<div className="truncate text-sm font-medium">
													{getFriendDisplayName(
														friend.username,
														friend.full_name,
														anonymousLabel
													)}
												</div>
											</div>
											<ChevronRightIcon
												className={cn(
													DESKTOP_LUCIDE.sm,
													'shrink-0 text-(--desktop-text-dim) motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-(--desktop-accent)'
												)}
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
										</div>
										<div className="mt-1 truncate text-xs text-(--desktop-text-muted)">
											{activity}
											{friend.circles?.length
												? ` · ${friend.circles.map((circle) => circle.name).join(', ')}`
												: ''}
										</div>
									</button>
								);
							})
						)}
					</div>
				</DesktopAppPanel>
			</div>

			<div className={shHomeOverviewColumnsClass(embeddedMobile)}>
				<DesktopAppPanel className={SH_PANEL_INSET_CLASS}>
					<div className="flex items-start gap-3">
						<SparklesIcon
							className={cn(DESKTOP_LUCIDE.md, 'text-(--desktop-accent)')}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						<div className="min-w-0 flex-1">
							<h3 className={SH_SUBPANEL_TITLE_CLASS}>
								{t('friends.socialHubOverviewFeedTitle')}
							</h3>
							<div className="mt-2 space-y-2">
								{feedQuery.isLoading ? (
									<p
										className="text-xs text-(--desktop-text-muted)"
										role="status"
										aria-live="polite"
									>
										{t('friends.socialHubOverviewLoading')}
									</p>
								) : feedItems.length ? (
									feedItems.slice(0, 3).map((item) => (
										<div key={item.id} className={SH_FEED_CARD_CLASS}>
											<div className="flex items-start gap-2">
												<span
													aria-hidden
													className={SH_FEED_STATUS_DOT_CLASS}
												/>
												<div className="min-w-0 flex-1">
													<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
														<span className="font-medium text-(--desktop-text-secondary)">
															{item.username ??
																item.full_name ??
																t('friends.anonymousUser')}
														</span>
														<span className={SH_FEED_EVENT_BADGE_CLASS}>
															{formatFeedType(item.type)}
														</span>
														<span className={SH_FEED_TIMESTAMP_CLASS}>
															{formatRelative(item.created_at)}
														</span>
													</div>
													<div className="mt-0.5">
														{item.summary ??
															t('friends.socialHubOverviewFeedEvent', {
																type: formatFeedType(item.type),
															})}
													</div>
												</div>
											</div>
										</div>
									))
								) : (
									<p className="text-xs text-(--desktop-text-muted)">
										{t('friends.socialHubOverviewFeedEmpty')}
									</p>
								)}
							</div>
						</div>
					</div>
				</DesktopAppPanel>
				<DesktopAppPanel className={SH_PANEL_INSET_CLASS}>
					<div className="flex items-start gap-3">
						<ShieldCheckIcon
							className={cn(DESKTOP_LUCIDE.md, 'text-(--desktop-accent)')}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						<div className="min-w-0 flex-1">
							<h3 className={SH_SUBPANEL_TITLE_CLASS}>
								{t('friends.socialHubOverviewPrivacyTitle')}
							</h3>
							<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
								{privacyQuery.data
									? t('friends.socialHubOverviewPrivacySummary', {
											discoverability: t(
												`friends.socialHubOverviewPrivacyDiscoverability.${privacyQuery.data.discoverability}`
											),
											count: privacyRiskCount(privacyQuery.data),
										})
									: privacyQuery.isLoading
										? t('friends.socialHubOverviewLoading')
										: t('friends.socialHubOverviewPrivacyUnavailable')}
							</p>
						</div>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="neutral"
							onClick={onOpenPrivacy}
						>
							{t('friends.socialHubOverviewOpenProfile')}
						</DesktopAppButton>
					</div>
				</DesktopAppPanel>
				{!embeddedMobile ? (
					<DesktopAppPanel className={SH_PANEL_INSET_CLASS}>
						<div className="flex items-start gap-3">
							<DevicePhoneMobileIcon
								className={cn(DESKTOP_LUCIDE.md, 'text-(--desktop-accent)')}
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							<div className="min-w-0 flex-1">
								<h3 className={SH_SUBPANEL_TITLE_CLASS}>
									{t('friends.socialHubOverviewMobileTitle')}
								</h3>
								<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
									{mobileQuery.data
										? t('friends.socialHubOverviewMobileSummary', {
												status: mobileQuery.data.mobile_session?.live
													? t('friends.mobileApp.statusLive')
													: mobileQuery.data.mobile_session?.active
														? t('friends.mobileApp.statusActive')
														: t('friends.mobileApp.statusOffline'),
												build:
													formatMobileBuildLabel(
														mobileQuery.data.version_name,
														mobileQuery.data.version_code
													) ?? '—',
												circles: circles.length,
											})
										: mobileQuery.isLoading
											? t('friends.socialHubOverviewLoading')
											: t('friends.socialHubOverviewMobileUnavailable')}
								</p>
							</div>
							<DesktopAppButton
								type="button"
								size="sm"
								variant="neutral"
								onClick={onOpenPhone}
							>
								{t('friends.socialHubOverviewOpenMobile')}
							</DesktopAppButton>
						</div>
					</DesktopAppPanel>
				) : null}
			</div>
		</section>
	);
}
