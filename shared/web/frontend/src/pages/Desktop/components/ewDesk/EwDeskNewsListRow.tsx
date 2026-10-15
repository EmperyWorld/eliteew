/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single row in the EWDesk news list (master pane).
 *
 * Invariants:
 * - Memoized; stable ref callbacks from parent for list performance.
 *
 * Related:
 * - EWDeskApp.tsx, EwDeskNewsMedia.tsx · DesktopChromeTooltip.tsx
 */

import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import type { CompanyNewsPostListItem } from '../../services/productDesktopApi';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	EwDeskNewsAudioBadge,
	EwDeskNewsImage,
	EwDeskNewsVideo,
} from './EwDeskNewsMedia';
import {
	formatEwDeskNewsDate,
	formatEwDeskRelativeNewsDate,
} from './ewDeskFormatting';
import { highlightEwDeskSearchText } from './ewDeskSearchHighlight';
import { formatEwDeskListExcerpt } from './ewDeskListExcerpt';
import {
	ChevronRightIcon,
	MapPinIcon,
	StarIcon,
} from '@heroicons/react/24/outline';

export type EwDeskNewsListRowProps = {
	post: CompanyNewsPostListItem;
	index: number;
	isSelected: boolean;
	tabIndex: number;
	detailPanelId: string;
	listboxOptionId: string;
	buttonRef: React.RefCallback<HTMLButtonElement>;
	onSelect: (id: string) => void;
	onOptionKeyDown: (
		e: React.KeyboardEvent<HTMLButtonElement>,
		index: number
	) => void;
	isUnread: boolean;
	isStarred: boolean;
	onPrefetchPost: (id: string) => void;
	onRowContextMenu?: (e: React.MouseEvent, postId: string) => void;
	searchHighlightQuery?: string;
};

export const EwDeskNewsListRow = React.memo(function EwDeskNewsListRow({
	post: p,
	index,
	isSelected,
	tabIndex,
	detailPanelId,
	listboxOptionId,
	buttonRef,
	onSelect,
	onOptionKeyDown,
	isUnread,
	isStarred,
	onPrefetchPost,
	onRowContextMenu,
	searchHighlightQuery = '',
}: EwDeskNewsListRowProps): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi', { keyPrefix: 'ewDesk' });
	const absolute = formatEwDeskNewsDate(p.published_at);
	const relative = formatEwDeskRelativeNewsDate(p.published_at, i18n.language);
	const excerpt = formatEwDeskListExcerpt(p.body_excerpt);

	const onPointerEnterRow = React.useCallback(() => {
		onPrefetchPost(p.id);
	}, [p.id, onPrefetchPost]);

	return (
		<div className="[contain-intrinsic-size:auto_4.75rem] [content-visibility:auto]">
			<DesktopAppButton
				ref={buttonRef}
				id={listboxOptionId}
				type="button"
				role="option"
				aria-selected={isSelected}
				aria-controls={detailPanelId}
				tabIndex={tabIndex}
				variant="ghost"
				size="sm"
				className={cn(
					'group relative touch-manipulation h-auto w-full justify-start rounded-(--desktop-radius-lg) border border-transparent px-2.5 py-2.5 text-left',
					'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.38)]',
					'transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none',
					p.pinned &&
						'border-l-[3px] border-l-[color-mix(in_srgb,rgb(251_191_36)_72%,transparent)] pl-2',
					isSelected
						? 'border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.16)_100%,transparent)] shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.08),0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.1),0_4px_18px_-8px_rgb(var(--desktop-accent-rgb)/0.28)]'
						: cn(
								'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.03)]',
								'hover:border-(--desktop-border-subtle) hover:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_76%,transparent)] active:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_90%,transparent)]',
								p.pinned &&
									'bg-[color-mix(in_srgb,rgb(251_191_36)_10%,transparent)] hover:bg-[color-mix(in_srgb,rgb(251_191_36)_14%,var(--desktop-surface-soft)_70%)]'
							)
				)}
				onClick={() => {
					onSelect(p.id);
				}}
				onKeyDown={(e) => {
					onOptionKeyDown(e, index);
				}}
				onPointerEnter={onPointerEnterRow}
				onFocus={onPointerEnterRow}
				onContextMenu={
					onRowContextMenu
						? (e) => {
								onRowContextMenu(e, p.id);
							}
						: undefined
				}
				aria-label={
					isUnread
						? t('listRowUnreadAria', { title: p.title })
						: t('listRowAria', { title: p.title })
				}
			>
				<span className="flex min-w-0 flex-1 items-start gap-2">
					{isUnread ? (
						<span
							className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.95)] shadow-[0_0_8px_rgb(var(--desktop-accent-rgb)/0.45)]"
							aria-hidden
						/>
					) : (
						<span className="mt-2 h-1.5 w-1.5 shrink-0" aria-hidden />
					)}
					{p.video_content_id ? (
						<span
							className="relative mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-black shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]"
							aria-hidden
						>
							<EwDeskNewsVideo
								contentId={p.video_content_id}
								variant="thumb"
								className="h-full w-full object-cover"
							/>
							{p.audio_content_id ? (
								<DesktopChromeTooltip
									content={t('hasAudioBadgeAria')}
									placement="top"
									offsetExtra={4}
								>
									<span
										role="img"
										className="absolute right-0 bottom-0 rounded-tl-(--desktop-radius) bg-black/70 p-0.5 text-white/95"
										aria-label={t('hasAudioBadgeAria')}
									>
										<EwDeskNewsAudioBadge />
									</span>
								</DesktopChromeTooltip>
							) : null}
						</span>
					) : p.image_content_id || p.image_url ? (
						<span
							className="relative mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_70%,transparent)] shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]"
							aria-hidden
						>
							<EwDeskNewsImage
								contentId={p.image_content_id}
								src={p.image_url}
								alt=""
								className="h-full w-full object-cover"
							/>
							{p.audio_content_id ? (
								<DesktopChromeTooltip
									content={t('hasAudioBadgeAria')}
									placement="top"
									offsetExtra={4}
								>
									<span
										role="img"
										className="absolute right-0 bottom-0 rounded-tl-(--desktop-radius) bg-black/55 p-0.5 text-white/95"
										aria-label={t('hasAudioBadgeAria')}
									>
										<EwDeskNewsAudioBadge />
									</span>
								</DesktopChromeTooltip>
							) : null}
						</span>
					) : p.audio_content_id ? (
						<DesktopChromeTooltip
							content={t('listAudioOnlyAria')}
							placement="top"
							offsetExtra={4}
						>
							<span
								role="img"
								className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_70%,transparent)] text-(--desktop-text-muted) shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]"
								aria-label={t('listAudioOnlyAria')}
							>
								<EwDeskNewsAudioBadge />
							</span>
						</DesktopChromeTooltip>
					) : null}
					<span className="flex min-w-0 flex-1 flex-col gap-1">
						<span className="flex min-w-0 items-start gap-1.5">
							{p.pinned ? (
								<DesktopChromeTooltip
									content={t('pinnedAria')}
									placement="top"
									offsetExtra={4}
								>
									<span
										className="inline-flex shrink-0"
										role="img"
										aria-label={t('pinnedAria')}
									>
										<MapPinIcon
											className="mt-0.5 h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_10px_rgb(251_191_36/0.45)]"
											aria-hidden
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									</span>
								</DesktopChromeTooltip>
							) : null}
							{isStarred ? (
								<DesktopChromeTooltip
									content={t('starredRowAria')}
									placement="top"
									offsetExtra={4}
								>
									<span
										className="inline-flex shrink-0"
										role="img"
										aria-label={t('starredRowAria')}
									>
										<StarIcon
											className="mt-0.5 h-3.5 w-3.5 fill-amber-400/90 text-amber-400/90"
											aria-hidden
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									</span>
								</DesktopChromeTooltip>
							) : null}
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.widgetTrackTitle,
									'line-clamp-2 text-left text-sm leading-snug tracking-[-0.01em] md:text-[0.84375rem]'
								)}
							>
								{highlightEwDeskSearchText(p.title, searchHighlightQuery)}
							</span>
						</span>
						{excerpt ? (
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.captionInherit,
									'line-clamp-2 text-left text-[0.6875rem] leading-snug text-(--desktop-text-muted)',
									p.pinned && 'pl-5'
								)}
							>
								{highlightEwDeskSearchText(excerpt, searchHighlightQuery)}
							</span>
						) : null}
						<DesktopChromeTooltip
							content={absolute || undefined}
							placement="top"
							offsetExtra={4}
							disabled={!absolute}
						>
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.captionInherit,
									'block font-medium uppercase leading-none tracking-[0.06em] tabular-nums text-(--desktop-text-dim)',
									p.pinned && 'pl-5'
								)}
							>
								<time
									className="block normal-case tracking-normal"
									dateTime={p.published_at ?? undefined}
								>
									{relative || absolute}
								</time>
							</span>
						</DesktopChromeTooltip>
					</span>
					<ChevronRightIcon
						className={cn(
							'mt-0.5 h-4 w-4 shrink-0 transition-[opacity,color,transform] duration-200 motion-reduce:transition-none motion-safe:group-hover:translate-x-px motion-safe:group-focus-visible:translate-x-px',
							isSelected
								? 'text-[rgb(var(--desktop-accent-rgb)/0.75)] opacity-90'
								: 'text-(--desktop-text-dim) opacity-[0.28] group-hover:opacity-55'
						)}
						aria-hidden
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</span>
			</DesktopAppButton>
		</div>
	);
});

EwDeskNewsListRow.displayName = 'EwDeskNewsListRow';
