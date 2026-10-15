/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Grouped notification feed renderer for full-window Notification Hub (virtual + accordion modes).
 *
 * Invariants:
 * - Virtual feed (>40) uses flat virtual list; non-virtual uses type or source grouping.
 *
 * Related:
 * - NotificationHubBody.tsx, NotificationHubVirtualLists.tsx
 */

import type { Notification, NotificationType } from '@/notifications';
import { m, AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '../../constants';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { NotificationHubItem } from './NotificationHubItem';
import { NotificationVirtualWindowList } from './NotificationHubVirtualLists';
import {
	NH_EMPTY_WINDOW_WRAP_CLASS,
	NH_FEED_GROUPS_STACK_CLASS,
	NH_FILTER_RESET_BUTTON_CLASS,
	NH_GROUP_HEADER_ROW_CLASS,
	NH_PINNED_SECTION_STACK_CLASS,
	NH_RESET_FILTERS_WRAP_CLASS,
	NH_SOURCE_GROUP_BODY_CLASS,
	NH_SOURCE_GROUP_CHEVRON_CLASS,
	NH_SOURCE_GROUP_DETAILS_CLASS,
	NH_SOURCE_GROUP_SUMMARY_CLASS,
	NH_VIRTUAL_FEED_HINT_CLASS,
	nhMarkGroupReadButtonClass,
} from './notificationHubLayoutTokens';
import { BellIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export type NotificationHubGroupedFeedProps = {
	useWindowVirtual: boolean;
	windowFeedSorted: Notification[];
	afterSourceFilter: Notification[];
	effectiveGroupMode: 'type' | 'source';
	pinnedItems: Notification[];
	groupedByTypeRest: Record<NotificationType, Notification[]>;
	groupedBySourceRest: {
		map: Map<string | null, Notification[]>;
		keys: (string | null)[];
	};
	filter: 'all' | 'unread';
	searchQuery: string;
	sourceFilter: 'all' | string;
	filtersActive: boolean;
	onMarkAsRead: (id: string) => void;
	onDismiss: (id: string) => void;
	onMarkGroupAsRead?: (type: NotificationType) => void;
	onMarkGroupAsReadBySource?: (source: string | null) => void;
	onResetFilters: () => void;
	getSourceLabel: (source: string | null) => string;
	timeRefreshKey: number;
};

export const NotificationHubGroupedFeed: React.FC<NotificationHubGroupedFeedProps> =
	memo(
		({
			useWindowVirtual,
			windowFeedSorted,
			afterSourceFilter,
			effectiveGroupMode,
			pinnedItems,
			groupedByTypeRest,
			groupedBySourceRest,
			filter,
			searchQuery,
			sourceFilter,
			filtersActive,
			onMarkAsRead,
			onDismiss,
			onMarkGroupAsRead,
			onMarkGroupAsReadBySource,
			onResetFilters,
			getSourceLabel,
			timeRefreshKey,
		}) => {
			const { t } = useTranslation('desktopUi', {
				keyPrefix: 'notificationHub',
			});

			if (useWindowVirtual) {
				return (
					<>
						<p className={NH_VIRTUAL_FEED_HINT_CLASS}>{t('virtualFeedHint')}</p>
						<NotificationVirtualWindowList
							items={windowFeedSorted}
							onMarkAsRead={onMarkAsRead}
							onDismiss={onDismiss}
							timeRefreshKey={timeRefreshKey}
						/>
					</>
				);
			}

			if (afterSourceFilter.length === 0) {
				return (
					<m.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className={NH_EMPTY_WINDOW_WRAP_CLASS}
					>
						<DesktopAppEmptyState
							icon={
								<BellIcon
									className="h-8 w-8 text-(--desktop-text-muted)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							}
							title={t('emptyTitle')}
							description={
								filter === 'unread'
									? t('emptyAllRead')
									: searchQuery.trim()
										? t('emptySearch')
										: sourceFilter !== 'all'
											? t('emptySourceFilter')
											: t('emptyDefault')
							}
						/>
						{filtersActive ? (
							<div className={NH_RESET_FILTERS_WRAP_CLASS}>
								<DesktopChromeTooltip
									content={t('resetFilters')}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										className={NH_FILTER_RESET_BUTTON_CLASS}
										aria-label={t('resetFiltersAria')}
										onClick={onResetFilters}
									>
										{t('resetFilters')}
									</DesktopAppButton>
								</DesktopChromeTooltip>
							</div>
						) : null}
					</m.div>
				);
			}

			return (
				<AnimatePresence mode="popLayout">
					<div className={NH_FEED_GROUPS_STACK_CLASS}>
						{pinnedItems.length > 0 ? (
							<div className={NH_PINNED_SECTION_STACK_CLASS}>
								<DesktopAppSectionLabel>
									{t('pinnedSection')}
								</DesktopAppSectionLabel>
								<div className={NH_PINNED_SECTION_STACK_CLASS}>
									{pinnedItems.map((notification) => (
										<NotificationHubItem
											key={notification.id}
											notification={notification}
											onMarkAsRead={onMarkAsRead}
											onDismiss={onDismiss}
											timeRefreshKey={timeRefreshKey}
										/>
									))}
								</div>
							</div>
						) : null}
						{effectiveGroupMode === 'type'
							? (['error', 'warning', 'success', 'info'] as const).map(
									(type) => {
										const list = groupedByTypeRest[type];
										if (list.length === 0) return null;
										const unreadInGroup = list.filter((n) => !n.read).length;
										return (
											<div key={type} className={NH_PINNED_SECTION_STACK_CLASS}>
												<div className={NH_GROUP_HEADER_ROW_CLASS}>
													<DesktopAppSectionLabel>
														{t(`groups.${type}`)} ({list.length})
													</DesktopAppSectionLabel>
													{unreadInGroup > 0 && onMarkGroupAsRead ? (
														<DesktopChromeTooltip
															content={t('markGroupRead')}
															placement="top"
															offsetExtra={4}
														>
															<DesktopAppButton
																variant="ghost"
																size="sm"
																onClick={() => onMarkGroupAsRead(type)}
																className={nhMarkGroupReadButtonClass()}
															>
																{t('markGroupRead')}
															</DesktopAppButton>
														</DesktopChromeTooltip>
													) : null}
												</div>
												<div className={NH_PINNED_SECTION_STACK_CLASS}>
													{list.map((notification) => (
														<NotificationHubItem
															key={notification.id}
															notification={notification}
															onMarkAsRead={onMarkAsRead}
															onDismiss={onDismiss}
															timeRefreshKey={timeRefreshKey}
														/>
													))}
												</div>
											</div>
										);
									}
								)
							: groupedBySourceRest.keys.map((sourceKey) => {
									const list = groupedBySourceRest.map.get(sourceKey);
									if (!list) return null;
									const label = getSourceLabel(sourceKey);
									const unreadInGroup = list.filter((n) => !n.read).length;
									const reactKey = sourceKey === null ? '__none__' : sourceKey;
									const groupHeaderLabel = `${label} (${list.length})`;
									return (
										<details
											key={reactKey}
											className={NH_SOURCE_GROUP_DETAILS_CLASS}
										>
											<summary className={NH_SOURCE_GROUP_SUMMARY_CLASS}>
												<div className={NH_GROUP_HEADER_ROW_CLASS}>
													<div className="flex min-w-0 items-center gap-2">
														<ChevronRightIcon
															className={NH_SOURCE_GROUP_CHEVRON_CLASS}
															strokeWidth={DESKTOP_LUCIDE.stroke}
															aria-hidden
														/>
														<DesktopChromeTooltip
															content={groupHeaderLabel}
															placement="top"
															offsetExtra={4}
														>
															<DesktopAppSectionLabel className="min-w-0 truncate">
																{groupHeaderLabel}
															</DesktopAppSectionLabel>
														</DesktopChromeTooltip>
													</div>
													{unreadInGroup > 0 && onMarkGroupAsReadBySource ? (
														<DesktopChromeTooltip
															content={t('markGroupRead')}
															placement="top"
															offsetExtra={4}
														>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="sm"
																onClick={(e) => {
																	e.preventDefault();
																	onMarkGroupAsReadBySource(sourceKey);
																}}
																className={nhMarkGroupReadButtonClass(true)}
															>
																{t('markGroupRead')}
															</DesktopAppButton>
														</DesktopChromeTooltip>
													) : null}
												</div>
											</summary>
											<div className={NH_SOURCE_GROUP_BODY_CLASS}>
												{list.map((notification) => (
													<NotificationHubItem
														key={notification.id}
														notification={notification}
														onMarkAsRead={onMarkAsRead}
														onDismiss={onDismiss}
														timeRefreshKey={timeRefreshKey}
													/>
												))}
											</div>
										</details>
									);
								})}
					</div>
				</AnimatePresence>
			);
		}
	);

NotificationHubGroupedFeed.displayName = 'NotificationHubGroupedFeed';
