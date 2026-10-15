/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Social Hub Action Inbox backed by bounded, privacy-safe backend summary cards.
 *
 * Invariants:
 * - Inbox cards are summaries only; do not render private notes, messages, or raw profile fields.
 * - Backend target tabs are treated as hints and must be whitelisted before changing SocialHubApp state.
 * - Empty state always offers a clear next action back to Overview or Friends.
 *
 * Related:
 * - ../api/socialHubFeedApi.ts
 * - api/routers/social_hub.py
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	BellAlertIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
	ShieldCheckIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSkeleton,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

import {
	fetchSocialHubActionInbox,
	type SocialHubActionInboxItem,
} from '../api/socialHubFeedApi';
import {
	shInboxLoadingGridClass,
	SH_INBOX_CARD_ICON_WRAP_CLASS,
	SH_INBOX_CARD_META_TIMESTAMP_CLASS,
	SH_INBOX_CARD_TITLE_CLASS,
	SH_INBOX_META_CHIP_CLASS,
	SH_PANEL_HEADER_DESC_CLASS,
	SH_PANEL_HEADER_TITLE_CLASS,
	shInboxSeverityPanelClass,
} from '../social-hub/layout/socialHubLayoutTokens';

export type SocialHubActionTargetTab =
	| 'overview'
	| 'inbox'
	| 'friends'
	| 'circles'
	| 'privacy';

interface SocialHubActionInboxPanelProps {
	onSelectTarget: (
		tab: SocialHubActionTargetTab,
		targetId?: string | null
	) => void;
	/** MobileAndroid embedded WebView — single-column inbox grid. */
	embeddedMobileLayout?: boolean;
}

const actionInboxQueryKey = ['social-hub', 'action-inbox'] as const;

function isTargetTab(value: string | null): value is SocialHubActionTargetTab {
	return (
		value === 'overview' ||
		value === 'inbox' ||
		value === 'friends' ||
		value === 'circles' ||
		value === 'privacy'
	);
}

function severityLabelKey(severity: string): string {
	if (severity === 'high') return 'friends.socialHubInboxSeverityHigh';
	if (severity === 'medium') return 'friends.socialHubInboxSeverityMedium';
	return 'friends.socialHubInboxSeverityLow';
}

function getActionIcon(item: SocialHubActionInboxItem): typeof BellAlertIcon {
	if (item.type === 'privacy_review') {
		return ShieldCheckIcon;
	}
	if (item.severity === 'high' || item.severity === 'medium') {
		return ExclamationTriangleIcon;
	}
	return BellAlertIcon;
}

function targetTabLabelKey(tab: SocialHubActionTargetTab): string {
	if (tab === 'overview') return 'friends.socialHubSectionHome';
	if (tab === 'inbox') return 'friends.socialHubPeopleSubviewRequests';
	if (tab === 'friends') return 'friends.socialHubPeopleSubviewContacts';
	if (tab === 'circles') return 'friends.socialHubPeopleSubviewLists';
	return 'friends.socialHubSectionPrivacy';
}

function actionTitleKey(type: string): string | null {
	if (type === 'incoming_requests')
		return 'friends.socialHubInboxIncomingTitle';
	if (type === 'stale_sent_requests')
		return 'friends.socialHubInboxStaleSentTitle';
	if (type === 'privacy_review') return 'friends.socialHubInboxPrivacyTitle';
	if (type === 'relationship_controls')
		return 'friends.socialHubInboxRelationshipTitle';
	if (type === 'empty_circles')
		return 'friends.socialHubInboxEmptyCirclesTitle';
	return null;
}

function actionSummaryKey(type: string): string | null {
	if (type === 'incoming_requests')
		return 'friends.socialHubInboxIncomingSummary';
	if (type === 'stale_sent_requests')
		return 'friends.socialHubInboxStaleSentSummary';
	if (type === 'privacy_review') return 'friends.socialHubInboxPrivacySummary';
	if (type === 'relationship_controls')
		return 'friends.socialHubInboxRelationshipSummary';
	if (type === 'empty_circles')
		return 'friends.socialHubInboxEmptyCirclesSummary';
	return null;
}

function timestampOf(value?: string | null): number {
	if (!value) return 0;
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : 0;
}

export default function SocialHubActionInboxPanel({
	onSelectTarget,
	embeddedMobileLayout = false,
}: SocialHubActionInboxPanelProps): JSX.Element {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = getDesktopShellContentPanelClassName(shellFrame);
	const inboxQuery = useQuery({
		queryKey: actionInboxQueryKey,
		queryFn: () => fetchSocialHubActionInbox({ limit: 12 }),
		staleTime: 30_000,
		gcTime: 5 * 60_000,
		retry: 1,
	});
	const items = inboxQuery.data?.items ?? [];
	const totalCount = useMemo(
		() => items.reduce((sum, item) => sum + Math.max(0, item.count), 0),
		[items]
	);
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
		if (!timestamp) return null;
		const diffMinutes = Math.round((timestamp - Date.now()) / (1000 * 60));
		const absMinutes = Math.abs(diffMinutes);
		if (absMinutes < 60)
			return relativeTimeFormatter.format(diffMinutes, 'minute');
		const diffHours = Math.round(diffMinutes / 60);
		const absHours = Math.abs(diffHours);
		if (absHours < 24) return relativeTimeFormatter.format(diffHours, 'hour');
		return relativeTimeFormatter.format(Math.round(diffHours / 24), 'day');
	};

	return (
		<div className="space-y-4 text-(--desktop-text-primary)">
			<div>
				<h2 className={SH_PANEL_HEADER_TITLE_CLASS}>
					<BellAlertIcon
						className="h-5 w-5 text-(--desktop-accent)"
						aria-hidden
					/>
					{t('friends.socialHubInboxTitle')}
				</h2>
				<p className={SH_PANEL_HEADER_DESC_CLASS}>
					{t('friends.socialHubInboxSubtitle')}
					{totalCount > 0
						? ` · ${t('friends.socialHubInboxCount', { count: totalCount })}`
						: ''}
				</p>
			</div>

			{inboxQuery.isLoading ? (
				<div
					className={shInboxLoadingGridClass(embeddedMobileLayout)}
					role="status"
					aria-live="polite"
					aria-busy="true"
					aria-label={t('friends.socialHubInboxLoadingAria')}
				>
					<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
					<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
					<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
				</div>
			) : inboxQuery.isError ? (
				<DesktopProductStatusBanner
					tone="danger"
					role="alert"
					aria-live="assertive"
					title={t('friends.socialHubInboxErrorTitle')}
					description={t('friends.socialHubInboxError')}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							className="shrink-0"
							onClick={() => void inboxQuery.refetch()}
						>
							<ArrowPathIcon className="h-4 w-4" aria-hidden />
							{t('friends.networkRetry')}
						</DesktopAppButton>
					}
				/>
			) : items.length === 0 ? (
				<DesktopAppEmptyState
					className={cn(shellPanel, 'py-12')}
					icon={
						<CheckCircleIcon className="h-7 w-7 text-emerald-300" aria-hidden />
					}
					title={t('friends.socialHubInboxEmptyTitle')}
					description={t('friends.socialHubInboxEmptyDescription')}
				>
					<div className="flex flex-wrap justify-center gap-2">
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => onSelectTarget('overview')}
						>
							{t('friends.socialHubInboxEmptyOverviewAction')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="accent"
							onClick={() => onSelectTarget('friends')}
						>
							{t('friends.socialHubInboxEmptyFriendsAction')}
						</DesktopAppButton>
					</div>
				</DesktopAppEmptyState>
			) : (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{items.map((item) => {
						const Icon = getActionIcon(item);
						const targetTab = isTargetTab(item.target_tab)
							? item.target_tab
							: null;
						const relativeCreatedAt = formatRelative(item.created_at);
						const titleKey = actionTitleKey(item.type);
						const summaryKey = actionSummaryKey(item.type);
						const title = titleKey ? t(titleKey) : item.title;
						const summary = summaryKey ? t(summaryKey) : item.summary;
						return (
							<DesktopAppPanel
								key={item.id}
								className={cn(
									'group relative flex min-h-40 flex-col gap-4 overflow-hidden p-4 transition-transform motion-safe:hover:-translate-y-0.5',
									shInboxSeverityPanelClass(item.severity)
								)}
							>
								<span
									aria-hidden
									className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_68%)] opacity-60"
								/>
								<div className="relative flex items-start justify-between gap-3">
									<div className="flex min-w-0 items-center gap-2">
										<span className={SH_INBOX_CARD_ICON_WRAP_CLASS}>
											<Icon className="h-5 w-5" aria-hidden />
										</span>
										<div className="min-w-0">
											<div className={SH_INBOX_CARD_TITLE_CLASS}>{title}</div>
											<div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs opacity-75">
												<span className={SH_INBOX_META_CHIP_CLASS}>
													{t(severityLabelKey(item.severity))}
												</span>
												<span>
													{t('friends.socialHubInboxCardCount', {
														count: item.count,
													})}
												</span>
												{targetTab ? (
													<span className={SH_INBOX_META_CHIP_CLASS}>
														{t(targetTabLabelKey(targetTab))}
													</span>
												) : null}
												{relativeCreatedAt ? (
													<span className={SH_INBOX_CARD_META_TIMESTAMP_CLASS}>
														{relativeCreatedAt}
													</span>
												) : null}
											</div>
										</div>
									</div>
								</div>
								<p className="relative line-clamp-3 text-xs leading-relaxed opacity-80">
									{summary}
								</p>
								<div className="relative mt-auto flex justify-end">
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										disabled={!targetTab}
										onClick={() => {
											if (targetTab) {
												onSelectTarget(targetTab, item.target_id);
											}
										}}
									>
										{t('friends.socialHubInboxOpenAction')}
									</DesktopAppButton>
								</div>
							</DesktopAppPanel>
						);
					})}
				</div>
			)}
		</div>
	);
}
