/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact EWDesk preview for the desktop widgets panel (counts + latest headlines).
 *
 * Invariants:
 * - Widget list uses dedicated React Query key (not infinite feed cache).
 * - Uses GET /news/counts + /news/my-state for unread and «new since visit» hints.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx, useEwDeskNewsCounts.ts, ewDeskVisitHint.ts, DesktopChromeTooltip.tsx
 */

import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	EWDESK_WIDGET_PREVIEW_LIMIT_COMPACT,
	EWDESK_WIDGET_PREVIEW_LIMIT_FULL,
} from '../../services/productDesktopApi';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { formatEwDeskRelativeNewsDate } from './ewDeskFormatting';
import {
	ewDeskNewsUserStateQueryOptions,
	ewDeskNewsWidgetPreviewQueryOptions,
} from './ewDeskNewsQueryOptions';
import { useEwDeskNewsCounts } from './useEwDeskNewsCounts';
import {
	ewDeskHasNewsSinceLastVisit,
	ewDeskIsPostNewSinceVisit,
} from './ewDeskVisitHint';

export function EwDeskWidgetPreview({
	compact,
	onOpenEwDesk,
	onOpenPost,
}: {
	compact: boolean;
	onOpenEwDesk: () => void;
	onOpenPost?: (postId: string) => void;
}): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi', { keyPrefix: 'ewDesk' });
	const previewLimit = compact
		? EWDESK_WIDGET_PREVIEW_LIMIT_COMPACT
		: EWDESK_WIDGET_PREVIEW_LIMIT_FULL;
	const { unreadCount, latestPublishedAt } = useEwDeskNewsCounts(true);
	const userStateQuery = useQuery(ewDeskNewsUserStateQueryOptions());
	const listQuery = useQuery(ewDeskNewsWidgetPreviewQueryOptions(previewLimit));
	const posts = listQuery.data ?? [];
	const lastSeenPublishedAt = userStateQuery.data?.last_seen_published_at;
	const latestWhen = formatEwDeskRelativeNewsDate(
		latestPublishedAt,
		i18n.language
	);
	const newSinceVisit = ewDeskHasNewsSinceLastVisit({
		latestPublishedAt,
		lastSeenPublishedAt,
	});

	if (listQuery.isLoading) {
		return (
			<div
				className="flex flex-col gap-2"
				role="status"
				aria-busy="true"
				aria-label={t('widgetLoadingAria')}
			>
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'h-4 w-3/4 animate-pulse rounded bg-(--desktop-surface-soft)'
					)}
				/>
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'h-4 w-full animate-pulse rounded bg-(--desktop-surface-soft)'
					)}
				/>
			</div>
		);
	}

	if (posts.length === 0) {
		return <p className={DESKTOP_TYPOGRAPHY.caption}>{t('widgetEmpty')}</p>;
	}

	return (
		<div className="flex flex-col gap-2">
			{unreadCount > 0 ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'font-medium text-(--desktop-accent-primary, var(--color-primary))'
					)}
				>
					{t('widgetUnread', { count: unreadCount })}
				</p>
			) : newSinceVisit && latestWhen ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'font-medium text-(--desktop-accent-primary, var(--color-primary))'
					)}
				>
					{t('widgetNewSinceVisit', { when: latestWhen })}
				</p>
			) : null}
			{!newSinceVisit && latestWhen ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-muted)'
					)}
				>
					{t('widgetLatest', { when: latestWhen })}
				</p>
			) : null}
			<ul className="flex flex-col gap-1.5">
				{posts.map((p) => {
					const isNewSinceVisit = ewDeskIsPostNewSinceVisit({
						postPublishedAt: p.published_at,
						lastSeenPublishedAt,
					});
					return (
						<li key={p.id}>
							<DesktopChromeTooltip
								content={p.title}
								placement="top"
								offsetExtra={4}
								disabled={!p.title.trim()}
							>
								<button
									type="button"
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'w-full rounded-md border border-transparent px-1 py-0.5 text-left text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft)',
										isNewSinceVisit &&
											'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.1)_100%,transparent)]'
									)}
									aria-label={
										isNewSinceVisit
											? t('widgetRowNewAria', { title: p.title })
											: t('widgetRowAria', { title: p.title })
									}
									onClick={() => {
										if (onOpenPost) onOpenPost(p.id);
										else onOpenEwDesk();
									}}
								>
									<span
										className={cn(
											'line-clamp-2 font-medium',
											isNewSinceVisit &&
												'text-(--desktop-accent-primary, var(--color-primary))'
										)}
									>
										{p.title}
									</span>
									{p.published_at ? (
										<span className="mt-0.5 block text-[0.65rem] text-(--desktop-text-muted)">
											{formatEwDeskRelativeNewsDate(
												p.published_at,
												i18n.language
											)}
										</span>
									) : null}
								</button>
							</DesktopChromeTooltip>
						</li>
					);
				})}
			</ul>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				onClick={onOpenEwDesk}
			>
				{t('widgetOpenAll')}
			</DesktopAppButton>
		</div>
	);
}
