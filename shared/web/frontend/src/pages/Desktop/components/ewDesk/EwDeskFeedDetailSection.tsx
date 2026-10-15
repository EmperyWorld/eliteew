/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed detail / reading pane — empty state, loading, Markdown body, media.
 *
 * Invariants:
 * - Full Markdown fetched per selected id only.
 * - Desktop chrome header is toolbar-only; this pane is content only.
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 * - `documentation/product/desktop/EWDESK-NEWS.md`
 */
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import * as React from 'react';
import remarkBreaks from 'remark-breaks';
import type { DesktopWindowStyle } from '../../../../types/profile';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterClassName,
} from '../../utils/desktopVisualSystem';
import type { CompanyNewsPost } from '../../services/productDesktopApi';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSkeleton,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { ProductAssistantMarkdown } from '../ProductAssistantMarkdown';
import {
	CalendarIcon,
	ClipboardDocumentIcon,
	ExclamationCircleIcon,
	LinkIcon,
	MapPinIcon,
	NewspaperIcon,
	StarIcon,
} from '@heroicons/react/24/outline';
import {
	EW_DESK_DETAIL_PANEL_ID,
	type EwDeskReadingWidth,
} from './ewDeskConstants';
import { formatEwDeskNewsDate } from './ewDeskFormatting';
import {
	EwDeskNewsAudio,
	EwDeskNewsImage,
	EwDeskNewsVideo,
} from './EwDeskNewsMedia';

export interface EwDeskFeedDetailSectionProps {
	t: TFunction<'desktopUi', 'ewDesk'>;
	detailScrollRef: React.RefObject<HTMLElement | null>;
	selectedId: string | null;
	splitPaneLayout: boolean;
	selectedListTitle: string;
	detailQuery: {
		isLoading: boolean;
		isError: boolean;
		refetch: () => Promise<unknown>;
	};
	shellFrame: DesktopWindowStyle;
	selected: CompanyNewsPost | null | undefined;
	selectedPublishedRelative: string;
	readingWidth: EwDeskReadingWidth;
	setReadingWidthPersist: (w: EwDeskReadingWidth) => void;
	selectedIsStarred: boolean;
	handleToggleStar: () => void;
	copyPostLink: (postId: string) => Promise<void>;
	copyPostId: (postId: string) => Promise<void>;
}

export function EwDeskFeedDetailSection({
	t,
	detailScrollRef,
	selectedId,
	splitPaneLayout,
	selectedListTitle,
	detailQuery,
	shellFrame,
	selected,
	selectedPublishedRelative,
	readingWidth,
	setReadingWidthPersist,
	selectedIsStarred,
	handleToggleStar,
	copyPostLink,
	copyPostId,
}: EwDeskFeedDetailSectionProps): React.ReactElement {
	const detailCanvasClass = React.useMemo(
		() =>
			DESKTOP_WINDOW_FRAME_STYLES[shellFrame]?.content ??
			DESKTOP_WINDOW_FRAME_STYLES.glass.content,
		[shellFrame]
	);
	const articleMaxWidthClass = React.useMemo(() => {
		switch (readingWidth) {
			case 'narrow':
				return 'max-w-[min(100%,28rem)]';
			case 'wide':
				return 'max-w-[min(100%,52rem)]';
			default:
				return 'max-w-[min(100%,40rem)]';
		}
	}, [readingWidth]);
	const heroImageClass = React.useMemo(
		() =>
			readingWidth === 'narrow'
				? 'max-h-[min(22rem,52vh)] w-full object-cover object-center'
				: 'max-h-[min(28rem,62vh)] w-full object-contain object-center',
		[readingWidth]
	);
	const readingWidthClusterClass = React.useMemo(
		() =>
			cn(
				'flex items-center gap-0.5',
				getDesktopShellToolbarClusterClassName(shellFrame),
				'rounded-(--desktop-radius-lg) p-0.5'
			),
		[shellFrame]
	);

	return (
		<section
			ref={detailScrollRef}
			id={EW_DESK_DETAIL_PANEL_ID}
			data-ed-guide="feed-detail"
			aria-label={t('detailRegionLabel')}
			aria-live="polite"
			className={cn(
				'scroll-smooth flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain scrollbar-gutter-stable p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:p-6 md:pb-6',
				detailCanvasClass
			)}
		>
			{!selectedId && splitPaneLayout && (
				<div className="flex min-h-0 flex-1 flex-col justify-center py-6 md:py-10">
					<div className="mx-auto w-full max-w-md motion-safe:animate-fade-in motion-reduce:animate-none">
						<DesktopAppEmptyState
							className="min-h-[min(18rem,42vh)] px-6"
							icon={
								<NewspaperIcon
									className="h-9 w-9 text-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.88)_38%,var(--desktop-text-dim))]"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							}
							title={t('emptySelectTitle')}
							description={t('emptySelectDesc')}
						/>
					</div>
				</div>
			)}
			{selectedId && selectedListTitle ? (
				<div className="sr-only" aria-live="polite" aria-atomic="true">
					{t('selectedPostAnnounced', { title: selectedListTitle })}
				</div>
			) : null}
			{selectedId && detailQuery.isLoading && (
				<div
					key={selectedId}
					className={cn('mx-auto w-full px-1 py-2', articleMaxWidthClass)}
					role="status"
					aria-busy="true"
					aria-label={t('detailLoadingAria')}
				>
					<div
						className={cn(
							'motion-safe:animate-fade-in motion-reduce:animate-none',
							'overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle)',
							'ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.06)]',
							'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_35%,transparent)]',
							'shadow-[inset_3px_0_0_0_rgb(var(--desktop-accent-rgb)/0.22),0_12px_36px_-16px_rgb(0_0_0/0.28)]',
							getDesktopShellContentPanelClassName(shellFrame)
						)}
					>
						<div className="border-b border-(--desktop-border-subtle) bg-linear-to-b from-[rgb(var(--desktop-accent-rgb)/0.05)] to-transparent px-5 py-4 md:px-7 md:py-5">
							<DesktopAppSkeleton className="h-6 w-[88%] max-w-md rounded-md" />
							<DesktopAppSkeleton className="mt-4 h-0.5 w-10 rounded-full" />
							<DesktopAppSkeleton className="mt-4 h-5 w-40 rounded-full" />
						</div>
						<div className="space-y-2.5 px-5 py-6 md:px-7 md:py-8">
							<DesktopAppSkeleton className="h-3 w-full rounded-md" />
							<DesktopAppSkeleton className="h-3 w-[94%] rounded-md" />
							<DesktopAppSkeleton className="h-3 w-[88%] rounded-md" />
							<DesktopAppSkeleton className="h-3 w-[72%] rounded-md" />
						</div>
					</div>
				</div>
			)}
			{selectedId && detailQuery.isError && (
				<div className="motion-safe:animate-fade-in motion-reduce:animate-none">
					<DesktopAppEmptyState
						className="mx-auto min-h-56 w-full max-w-sm px-4"
						icon={
							<ExclamationCircleIcon
								className="h-8 w-8 text-[color-mix(in_srgb,rgb(251_113_133)_75%,var(--desktop-text-dim))]"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						title={t('detailLoadErrorTitle')}
						description={t('detailLoadErrorDesc')}
					>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							aria-label={t('detailRetryAria')}
							onClick={() => {
								void detailQuery.refetch();
							}}
						>
							{t('retry')}
						</DesktopAppButton>
					</DesktopAppEmptyState>
				</div>
			)}
			{selectedId && selected && (
				<div className={cn('mx-auto w-full', articleMaxWidthClass)}>
					<article
						key={selected.id}
						aria-labelledby="ewdesk-detail-title"
						className={cn(
							'motion-safe:animate-fade-in motion-reduce:animate-none',
							'overflow-hidden rounded-(--desktop-radius-xl)',
							'ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.07)]',
							'shadow-[inset_4px_0_0_0_rgb(var(--desktop-accent-rgb)/0.42),0_16px_48px_-20px_rgb(0_0_0/0.4),0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]',
							'motion-safe:transition-shadow motion-safe:duration-300 motion-reduce:transition-none',
							/* hover: shadow only — avoids layout layer promotion from translate */
							'motion-safe:hover:shadow-[inset_4px_0_0_0_rgb(var(--desktop-accent-rgb)/0.48),0_22px_56px_-22px_rgb(0_0_0/0.44),0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
							'focus-within:ring-2 focus-within:ring-[rgb(var(--desktop-accent-rgb)/0.24)] focus-within:ring-offset-2 focus-within:ring-offset-[color-mix(in_srgb,var(--desktop-surface-app)_55%,transparent)]',
							getDesktopShellContentPanelClassName(shellFrame)
						)}
					>
						<header
							className={cn(
								'relative border-b border-(--desktop-border-subtle) px-5 py-5 text-center md:px-7 md:py-6',
								'bg-linear-to-b from-[rgb(var(--desktop-accent-rgb)/0.09)] via-[color-mix(in_srgb,var(--desktop-surface-panel)_38%,transparent)] to-[color-mix(in_srgb,var(--desktop-surface-panel)_46%,transparent)]'
							)}
						>
							<div
								className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[rgb(var(--desktop-accent-rgb)/0.25)] to-transparent opacity-90"
								aria-hidden
							/>
							<h2
								id="ewdesk-detail-title"
								className={cn(
									DESKTOP_TYPOGRAPHY.title,
									'scroll-mt-4 text-pretty md:text-2xl md:leading-tight'
								)}
							>
								{selected.title}
							</h2>
							<div
								className="mx-auto mt-4 h-0.5 w-12 rounded-full bg-linear-to-r from-[rgb(var(--desktop-accent-rgb)/0.55)] to-[rgb(var(--desktop-accent-rgb)/0.15)] shadow-[0_1px_8px_rgb(var(--desktop-accent-rgb)/0.2)]"
								aria-hidden
							/>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'mt-4 flex flex-col items-center gap-3 text-(--desktop-text-muted)'
								)}
							>
								<div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
									<span className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_92%,transparent)] px-2.5 py-0.5 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)] tabular-nums transition-shadow duration-200 motion-reduce:transition-none">
										<CalendarIcon
											className="mt-0.5 h-3.5 w-3.5 shrink-0 self-start text-(--desktop-text-dim)"
											aria-hidden
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										<DesktopChromeTooltip
											content={
												formatEwDeskNewsDate(selected.published_at) || undefined
											}
											placement="top"
											offsetExtra={4}
											disabled={!formatEwDeskNewsDate(selected.published_at)}
										>
											<time
												className="flex min-w-0 flex-col items-center gap-0.5 leading-tight"
												dateTime={selected.published_at ?? undefined}
											>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.body,
														'font-medium tabular-nums text-(--desktop-text-secondary)'
													)}
												>
													{formatEwDeskNewsDate(selected.published_at)}
												</span>
												{selectedPublishedRelative ? (
													<span
														className={cn(
															DESKTOP_TYPOGRAPHY.small,
															'font-normal normal-case tracking-normal'
														)}
													>
														{selectedPublishedRelative}
													</span>
												) : null}
											</time>
										</DesktopChromeTooltip>
									</span>
									{selected.pinned ? (
										<span className="inline-flex cursor-default items-center gap-1 rounded-full border border-[color-mix(in_srgb,rgb(251_191_36)_35%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(251_191_36)_12%,var(--desktop-surface-soft)_75%)] px-2.5 py-0.5 text-[0.6875rem] font-medium text-[color-mix(in_srgb,rgb(180_130_20)_72%,var(--desktop-text-secondary))] shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)] transition-shadow duration-200 motion-reduce:transition-none">
											<MapPinIcon
												className="h-3 w-3 shrink-0 opacity-90 drop-shadow-[0_0_8px_rgb(251_191_36/0.4)]"
												aria-hidden
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
											{t('pinnedBadge')}
										</span>
									) : null}
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										className="h-7 min-w-0 px-2 text-[0.6875rem] text-(--desktop-text-muted)"
										aria-label={t('copyPostLinkAria')}
										onClick={() => {
											void copyPostLink(selected.id);
										}}
									>
										<LinkIcon
											className="h-3.5 w-3.5 shrink-0"
											aria-hidden
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('copyPostLink')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										className="h-7 min-w-0 px-2 text-[0.6875rem] text-(--desktop-text-muted)"
										aria-label={t('copyPostIdAria')}
										onClick={() => {
											void copyPostId(selected.id);
										}}
									>
										<ClipboardDocumentIcon
											className="h-3.5 w-3.5 shrink-0"
											aria-hidden
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('copyPostId')}
									</DesktopAppButton>
								</div>
								<div className="flex flex-wrap items-center justify-center gap-1.5 sm:shrink-0">
									<fieldset
										className={cn(
											readingWidthClusterClass,
											'm-0 min-w-0 border-0 p-0'
										)}
										aria-label={t('readingWidthGroupAria')}
									>
										<DesktopAppButton
											type="button"
											variant={readingWidth === 'narrow' ? 'neutral' : 'ghost'}
											size="sm"
											className="h-7 min-w-7 px-2 text-[0.6875rem] font-semibold tabular-nums"
											aria-pressed={readingWidth === 'narrow'}
											aria-label={t('readingWidthNarrowAria')}
											onClick={() => {
												setReadingWidthPersist('narrow');
											}}
										>
											S
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											variant={
												readingWidth === 'comfortable' ? 'neutral' : 'ghost'
											}
											size="sm"
											className="h-7 min-w-7 px-2 text-[0.6875rem] font-semibold tabular-nums"
											aria-pressed={readingWidth === 'comfortable'}
											aria-label={t('readingWidthComfortableAria')}
											onClick={() => {
												setReadingWidthPersist('comfortable');
											}}
										>
											M
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											variant={readingWidth === 'wide' ? 'neutral' : 'ghost'}
											size="sm"
											className="h-7 min-w-7 px-2 text-[0.6875rem] font-semibold tabular-nums"
											aria-pressed={readingWidth === 'wide'}
											aria-label={t('readingWidthWideAria')}
											onClick={() => {
												setReadingWidthPersist('wide');
											}}
										>
											L
										</DesktopAppButton>
									</fieldset>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="gap-1.5 text-[0.6875rem] text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)"
										aria-pressed={selectedIsStarred}
										aria-label={
											selectedIsStarred ? t('starRemoveAria') : t('starAddAria')
										}
										onClick={() => {
											handleToggleStar();
										}}
									>
										<StarIcon
											className={cn(
												'h-3.5 w-3.5 shrink-0 opacity-90',
												selectedIsStarred &&
													'fill-amber-400/90 text-amber-400 drop-shadow-[0_0_10px_rgb(251_191_36/0.35)]'
											)}
											aria-hidden
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{selectedIsStarred ? t('starred') : t('star')}
									</DesktopAppButton>
								</div>
							</div>
						</header>
						{selected.video_content_id ? (
							<section
								className="relative -mx-5 w-[calc(100%+2.5rem)] shrink-0 border-b border-(--desktop-border-subtle) bg-black md:-mx-7 md:w-[calc(100%+3.5rem)]"
								aria-label={t('videoHeroAria')}
							>
								<EwDeskNewsVideo
									contentId={selected.video_content_id}
									variant="hero"
								/>
							</section>
						) : null}
						{selected.audio_content_id ? (
							<section
								className="border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_25%,transparent)] px-5 py-4 text-center md:px-7"
								aria-label={t('audioPlayerAria')}
							>
								<div className="mx-auto max-w-md">
									<EwDeskNewsAudio contentId={selected.audio_content_id} />
								</div>
							</section>
						) : null}
						<div
							className={cn(
								DESKTOP_TYPOGRAPHY.body,
								'relative text-center',
								'bg-[linear-gradient(to_bottom,transparent_0%,color-mix(in_srgb,var(--desktop-surface-app)_20%,transparent)_100%),color-mix(in_srgb,var(--desktop-surface-app)_30%,transparent)]',
								'px-5 py-7 text-[0.9375rem] leading-[1.72] text-(--desktop-text-primary) antialiased md:px-7 md:py-9 md:text-[1.015rem] md:leading-[1.78]',
								'text-pretty wrap-anywhere selection:bg-[rgb(var(--desktop-accent-rgb)/0.24)]'
							)}
						>
							<div
								className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-[rgb(var(--desktop-accent-rgb)/0.2)] to-transparent md:inset-x-7"
								aria-hidden
							/>
							{selected.body.trim() ? (
								<div
									className={cn(
										'relative mx-auto mt-1 max-w-[min(100%,42rem)] rounded-2xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)]',
										'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_26%,transparent)]',
										'px-4 py-5 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.045)] sm:px-6 sm:py-6',
										'ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)]'
									)}
								>
									<ProductAssistantMarkdown
										content={selected.body}
										remarkPluginsExtra={[remarkBreaks]}
										className={cn(
											'!prose-lg min-w-0 text-center',
											'[&_p]:mx-auto [&_p]:max-w-[min(100%,38rem)] [&_p]:text-(--desktop-text-primary)',
											'[&_li]:text-(--desktop-text-primary)',
											'[&_ul]:mx-auto [&_ul]:w-fit [&_ul]:max-w-[min(100%,36rem)] [&_ul]:text-left',
											'[&_ol]:mx-auto [&_ol]:w-fit [&_ol]:max-w-[min(100%,36rem)] [&_ol]:text-left',
											'[&_blockquote]:mx-auto [&_blockquote]:max-w-[min(100%,36rem)] [&_blockquote]:border-l-[rgb(var(--desktop-accent-rgb)/0.55)]',
											'[&_blockquote]:text-left [&_blockquote]:text-(--desktop-text-secondary)',
											'[&_h2]:mx-auto [&_h2]:max-w-[min(100%,38rem)] [&_h2]:text-[1.2rem] [&_h2]:tracking-tight',
											'[&_h3]:mx-auto [&_h3]:max-w-[min(100%,38rem)] [&_h3]:text-[1.05rem] [&_h3]:tracking-tight',
											'[&_hr]:mx-auto [&_hr]:max-w-[min(100%,24rem)]',
											'[&_hr]:border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.35)_100%,transparent)]',
											'[&_strong]:text-(--desktop-text-primary)',
											'[&_a]:font-medium',
											'[&_table]:mx-auto',
											'[&_button.not-prose]:rounded-xl [&_button.not-prose]:border [&_button.not-prose]:border-[rgb(var(--desktop-accent-rgb)/0.3)] [&_button.not-prose]:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.14)_100%,transparent)] [&_button.not-prose]:px-3.5 [&_button.not-prose]:py-2 [&_button.not-prose]:text-[0.8125rem] [&_button.not-prose]:font-semibold [&_button.not-prose]:shadow-[0_1px_0_0_rgba(255,255,255,0.06)] [&_button.not-prose]:transition-colors',
											'[&_button.not-prose]:hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.22)_100%,transparent)]'
										)}
									/>
									{selected.image_content_id || selected.image_url ? (
										<figure className="mx-auto mt-8 w-full max-w-[min(100%,40rem)] overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_58%,transparent)] shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]">
											<EwDeskNewsImage
												contentId={selected.image_content_id}
												src={selected.image_url}
												alt=""
												className={heroImageClass}
											/>
										</figure>
									) : null}
								</div>
							) : null}
							<div
								className="mx-auto mt-12 flex max-w-32 flex-col items-center gap-2.5"
								aria-hidden
							>
								<div className="h-px w-full bg-linear-to-r from-transparent via-[rgb(var(--desktop-accent-rgb)/0.22)] to-transparent opacity-95" />
								<div className="flex items-center gap-1.5">
									<div className="h-1 w-1 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.28)] opacity-90" />
									<div className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.42)] shadow-[0_0_10px_rgb(var(--desktop-accent-rgb)/0.28)]" />
									<div className="h-1 w-1 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.28)] opacity-90" />
								</div>
							</div>
						</div>
					</article>
				</div>
			)}
		</section>
	);
}
