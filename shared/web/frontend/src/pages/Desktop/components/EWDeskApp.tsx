/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app: company news feed (EWDesk) — list, reading pane, filters, server-synced state, and
 * operator-visible draft suggestions handed off from Professional Worlds.
 *
 * Invariants:
 * - List loads without post body; full Markdown fetched per selected id only.
 * - Text search and list filters (pinned/unread/starred/sort) use server GET /news query params.
 * - Search `q` matches title/body (FTS) and post id prefix when query looks like a UUID fragment.
 * - Feed pages load via limit/offset infinite query + scroll sentinel auto load-more.
 * - Read/starred merge localStorage with GET/PATCH /news/my-state when authenticated.
 * - Desktop chrome header is toolbar-only (tagline + refresh); shell WindowTitleBar owns app title.
 *
 * Related:
 * - components/ewDesk/*, services/productDesktopApi.ts, documentation/product/desktop/EWDESK-NEWS.md
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md
 * - DesktopChromeTooltip.tsx
 */
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MOBILE_EMBEDDED_APP_ROOT_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { isMobileEwDeskEmbeddedRoute } from '@/utils/mobileEmbeddedSpaRoute';
import { shouldRenderFullShellOnlyChrome } from '@/utils/desktopFullShellChrome';
import { cn } from '@/utils/cn';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreferencesApp } from '../../../contexts/UserPreferencesAppContext';
import {
	DEFAULT_UI_PREFERENCES,
	normalizeDesktopIconStyle,
} from '../../../types/profile';
import { useDesktopShellFrame } from '../context/DesktopShellFrameContext';
import { useDesktopWindowPortalStackBase } from '../context/DesktopWindowPortalStackContext';
import { getDesktopShellHeaderStripClassName } from '../utils/desktopVisualSystem';
import type { CompanyNewsPost } from '../services/productDesktopApi';
import { ewDeskNewsPostQueryOptions } from './ewDesk/ewDeskNewsQueryOptions';
import {
	DesktopAppContentWrapper,
	DESKTOP_APP_STYLE_CONTRACT,
} from './DesktopAppChrome';
import {
	EWDESK_MARK_ALL_READ_CONFIRM_MIN,
	type EwDeskReadingWidth,
} from './ewDesk/ewDeskConstants';
import { formatEwDeskRelativeNewsDate } from './ewDesk/ewDeskFormatting';
import {
	loadEwDeskReadingWidth,
	persistEwDeskReadingWidth,
} from './ewDesk/ewDeskLocalState';
import { useEwDeskUserStateSync } from './ewDesk/useEwDeskUserStateSync';
import { useEwDeskNewsCounts } from './ewDesk/useEwDeskNewsCounts';
import { useEwDeskNewsFeed } from './ewDesk/useEwDeskNewsFeed';
import { useEwDeskNewsAutoLoadMore } from './ewDesk/useEwDeskNewsAutoLoadMore';
import {
	buildEwDeskFeedFiltersFromListState,
	DEFAULT_EWDESK_LIST_FILTER_STATE,
	isEwDeskListFiltersActive,
} from './ewDesk/ewDeskListFilterState';
import { resolveEwDeskPostReadToggleAction } from './ewDesk/ewDeskPostReadToggle';
import { getEwDeskActiveFilterParts } from './ewDesk/ewDeskActiveFilterParts';
import { buildEwDeskNewsDeepLink } from './ewDesk/ewDeskDeepLink';
import { EwDeskAppHeader } from './ewDesk/EwDeskAppHeader';
import { EwDeskFeedListSection } from './ewDesk/EwDeskFeedListSection';
import { EwDeskFeedDetailSection } from './ewDesk/EwDeskFeedDetailSection';
import { EwDeskListContextMenu } from './ewDesk/EwDeskListContextMenu';
import { EwDeskMobileBackBar } from './ewDesk/EwDeskMobileBackBar';
import { EwDeskPwDraftBanner } from './ewDesk/EwDeskPwDraftBanner';
import { useEwDeskAppKeyboard } from './ewDesk/useEwDeskAppKeyboard';
import { useEwDeskAppOptionFocus } from './ewDesk/useEwDeskAppOptionFocus';
import type { ProfessionalWorldsEwDeskSuggestion } from '@/features/professional-worlds/desktop/professionalWorldsCrossAppDraft';
import { stashProfessionalWorldsEwDeskAdminDraft } from '@/features/professional-worlds/desktop/professionalWorldsEwDeskAdminBridge';
import { saveEmbeddedAdminSection } from '@/pages/Admin/shell/adminShellLastSection';
import { hasUgsAdminIdentity } from '@/utils/ugsAdminAccess';
import { requestOpenDesktopApp } from '../utils/desktopDeepLink';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import {
	EW_DESK_GUIDE_AUDIO_LS_KEY,
	EW_DESK_GUIDE_ROOT_ID,
	EW_DESK_GUIDE_STEP_DEFS,
	EW_DESK_GUIDE_TOUR_FOLDER,
} from './ewDeskGuideConstants';

type EWDeskAppProps = {
	/** Open a post by id (deep link `?ewdesk_news=` or window initialPayload). */
	initialNewsId?: string | null;
	/** Professional Worlds handoff suggestion; shown as operator draft, never auto-published. */
	initialProfessionalWorldsDraft?: ProfessionalWorldsEwDeskSuggestion | null;
	/** MobileAndroid embedded WebView — compact shell, native toolbar owns title. */
	embeddedMobile?: boolean;
};

export default function EWDeskApp({
	initialNewsId = null,
	initialProfessionalWorldsDraft = null,
	embeddedMobile,
}: EWDeskAppProps = {}): React.ReactElement {
	const embeddedMobileLayout = embeddedMobile ?? isMobileEwDeskEmbeddedRoute();
	const { t, i18n } = useTranslation('desktopUi', { keyPrefix: 'ewDesk' });
	const guideLabels = React.useMemo(
		() => guideTourLabelsFromI18n(t, 'guide'),
		[t]
	);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		EW_DESK_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = React.useState(false);
	const openGuideTour = React.useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour, { enabled: !embeddedMobileLayout });
	const queryClient = useQueryClient();
	const prefsCtx = useUserPreferencesApp();
	const desktopIconStyle = normalizeDesktopIconStyle(
		prefsCtx?.preferences?.ui.desktop_icon_style ??
			DEFAULT_UI_PREFERENCES.desktop_icon_style
	);
	const shellFrame = useDesktopShellFrame();
	const portalStackBase = useDesktopWindowPortalStackBase();
	const isMdUp = useMediaQuery('(min-width: 768px)');
	const splitPaneLayout = isMdUp && !embeddedMobileLayout;

	const headerStripClass = React.useMemo(
		() =>
			cn(
				getDesktopShellHeaderStripClassName(shellFrame),
				'text-(--desktop-text-primary)'
			),
		[shellFrame]
	);

	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [searchQuery, setSearchQuery] = React.useState('');
	const deferredSearchQuery = React.useDeferredValue(searchQuery);
	const [sortOrder, setSortOrder] = React.useState<'newest' | 'oldest'>(
		'newest'
	);
	const [pinnedOnly, setPinnedOnly] = React.useState(false);
	const [unreadOnly, setUnreadOnly] = React.useState(false);
	const [starredOnly, setStarredOnly] = React.useState(false);
	const { user } = useAuth();
	const canOpenEwDeskAdminPublish = React.useMemo(
		() => hasUgsAdminIdentity(user),
		[user]
	);
	const handleOpenEwDeskAdminPublish = React.useCallback(() => {
		const draft = initialProfessionalWorldsDraft;
		if (!draft?.crossAppLinkId || !canOpenEwDeskAdminPublish) return;
		const stashed = stashProfessionalWorldsEwDeskAdminDraft({
			title: draft.title,
			markdown: draft.markdown,
			crossAppLinkId: draft.crossAppLinkId,
		});
		if (!stashed) {
			toast.error(t('pwDraftOpenAdminFailed'));
			return;
		}
		saveEmbeddedAdminSection('ewdesk');
		requestOpenDesktopApp({ appComponent: 'UnifiedAdminApp' });
	}, [canOpenEwDeskAdminPublish, initialProfessionalWorldsDraft, t]);
	const [readingWidth, setReadingWidth] = React.useState<EwDeskReadingWidth>(
		() => loadEwDeskReadingWidth()
	);
	const [listRowContextMenu, setListRowContextMenu] = React.useState<{
		x: number;
		y: number;
		postId: string;
	} | null>(null);
	const [showKeyboardHints, setShowKeyboardHints] = React.useState(false);

	const setReadingWidthPersist = React.useCallback((w: EwDeskReadingWidth) => {
		setReadingWidth(w);
		persistEwDeskReadingWidth(w);
	}, []);

	const appliedInitialNewsRef = React.useRef(false);
	const selectedIdRef = React.useRef<string | null>(null);
	selectedIdRef.current = selectedId;
	const ewDeskRootRef = React.useRef<HTMLDivElement | null>(null);
	const listColumnRef = React.useRef<HTMLDivElement | null>(null);
	const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
	const searchInputRef = React.useRef<HTMLInputElement | null>(null);
	const detailScrollRef = React.useRef<HTMLElement | null>(null);

	const deferredSearchNormalized = deferredSearchQuery.trim().toLowerCase();
	const isSearchFilterPending =
		searchQuery.trim() !== deferredSearchQuery.trim() &&
		searchQuery.trim().length > 0;

	const listFilterState = React.useMemo(
		() => ({
			searchQuery,
			sortOrder,
			pinnedOnly,
			unreadOnly,
			starredOnly,
		}),
		[searchQuery, sortOrder, pinnedOnly, unreadOnly, starredOnly]
	);

	const feedFilters = React.useMemo(
		() =>
			buildEwDeskFeedFiltersFromListState(
				listFilterState,
				deferredSearchNormalized
			),
		[listFilterState, deferredSearchNormalized]
	);

	const resetListFilters = React.useCallback(() => {
		setSearchQuery(DEFAULT_EWDESK_LIST_FILTER_STATE.searchQuery);
		setSortOrder(DEFAULT_EWDESK_LIST_FILTER_STATE.sortOrder);
		setPinnedOnly(DEFAULT_EWDESK_LIST_FILTER_STATE.pinnedOnly);
		setUnreadOnly(DEFAULT_EWDESK_LIST_FILTER_STATE.unreadOnly);
		setStarredOnly(DEFAULT_EWDESK_LIST_FILTER_STATE.starredOnly);
	}, []);

	const listFiltersActive = isEwDeskListFiltersActive(listFilterState);

	const activeFilterSummary = React.useMemo(() => {
		return getEwDeskActiveFilterParts(listFilterState)
			.map((part) => {
				switch (part.kind) {
					case 'search':
						return t('activeFilterSearch', { query: part.query });
					case 'pinned':
						return t('activeFilterPinned');
					case 'unread':
						return t('activeFilterUnread');
					case 'starred':
						return t('activeFilterStarred');
					case 'sortOldest':
						return t('activeFilterSortOldest');
					default:
						return '';
				}
			})
			.filter(Boolean)
			.join(' · ');
	}, [listFilterState, t]);

	const listFeed = useEwDeskNewsFeed(feedFilters);
	const posts = listFeed.posts;
	const filteredPosts = posts;
	const { unreadCount, starredCount } = useEwDeskNewsCounts(Boolean(user));
	const listReady = !listFeed.isLoading && !listFeed.isError;
	const showLoadedOfTotal =
		listFeed.hasNextPage || posts.length < listFeed.serverTotal;

	const {
		readIds,
		starredIds,
		setReadIds,
		setStarredIds,
		markPostRead,
		markPostUnread,
		markAllRead,
		markFeedSeen,
	} = useEwDeskUserStateSync({
		enabled: Boolean(user),
		posts,
		selectedId,
	});

	React.useEffect(() => {
		if (!listReady || posts.length === 0) return;
		markFeedSeen();
	}, [listReady, markFeedSeen, posts.length]);

	const detailQuery = useQuery({
		...ewDeskNewsPostQueryOptions(selectedId as string),
		enabled: Boolean(selectedId),
	});

	const listFeedRef = React.useRef(listFeed);
	listFeedRef.current = listFeed;

	const selected: CompanyNewsPost | undefined = selectedId
		? detailQuery.data
		: undefined;
	const selectedPublishedRelative = selected
		? formatEwDeskRelativeNewsDate(selected.published_at, i18n.language)
		: '';

	const hasActiveFilters = listFiltersActive;

	const filteredPostsRef = React.useRef(filteredPosts);
	filteredPostsRef.current = filteredPosts;

	/** Warm cache for prev/next article while navigating (same stale window as queries). */
	React.useEffect(() => {
		if (!selectedId) return;
		const list = filteredPosts;
		const idx = list.findIndex((p) => p.id === selectedId);
		if (idx < 0) return;
		const prefetch = (id: string | undefined): void => {
			if (!id) return;
			void queryClient.prefetchQuery(ewDeskNewsPostQueryOptions(id));
		};
		prefetch(list[idx + 1]?.id);
		prefetch(list[idx - 1]?.id);
	}, [selectedId, filteredPosts, queryClient]);

	/** Drop read markers for posts removed from the server — keeps storage small and counts accurate. */
	React.useEffect(() => {
		if (posts.length === 0) return;
		const valid = new Set(posts.map((p) => p.id));
		setReadIds((prev) => {
			let changed = false;
			const next = new Set<string>();
			for (const id of prev) {
				if (valid.has(id)) next.add(id);
				else changed = true;
			}
			if (!changed && next.size === prev.size) return prev;
			return next;
		});
		setStarredIds((prev) => {
			let changed = false;
			const next = new Set<string>();
			for (const id of prev) {
				if (valid.has(id)) next.add(id);
				else changed = true;
			}
			if (!changed && next.size === prev.size) return prev;
			return next;
		});
	}, [posts, setReadIds, setStarredIds]);

	React.useEffect(() => {
		if (appliedInitialNewsRef.current) return;
		const raw = initialNewsId?.trim();
		if (!raw) return;
		if (!listReady) return;
		appliedInitialNewsRef.current = true;
		setSelectedId(raw);
	}, [initialNewsId, listReady]);

	const deepLinkNotFoundNotifiedRef = React.useRef(false);
	React.useEffect(() => {
		const raw = initialNewsId?.trim();
		if (!raw || selectedId !== raw || !detailQuery.isError) return;
		if (deepLinkNotFoundNotifiedRef.current) return;
		deepLinkNotFoundNotifiedRef.current = true;
		toast.error(t('deepLinkPostNotFound'));
	}, [initialNewsId, selectedId, detailQuery.isError, t]);

	React.useEffect(() => {
		if (splitPaneLayout || !selectedId) return;
		const onKey = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				e.preventDefault();
				setSelectedId(null);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [splitPaneLayout, selectedId]);

	React.useEffect(() => {
		if (!listFiltersActive) return;
		const onKey = (e: KeyboardEvent): void => {
			if (e.key !== 'Escape') return;
			if (!splitPaneLayout && selectedIdRef.current) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest('input, textarea, [contenteditable="true"]')) {
				return;
			}
			e.preventDefault();
			resetListFilters();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [listFiltersActive, resetListFilters, splitPaneLayout]);

	React.useEffect(() => {
		if (!selectedId) return;
		const el = detailScrollRef.current;
		if (el) {
			el.scrollTop = 0;
		}
	}, [selectedId]);

	const {
		getOptionButtonRef,
		focusOptionAtRef,
		handleOptionKeyDown,
		getOptionTabIndex,
	} = useEwDeskAppOptionFocus(filteredPosts, selectedId, setSelectedId);

	const handleSelectPost = React.useCallback((id: string): void => {
		setSelectedId(id);
	}, []);

	const handleListRowContextMenu = React.useCallback(
		(e: React.MouseEvent, postId: string) => {
			e.preventDefault();
			e.stopPropagation();
			setListRowContextMenu({ x: e.clientX, y: e.clientY, postId });
		},
		[]
	);

	React.useEffect(() => {
		if (!listRowContextMenu) return;
		const close = () => setListRowContextMenu(null);
		window.addEventListener('click', close);
		return () => window.removeEventListener('click', close);
	}, [listRowContextMenu]);

	React.useEffect(() => {
		if (!listRowContextMenu) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setListRowContextMenu(null);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [listRowContextMenu]);

	const handleMarkAllRead = React.useCallback(() => {
		if (
			unreadCount >= EWDESK_MARK_ALL_READ_CONFIRM_MIN &&
			!window.confirm(t('markAllReadConfirm', { count: unreadCount }))
		) {
			return;
		}
		markAllRead();
	}, [markAllRead, t, unreadCount]);

	const readIdsRef = React.useRef(readIds);
	readIdsRef.current = readIds;
	const markPostReadRef = React.useRef(markPostRead);
	markPostReadRef.current = markPostRead;
	const markPostUnreadRef = React.useRef(markPostUnread);
	markPostUnreadRef.current = markPostUnread;

	const toggleSelectedReadState = React.useCallback(() => {
		const sid = selectedIdRef.current;
		if (!sid) return;
		const action = resolveEwDeskPostReadToggleAction(sid, readIdsRef.current);
		if (action === 'mark_unread') {
			markPostUnreadRef.current(sid);
		} else {
			markPostReadRef.current(sid);
		}
	}, []);

	const toggleSelectedReadStateRef = React.useRef(toggleSelectedReadState);
	toggleSelectedReadStateRef.current = toggleSelectedReadState;

	const handleToggleStarById = React.useCallback(
		(id: string) => {
			setStarredIds((prev) => {
				const next = new Set(prev);
				if (next.has(id)) {
					next.delete(id);
				} else {
					next.add(id);
				}
				return next;
			});
		},
		[setStarredIds]
	);

	const handleToggleStarByIdRef = React.useRef(handleToggleStarById);
	handleToggleStarByIdRef.current = handleToggleStarById;

	const handleToggleStar = React.useCallback(() => {
		if (!selected) return;
		handleToggleStarById(selected.id);
	}, [selected, handleToggleStarById]);

	const copyPostId = React.useCallback(
		async (postId: string) => {
			const copied = await safeCopyToClipboard(postId);
			if (copied) {
				toast.success(t('postIdCopied'));
			} else {
				toast.error(t('postIdCopyError'));
			}
		},
		[t]
	);

	const copyPostLink = React.useCallback(
		async (postId: string) => {
			try {
				const link = buildEwDeskNewsDeepLink(postId, {
					origin: window.location.origin,
					pathname: window.location.pathname,
				});
				const copied = await safeCopyToClipboard(link);
				if (copied) {
					toast.success(t('postLinkCopied'));
				} else {
					toast.error(t('postLinkCopyError'));
				}
			} catch {
				toast.error(t('postLinkCopyError'));
			}
		},
		[t]
	);

	const copyPostLinkRef = React.useRef(copyPostLink);
	copyPostLinkRef.current = copyPostLink;

	const hoverPrefetchRef = React.useRef<{ id: string; at: number } | null>(
		null
	);
	const prefetchPostDetailOnHover = React.useCallback(
		(id: string) => {
			const now = Date.now();
			const last = hoverPrefetchRef.current;
			if (last?.id === id && now - last.at < 1200) {
				return;
			}
			hoverPrefetchRef.current = { id, at: now };
			void queryClient.prefetchQuery(ewDeskNewsPostQueryOptions(id));
		},
		[queryClient]
	);

	const selectedIsStarred = Boolean(selected && starredIds.has(selected.id));
	const selectedListTitle =
		filteredPosts.find((p) => p.id === selectedId)?.title ??
		selected?.title ??
		'';

	useEwDeskAppKeyboard({
		ewDeskRootRef,
		searchInputRef,
		selectedIdRef,
		filteredPostsRef,
		listFeedRef,
		focusOptionAtRef,
		handleToggleStarByIdRef,
		toggleSelectedReadStateRef,
		copyPostLinkRef,
		setShowKeyboardHints,
		setSelectedId,
	});

	const showListColumn = splitPaneLayout || !selectedId;
	/** Wide layout always shows the detail column (empty state until selection). */
	const showDetailPane = splitPaneLayout || Boolean(selectedId);

	useEwDeskNewsAutoLoadMore(listColumnRef, loadMoreSentinelRef, {
		enabled: listReady && showListColumn,
		hasNextPage: listFeed.hasNextPage,
		isFetchingNextPage: listFeed.isFetchingNextPage,
		fetchNextPage: listFeed.fetchNextPage,
	});

	const listSection = (
		<EwDeskFeedListSection
			t={t}
			shellFrame={shellFrame}
			listColumnRef={listColumnRef}
			showListColumn={showListColumn}
			listFeed={listFeed}
			unreadCount={unreadCount}
			starredCount={starredCount}
			showLoadedOfTotal={showLoadedOfTotal}
			hasActiveFilters={hasActiveFilters}
			posts={posts}
			listFiltersActive={listFiltersActive}
			activeFilterSummary={activeFilterSummary}
			searchQuery={searchQuery}
			setSearchQuery={setSearchQuery}
			searchInputRef={searchInputRef}
			isSearchFilterPending={isSearchFilterPending}
			deferredSearchQuery={deferredSearchQuery}
			pinnedOnly={pinnedOnly}
			setPinnedOnly={setPinnedOnly}
			unreadOnly={unreadOnly}
			setUnreadOnly={setUnreadOnly}
			starredOnly={starredOnly}
			setStarredOnly={setStarredOnly}
			sortOrder={sortOrder}
			setSortOrder={setSortOrder}
			resetListFilters={resetListFilters}
			handleMarkAllRead={handleMarkAllRead}
			showKeyboardHints={showKeyboardHints}
			listReady={listReady}
			filteredPosts={filteredPosts}
			selectedId={selectedId}
			readIds={readIds}
			starredIds={starredIds}
			getOptionButtonRef={getOptionButtonRef}
			getOptionTabIndex={getOptionTabIndex}
			handleOptionKeyDown={handleOptionKeyDown}
			handleSelectPost={handleSelectPost}
			prefetchPostDetailOnHover={prefetchPostDetailOnHover}
			handleListRowContextMenu={handleListRowContextMenu}
			loadMoreSentinelRef={loadMoreSentinelRef}
		/>
	);

	const detailSection = showDetailPane ? (
		<EwDeskFeedDetailSection
			t={t}
			detailScrollRef={detailScrollRef}
			selectedId={selectedId}
			splitPaneLayout={splitPaneLayout}
			selectedListTitle={selectedListTitle}
			detailQuery={detailQuery}
			shellFrame={shellFrame}
			selected={selected}
			selectedPublishedRelative={selectedPublishedRelative}
			readingWidth={readingWidth}
			setReadingWidthPersist={setReadingWidthPersist}
			selectedIsStarred={selectedIsStarred}
			handleToggleStar={handleToggleStar}
			copyPostLink={copyPostLink}
			copyPostId={copyPostId}
		/>
	) : null;

	return (
		<DesktopAppContentWrapper
			className={cn(
				DESKTOP_APP_STYLE_CONTRACT.shell,
				'flex min-h-0 h-full flex-col bg-(--desktop-surface-app)'
			)}
		>
			<div
				ref={ewDeskRootRef}
				id={EW_DESK_GUIDE_ROOT_ID}
				data-ewdesk-root={embeddedMobileLayout ? '1' : undefined}
				data-embedded-mobile={embeddedMobileLayout ? '1' : undefined}
				className={cn(
					'relative flex min-h-0 flex-1 flex-col outline-none',
					embeddedMobileLayout && MOBILE_EMBEDDED_APP_ROOT_CLASS
				)}
				tabIndex={-1}
			>
				{shouldRenderFullShellOnlyChrome(embeddedMobileLayout) ? (
					<EwDeskAppHeader
						t={t}
						headerStripClass={headerStripClass}
						desktopIconStyle={desktopIconStyle}
						listFeedIsFetching={listFeed.isFetching}
						onRefresh={() => {
							void listFeed.refetch();
						}}
					/>
				) : null}

				{initialProfessionalWorldsDraft ? (
					<EwDeskPwDraftBanner
						t={t}
						draft={initialProfessionalWorldsDraft}
						canOpenEwDeskAdminPublish={canOpenEwDeskAdminPublish}
						onOpenAdminPublish={handleOpenEwDeskAdminPublish}
					/>
				) : null}

				<div className="flex min-h-0 flex-1 flex-col md:flex-row md:gap-px">
					{splitPaneLayout ? (
						<>
							{listSection}
							{detailSection}
						</>
					) : selectedId ? (
						<div className="flex min-h-0 flex-1 flex-col">
							<EwDeskMobileBackBar
								t={t}
								headerStripClass={headerStripClass}
								onBack={() => setSelectedId(null)}
							/>
							{detailSection}
						</div>
					) : (
						listSection
					)}
				</div>
				<EwDeskListContextMenu
					t={t}
					menu={listRowContextMenu}
					portalStackBase={portalStackBase}
					filteredPosts={filteredPosts}
					readIds={readIds}
					starredIds={starredIds}
					onClose={() => setListRowContextMenu(null)}
					onSelectPost={handleSelectPost}
					onMarkRead={markPostRead}
					onMarkUnread={markPostUnread}
					onToggleStar={handleToggleStarById}
					onCopyLink={copyPostLink}
					onCopyId={copyPostId}
				/>
			</div>
			{!embeddedMobileLayout ? (
				<SpotlightGuideModal
					open={guideOpen}
					onClose={() => setGuideOpen(false)}
					rootId={EW_DESK_GUIDE_ROOT_ID}
					steps={guideSteps}
					audioLocalStorageKey={EW_DESK_GUIDE_AUDIO_LS_KEY}
					tourAudioFolder={EW_DESK_GUIDE_TOUR_FOLDER}
					labels={guideLabels}
					dialogTitleId="ewdesk-guide-title"
				/>
			) : null}
		</DesktopAppContentWrapper>
	);
}
