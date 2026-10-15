/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Social Hub request queue for incoming and sent friend requests.
 *
 * Invariants:
 * - Request lifecycle actions stay delegated to `FriendActionMenu`.
 * - Accepted/rejected flashes remain transient visual feedback only.
 *
 * Related:
 * - FriendsDirectory.tsx
 * - FriendActionMenu.tsx
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopAppEmptyState } from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

import {
	SH_DIRECTORY_DESC_CLASS,
	SH_DIRECTORY_LIST_TITLE_CLASS,
	SH_DIRECTORY_LOADING_WRAP_CLASS,
	SH_DIRECTORY_METRIC_ROW_CLASS,
	SH_REQUEST_AGE_BADGE_CLASS,
	SH_REQUEST_ROW_HOVER_ACCENT_CLASS,
	shDirectoryCountBadgeClass,
	shDirectoryMetricChipClass,
	shDirectoryPanelGlowClass,
	shRequestListRowClass,
} from '../social-hub/layout/socialHubLayoutTokens';
import {
	FriendActionMenu,
	type FriendActionDescriptor,
} from './FriendActionMenu';
import { FriendAvatar, getFriendDisplayName } from './FriendAvatar';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';

type RequestRow = {
	id: string;
	username: string | null;
	avatar_url: string | null;
	full_name: string | null;
	created_at?: string | null;
};

export type FriendRequestOutcomeFlash = {
	id: string;
	kind: 'accepted' | 'rejected';
} | null;

interface FriendRequestListProps<TItem extends RequestRow> {
	title: string;
	items: TItem[];
	loading?: boolean;
	actionsForItem: (item: TItem) => FriendActionDescriptor[];
	ariaLabel?: string;
	description?: string;
	emptyMessage?: string;
	count?: number;
	headerAction?: ReactNode;
	/** Brief highlight after accept/decline while the row may still be visible. */
	outcomeFlash?: FriendRequestOutcomeFlash;
	variant?: 'incoming' | 'sent';
}

function timestampOf(value?: string | null): number {
	if (!value) return 0;
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : 0;
}

export function FriendRequestList<TItem extends RequestRow>({
	title,
	items,
	loading = false,
	actionsForItem,
	ariaLabel,
	description,
	emptyMessage,
	count,
	headerAction,
	outcomeFlash,
	variant = 'incoming',
}: FriendRequestListProps<TItem>): JSX.Element | null {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const rowIdle = useMemo(
		() => getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		[shellFrame]
	);
	const emptyIcon =
		variant === 'incoming' ? (
			<ArrowDownTrayIcon
				className="h-6 w-6 text-(--desktop-text-dim)"
				aria-hidden
			/>
		) : (
			<ArrowUpTrayIcon
				className="h-6 w-6 text-(--desktop-text-dim)"
				aria-hidden
			/>
		);
	const requestCount = count ?? items.length;
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
		<div className={cn('relative min-h-0 overflow-hidden', shellPanel, 'p-5')}>
			<span
				aria-hidden
				className={shDirectoryPanelGlowClass(
					variant === 'sent' ? 'sent' : 'incoming'
				)}
			/>
			<div className="relative mb-4 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<h3 className={SH_DIRECTORY_LIST_TITLE_CLASS}>{title}</h3>
						<span
							className={shDirectoryCountBadgeClass(
								rowIdle,
								variant === 'sent' ? 'sent' : 'incoming'
							)}
						>
							{requestCount}
						</span>
					</div>
					{description ? (
						<p className={SH_DIRECTORY_DESC_CLASS}>{description}</p>
					) : null}
					<div className={SH_DIRECTORY_METRIC_ROW_CLASS}>
						<span className={shDirectoryMetricChipClass('neutral')}>
							{t('friends.requestQueueMetricCount', { count: requestCount })}
						</span>
						<span
							className={shDirectoryMetricChipClass(
								variant === 'incoming' ? 'incoming' : 'sent'
							)}
						>
							{variant === 'incoming'
								? t('friends.requestQueueMetricIncoming')
								: t('friends.requestQueueMetricSent')}
						</span>
					</div>
				</div>
				{headerAction}
			</div>
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
					className="py-8"
					icon={emptyIcon}
					title={
						emptyMessage ??
						(variant === 'sent'
							? t('friends.sentEmpty')
							: t('friends.incomingEmpty'))
					}
				/>
			) : (
				<ul className="relative space-y-3" aria-label={ariaLabel ?? title}>
					{items.map((item) => {
						const isFlashed = outcomeFlash?.id === item.id;
						const flashKind = isFlashed ? outcomeFlash?.kind : null;
						const relativeCreatedAt = formatRelative(item.created_at);
						const displayName = getFriendDisplayName(
							item.username,
							item.full_name,
							t('friends.anonymousUser')
						);

						return (
							<li
								key={item.id}
								className={shRequestListRowClass(flashKind, rowIdle)}
								aria-busy={isFlashed ? true : undefined}
							>
								<span
									aria-hidden
									className={SH_REQUEST_ROW_HOVER_ACCENT_CLASS}
								/>
								<div className="flex min-w-0 flex-1 items-center gap-3">
									<FriendAvatar
										avatarUrl={item.avatar_url}
										username={item.username}
										fullName={item.full_name}
										alt={title}
									/>
									<div className="min-w-0">
										<span className="truncate font-medium text-(--desktop-text-primary)">
											{displayName}
										</span>
										{flashKind ? (
											<span
												className={`mt-0.5 block text-xs font-medium ${
													flashKind === 'accepted'
														? 'text-emerald-200'
														: 'text-rose-200'
												}`}
												aria-live="polite"
											>
												{flashKind === 'accepted'
													? t('friends.requestRowAccepted')
													: t('friends.requestRowRejected')}
											</span>
										) : null}
										{relativeCreatedAt ? (
											<span className={SH_REQUEST_AGE_BADGE_CLASS}>
												{variant === 'incoming'
													? t('friends.requestRowAgeIncoming', {
															time: relativeCreatedAt,
														})
													: t('friends.requestRowAgeSent', {
															time: relativeCreatedAt,
														})}
											</span>
										) : null}
									</div>
								</div>
								<FriendActionMenu actions={actionsForItem(item)} />
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
