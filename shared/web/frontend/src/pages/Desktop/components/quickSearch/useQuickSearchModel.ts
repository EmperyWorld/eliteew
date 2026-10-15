/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quick Search controller: query/results flat rows, context menu state,
 * activate + shell keyboard/escape capture (P23 extract from QuickSearch.tsx).
 *
 * Invariants:
 * - Arrow/Home/End/Enter use selectedIndexRef + flatRowsRef (not stale closure).
 * - Escape: ctx menu dismissed separately; search clear then close via capture layer.
 *
 * Related:
 * - components/QuickSearch.tsx
 * - hooks/useShellCaptureKeyboard.ts
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { notify } from '@/notifications';
import {
	buildDesktopLibraryDiscoverySlices,
	buildQuickSearchRecentFilePool,
	rankRecentFilesForQuery,
} from '../../utils/desktopDiscoveryModel';
import { rankDesktopAppsForQuery } from '../../utils/desktopLauncherFuzzySearch';
import { QUICK_SEARCH_IDLE_RECENT_APPS_CAP } from '../../utils/desktopLauncherRoles';
import { useDesktopShellSearchFocusOnVisible } from '../../hooks/useDesktopShellSearchFocusOnVisible';
import { useDismissibleFloatingMenu } from '../../hooks/useDismissibleFloatingMenu';
import {
	consumeEscapeForSearchClear,
	useShellCaptureEscape,
	useShellCaptureKeyboard,
} from '../../hooks/useShellCaptureKeyboard';
import type { DesktopItem, RecentFile } from '../../types/desktop.types';
import {
	desktopItemFromAppRowData,
	matchActionQuery,
} from '../quickSearch/helpers';
import type {
	BrowseSectionStarts,
	LauncherRow,
	QuickAction,
	QuickSearchCtxMenu,
	QuickSearchProps,
	SearchResult,
} from '../quickSearch/types';

export type UseQuickSearchModelInput = Pick<
	QuickSearchProps,
	| 'isOpen'
	| 'onClose'
	| 'items'
	| 'onOpenItem'
	| 'recentItems'
	| 'recentFiles'
	| 'recentLibraryOpened'
	| 'recentLibraryAdded'
	| 'recentLibraryGenerated'
	| 'recentLibraryUploaded'
	| 'recentLibraryProjects'
	| 'onOpenRecentFile'
	| 'onQuickAction'
	| 'quickActions'
>;

export function useQuickSearchModel({
	isOpen,
	onClose,
	items,
	onOpenItem,
	recentItems = [],
	recentFiles = [],
	recentLibraryOpened = [],
	recentLibraryAdded = [],
	recentLibraryGenerated = [],
	recentLibraryUploaded = [],
	recentLibraryProjects = [],
	onOpenRecentFile,
	onQuickAction,
	quickActions = [],
}: UseQuickSearchModelInput) {
	const { t } = useTranslation('desktopUi');
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const selectedIndexRef = useRef(0);
	selectedIndexRef.current = selectedIndex;
	const flatRowsRef = useRef<LauncherRow[]>([]);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [ctxMenu, setCtxMenu] = useState<QuickSearchCtxMenu>(null);
	const ctxMenuRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

	const copyLauncherText = useCallback(
		async (text: string) => {
			const copied = await safeCopyToClipboard(text);
			if (copied) {
				notify.success(t('quickSearch.copyDone'));
			} else {
				notify.error(t('quickSearch.copyFailed'));
			}
			closeCtxMenu();
		},
		[t, closeCtxMenu]
	);

	useEffect(() => {
		if (!isOpen) setCtxMenu(null);
	}, [isOpen]);

	useDismissibleFloatingMenu({
		isOpen: ctxMenu != null,
		menuRef: ctxMenuRef,
		onClose: closeCtxMenu,
		escapeCapture: true,
	});

	const openAppCtx = useCallback(
		(e: React.MouseEvent, data: SearchResult | DesktopItem) => {
			e.preventDefault();
			e.stopPropagation();
			setCtxMenu({
				kind: 'app',
				item: desktopItemFromAppRowData(data),
				x: e.clientX,
				y: e.clientY,
			});
		},
		[]
	);

	const openFileCtx = useCallback((e: React.MouseEvent, file: RecentFile) => {
		e.preventDefault();
		e.stopPropagation();
		setCtxMenu({ kind: 'file', file, x: e.clientX, y: e.clientY });
	}, []);

	const openActionCtx = useCallback(
		(e: React.MouseEvent, action: QuickAction) => {
			e.preventDefault();
			e.stopPropagation();
			setCtxMenu({ kind: 'action', action, x: e.clientX, y: e.clientY });
		},
		[]
	);

	const fuzzySearch = useCallback(
		(
			searchQuery: string,
			searchItems: DesktopItem[],
			recent: DesktopItem[]
		): SearchResult[] =>
			rankDesktopAppsForQuery(searchQuery, searchItems, recent),
		[]
	);

	useEffect(() => {
		if (query) {
			setResults(fuzzySearch(query, items, recentItems));
			setSelectedIndex(0);
		} else {
			setResults([]);
		}
	}, [query, items, recentItems, fuzzySearch]);

	const fileResultsForQuery = useMemo(() => {
		if (!query.trim()) return [];
		return rankRecentFilesForQuery(
			buildQuickSearchRecentFilePool({
				recentFiles,
				recentLibraryOpened,
				recentLibraryAdded,
				recentLibraryGenerated,
				recentLibraryUploaded,
				recentLibraryProjects,
			}),
			query,
			8
		);
	}, [
		query,
		recentFiles,
		recentLibraryOpened,
		recentLibraryAdded,
		recentLibraryGenerated,
		recentLibraryUploaded,
		recentLibraryProjects,
	]);

	const qsBrowseDiscovery = useMemo(
		() =>
			buildDesktopLibraryDiscoverySlices({
				recentFiles,
				recentLibraryOpened,
				recentLibraryAdded,
				recentLibraryGenerated,
				recentLibraryUploaded,
				recentLibraryProjects,
				limits: {
					recentDocuments: 8,
					projects: 6,
					generated: 4,
					uploaded: 4,
					added: 4,
				},
			}),
		[
			recentFiles,
			recentLibraryOpened,
			recentLibraryAdded,
			recentLibraryGenerated,
			recentLibraryUploaded,
			recentLibraryProjects,
		]
	);

	const libraryRecentProjectsLimited = useMemo(
		() => (query ? [] : qsBrowseDiscovery.projects),
		[query, qsBrowseDiscovery.projects]
	);
	const actionResultsForQuery = useMemo(() => {
		if (!query.trim()) return quickActions;
		const q = query.toLowerCase();
		return quickActions.filter((a) => matchActionQuery(a, q)).slice(0, 5);
	}, [query, quickActions]);

	const recentAppsLimited = useMemo(
		() =>
			query ? [] : recentItems.slice(0, QUICK_SEARCH_IDLE_RECENT_APPS_CAP),
		[query, recentItems]
	);
	const recentDocumentsUnifiedLimited = useMemo(
		() => (query.trim() ? [] : qsBrowseDiscovery.recentDocumentsUnified),
		[query, qsBrowseDiscovery.recentDocumentsUnified]
	);
	const libraryRecentGeneratedLimited = useMemo(
		() => (query ? [] : qsBrowseDiscovery.generated),
		[query, qsBrowseDiscovery.generated]
	);
	const libraryRecentUploadedLimited = useMemo(
		() => (query ? [] : qsBrowseDiscovery.uploaded),
		[query, qsBrowseDiscovery.uploaded]
	);
	const libraryRecentAddedLimited = useMemo(
		() => (query ? [] : qsBrowseDiscovery.added),
		[query, qsBrowseDiscovery.added]
	);
	const pinnedItems = useMemo(
		() => items.filter((i) => i.isPinned && i.type === 'app').slice(0, 5),
		[items]
	);
	const contentManagerItem = useMemo(
		() =>
			items.find(
				(i) =>
					i.type === 'app' &&
					(i.appComponent === 'ContentManagerPro' ||
						i.name.toLowerCase().includes('file manager') ||
						i.name.toLowerCase().includes('файловый менеджер'))
			) ?? null,
		[items]
	);

	const flatRows = useMemo((): LauncherRow[] => {
		if (query) {
			return [
				...results.map((r) => ({ type: 'app' as const, data: r })),
				...fileResultsForQuery.map((f) => ({ type: 'file' as const, data: f })),
				...actionResultsForQuery.map((a) => ({
					type: 'action' as const,
					data: a,
				})),
			];
		}
		return [
			...quickActions.map((a) => ({ type: 'action' as const, data: a })),
			...recentDocumentsUnifiedLimited.map((f) => ({
				type: 'file' as const,
				data: f,
			})),
			...libraryRecentProjectsLimited.map((f) => ({
				type: 'file' as const,
				data: f,
			})),
			...libraryRecentGeneratedLimited.map((f) => ({
				type: 'file' as const,
				data: f,
			})),
			...libraryRecentUploadedLimited.map((f) => ({
				type: 'file' as const,
				data: f,
			})),
			...libraryRecentAddedLimited.map((f) => ({
				type: 'file' as const,
				data: f,
			})),
			// Wave 6: MRU apps after files — Start owns browsable catalog (desktopLauncherRoles).
			...recentAppsLimited.map((i) => ({ type: 'app' as const, data: i })),
			...pinnedItems.map((i) => ({ type: 'app' as const, data: i })),
		];
	}, [
		query,
		results,
		fileResultsForQuery,
		actionResultsForQuery,
		quickActions,
		recentAppsLimited,
		recentDocumentsUnifiedLimited,
		libraryRecentProjectsLimited,
		libraryRecentGeneratedLimited,
		libraryRecentUploadedLimited,
		libraryRecentAddedLimited,
		pinnedItems,
	]);

	flatRowsRef.current = flatRows;

	const browseSectionStarts = useMemo((): BrowseSectionStarts => {
		let n = quickActions.length;
		const unifiedDocsStart = n;
		n += recentDocumentsUnifiedLimited.length;
		const projectsStart = n;
		n += libraryRecentProjectsLimited.length;
		const libGenStart = n;
		n += libraryRecentGeneratedLimited.length;
		const libUpStart = n;
		n += libraryRecentUploadedLimited.length;
		const libAddedStart = n;
		n += libraryRecentAddedLimited.length;
		const recentAppsStart = n;
		n += recentAppsLimited.length;
		const pinnedStart = n;
		return {
			recentAppsStart,
			unifiedDocsStart,
			projectsStart,
			libGenStart,
			libUpStart,
			libAddedStart,
			pinnedStart,
		};
	}, [
		quickActions.length,
		recentDocumentsUnifiedLimited.length,
		libraryRecentProjectsLimited.length,
		libraryRecentGeneratedLimited.length,
		libraryRecentUploadedLimited.length,
		libraryRecentAddedLimited.length,
		recentAppsLimited.length,
	]);

	const maxIndex = Math.max(0, flatRows.length - 1);
	useEffect(() => {
		setSelectedIndex((i) => (i > maxIndex ? maxIndex : i));
	}, [maxIndex]);

	useEffect(() => {
		if (isOpen) {
			setQuery('');
			setResults([]);
			setSelectedIndex(0);
		}
	}, [isOpen]);

	useDesktopShellSearchFocusOnVisible(inputRef, isOpen);

	const activateRow = useCallback(
		(row: LauncherRow) => {
			if (row.type === 'app') {
				const item =
					'item' in row.data
						? (row.data as SearchResult).item
						: (row.data as DesktopItem);
				onOpenItem(item);
			} else if (row.type === 'file' && onOpenRecentFile) {
				onOpenRecentFile(row.data);
			} else if (row.type === 'action' && onQuickAction) {
				onQuickAction(row.data.id);
			}
			onClose();
		},
		[onOpenItem, onOpenRecentFile, onQuickAction, onClose]
	);

	useShellCaptureKeyboard(isOpen, (e) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				e.stopPropagation();
				setSelectedIndex((i) => Math.min(i + 1, maxIndex));
				break;
			case 'ArrowUp':
				e.preventDefault();
				e.stopPropagation();
				setSelectedIndex((i) => Math.max(i - 1, 0));
				break;
			case 'Home':
				e.preventDefault();
				e.stopPropagation();
				setSelectedIndex(0);
				break;
			case 'End':
				e.preventDefault();
				e.stopPropagation();
				setSelectedIndex(maxIndex);
				break;
			case 'Enter':
				e.preventDefault();
				e.stopPropagation();
				{
					const row = flatRowsRef.current[selectedIndexRef.current];
					if (row) activateRow(row);
				}
				break;
		}
	});

	useShellCaptureEscape(isOpen && ctxMenu == null, onClose, {
		onLayer: () => consumeEscapeForSearchClear(query, () => setQuery('')),
	});

	const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key !== 'Tab') return;
		const el = containerRef.current;
		if (!el) return;
		const focusables = el.querySelectorAll<HTMLElement>(
			'input, button, a[href], [tabindex]:not([tabindex="-1"])'
		);
		const arr = Array.from(focusables);
		if (arr.length === 0) return;
		const currentIndex = arr.indexOf(document.activeElement as HTMLElement);
		if (currentIndex === -1) return;
		if (e.shiftKey) {
			if (currentIndex === 0) {
				e.preventDefault();
				arr[arr.length - 1]?.focus();
			}
		} else if (currentIndex === arr.length - 1) {
			e.preventDefault();
			arr[0]?.focus();
		}
	}, []);

	return {
		t,
		query,
		setQuery,
		selectedIndex,
		setSelectedIndex,
		selectedIndexRef,
		results,
		ctxMenu,
		ctxMenuRef,
		inputRef,
		containerRef,
		closeCtxMenu,
		copyLauncherText,
		openAppCtx,
		openFileCtx,
		openActionCtx,
		fileResultsForQuery,
		actionResultsForQuery,
		recentAppsLimited,
		recentDocumentsUnifiedLimited,
		libraryRecentProjectsLimited,
		libraryRecentGeneratedLimited,
		libraryRecentUploadedLimited,
		libraryRecentAddedLimited,
		pinnedItems,
		contentManagerItem,
		flatRows,
		browseSectionStarts,
		activateRow,
		handleContainerKeyDown,
	};
}
