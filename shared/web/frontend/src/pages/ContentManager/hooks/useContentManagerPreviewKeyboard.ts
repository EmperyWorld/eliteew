/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns file preview, inline blob preview, grid focus, global keyboard shortcuts, and single-file deletion.
 *
 * Invariants:
 * - Keyboard shortcuts ignore editable fields.
 * - Preview navigation follows the current filtered item order.
 * - Object URLs are revoked whenever inline preview changes or unmounts.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - components/ContentManagerPreviewModal.tsx
 */
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { notify } from '../../../notifications';
import {
	buildContentBlobCacheRevision,
	contentApi,
} from '../../../services/contentApi';
import { requestDesktopFolderLibraryCountsInvalidate } from '../../../services/unifiedContentEvents';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import { collectFolderIdsForLibraryMutation } from '../../Desktop/utils/desktopFolderLibraryCounts';
import type { ContentManagerTab, ViewMode } from '../contentManagerTypes';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';
import { prefetchAdjacentContentPreviews } from '../utils/contentManagerPreviewPrefetch';

export type UseContentManagerPreviewKeyboardOptions = {
	t: TFunction<'contentManager'>;
	activeTab: ContentManagerTab;
	viewMode: ViewMode;
	filteredItems: ContentItem[];
	items: ContentItem[];
	gridFocusIndex: number;
	setGridFocusIndex: React.Dispatch<React.SetStateAction<number>>;
	gridColumnCount: number;
	selectedIds: ReadonlySet<string>;
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	selectMode: boolean;
	requestBatchDelete: () => void;
	setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	rootRef: React.RefObject<HTMLElement | null>;
	setItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
	setTotalItems: React.Dispatch<React.SetStateAction<number>>;
	setError: (message: string | null) => void;
	setSuccess: (message: string | null) => void;
	fetchContent: () => void | Promise<void>;
	fetchManagerActivity: () => void | Promise<void>;
	registerView: (item: ContentItem) => void | Promise<void>;
	clearSelectedDetails?: () => void;
};

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.tagName === 'SELECT' ||
			target.isContentEditable)
	);
}

export function useContentManagerPreviewKeyboard({
	t,
	activeTab,
	viewMode,
	filteredItems,
	items,
	gridFocusIndex,
	setGridFocusIndex,
	gridColumnCount,
	selectedIds,
	setSelectedIds,
	selectMode,
	requestBatchDelete,
	setShowFilters,
	searchInputRef,
	rootRef,
	setItems,
	setTotalItems,
	setError,
	setSuccess,
	fetchContent,
	fetchManagerActivity,
	registerView,
	clearSelectedDetails,
}: UseContentManagerPreviewKeyboardOptions) {
	const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
	const [inlinePreviewId, setInlinePreviewId] = useState<string | null>(null);
	const [inlinePreviewUrl, setInlinePreviewUrl] = useState<string | null>(null);
	const [pendingDeleteFileId, setPendingDeleteFileId] = useState<string | null>(
		null
	);

	const pendingDeleteItem = useMemo(
		() => items.find((item) => item.id === pendingDeleteFileId) ?? null,
		[items, pendingDeleteFileId]
	);
	const pendingDeleteIsSharedOnly = pendingDeleteItem?.is_owner === false;
	const previewItemResolved = useMemo(() => {
		if (!previewItem) return null;
		return items.find((item) => item.id === previewItem.id) ?? previewItem;
	}, [items, previewItem]);
	const inlinePreviewRevision = useMemo(() => {
		if (!inlinePreviewId) return null;
		const item = items.find((candidate) => candidate.id === inlinePreviewId);
		return item ? buildContentBlobCacheRevision(item) : null;
	}, [inlinePreviewId, items]);

	useEffect(() => {
		if (!inlinePreviewId) {
			setInlinePreviewUrl((previousUrl) => {
				if (previousUrl) URL.revokeObjectURL(previousUrl);
				return null;
			});
			return;
		}
		let cancelled = false;
		void contentApi
			.downloadContentBlob(inlinePreviewId, inlinePreviewRevision)
			.then(({ blob }) => {
				if (!cancelled) setInlinePreviewUrl(URL.createObjectURL(blob));
			})
			.catch(() => setInlinePreviewUrl(null));
		return () => {
			cancelled = true;
			setInlinePreviewUrl((previousUrl) => {
				if (previousUrl) URL.revokeObjectURL(previousUrl);
				return null;
			});
		};
	}, [inlinePreviewId, inlinePreviewRevision]);

	const handleToggleInlinePreview = useCallback((id: string) => {
		setInlinePreviewId((current) => (current === id ? null : id));
	}, []);

	const filteredItemsRef = useRef(filteredItems);
	const gridColumnCountRef = useRef(gridColumnCount);
	useEffect(() => {
		filteredItemsRef.current = filteredItems;
		gridColumnCountRef.current = gridColumnCount;
	}, [filteredItems, gridColumnCount]);

	useEffect(() => {
		setGridFocusIndex((index) =>
			filteredItems.length === 0
				? 0
				: Math.min(Math.max(0, index), filteredItems.length - 1)
		);
	}, [filteredItems.length, setGridFocusIndex]);

	useEffect(() => {
		if (selectedIds.size !== 1) return;
		const [id] = Array.from(selectedIds);
		const index = filteredItems.findIndex((item) => item.id === id);
		if (index >= 0) setGridFocusIndex(index);
	}, [filteredItems, selectedIds, setGridFocusIndex]);

	const handleGridArrowNavigate = useCallback(
		(key: string, itemId: string) => {
			const list = filteredItemsRef.current;
			const index = list.findIndex((item) => item.id === itemId);
			if (index < 0) return;
			const columns = Math.max(1, gridColumnCountRef.current);
			let nextIndex = index;
			switch (key) {
				case 'ArrowRight':
					nextIndex = Math.min(list.length - 1, index + 1);
					break;
				case 'ArrowLeft':
					nextIndex = Math.max(0, index - 1);
					break;
				case 'ArrowDown':
					nextIndex = Math.min(list.length - 1, index + columns);
					break;
				case 'ArrowUp':
					nextIndex = Math.max(0, index - columns);
					break;
				case 'Home':
					nextIndex = 0;
					break;
				case 'End':
					nextIndex = list.length - 1;
					break;
				default:
					return;
			}
			if (nextIndex !== index) setGridFocusIndex(nextIndex);
		},
		[setGridFocusIndex]
	);

	const previousGridFocusRef = useRef(gridFocusIndex);
	useLayoutEffect(() => {
		if (
			activeTab !== 'files' ||
			viewMode !== 'grid' ||
			filteredItems.length === 0 ||
			!rootRef.current
		) {
			return;
		}
		const activeElement = document.activeElement;
		if (activeElement === searchInputRef.current) return;
		const soleSelected =
			selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
		const targetId = soleSelected ?? filteredItems[gridFocusIndex]?.id ?? null;
		if (!targetId) return;
		const element = rootRef.current.querySelector(
			`[data-cm-file-id="${CSS.escape(targetId)}"]`
		) as HTMLElement | null;
		if (!element) return;
		const focusInFilesPanel = Boolean(
			activeElement &&
				rootRef.current.contains(activeElement) &&
				activeElement !== searchInputRef.current
		);
		if (soleSelected) {
			element.focus({ preventScroll: true });
			element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
			previousGridFocusRef.current = gridFocusIndex;
			return;
		}
		const focusChanged = previousGridFocusRef.current !== gridFocusIndex;
		previousGridFocusRef.current = gridFocusIndex;
		if (!focusChanged || !focusInFilesPanel) return;
		element.focus({ preventScroll: true });
		element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}, [
		activeTab,
		filteredItems,
		gridFocusIndex,
		rootRef,
		searchInputRef,
		selectedIds,
		viewMode,
	]);

	const requestDeleteFile = useCallback((id: string) => {
		setPendingDeleteFileId(id);
	}, []);

	const executeDeleteFile = useCallback(async () => {
		const id = pendingDeleteFileId;
		if (!id) return;
		try {
			const sharedOnly =
				items.find((item) => item.id === id)?.is_owner === false;
			await contentApi.deleteContent(id);
			setPendingDeleteFileId(null);
			setItems((current) => current.filter((item) => item.id !== id));
			setTotalItems((total) => Math.max(0, total - 1));
			if (previewItem?.id === id || selectedIds.has(id)) {
				setSelectedIds(new Set());
				setPreviewItem(null);
				clearSelectedDetails?.();
			}
			setSuccess(
				t(sharedOnly ? 'pro.toast.removedFromLibrary' : 'pro.toast.deleted')
			);
			setTimeout(() => setSuccess(null), 2000);
			await fetchContent();
			void fetchManagerActivity();
			requestDesktopFolderLibraryCountsInvalidate({
				folderIds: collectFolderIdsForLibraryMutation(items, [id], null),
			});
		} catch (error) {
			const message = getApiErrorMessage(error);
			const hint = getContentRecoveryHint('delete', error, t);
			logUxError(
				'useContentManagerPreviewKeyboard',
				'unified_content',
				'delete',
				error instanceof Error ? error : undefined,
				{ message, hint }
			);
			setError(message);
			notify.error(t('pro.notify.deleteFailed'), `${message}. ${hint}`, {
				duration: 6000,
			});
			throw error instanceof Error ? error : new Error(message);
		}
	}, [
		clearSelectedDetails,
		fetchContent,
		fetchManagerActivity,
		items,
		pendingDeleteFileId,
		previewItem,
		selectedIds,
		setError,
		setItems,
		setSelectedIds,
		setSuccess,
		setTotalItems,
		t,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setPreviewItem(null);
				setShowFilters(false);
				return;
			}
			const editable = isEditableKeyboardTarget(event.target);
			if (
				(event.ctrlKey || event.metaKey) &&
				event.key.toLowerCase() === 'a' &&
				selectMode &&
				activeTab === 'files' &&
				filteredItems.length > 0 &&
				!editable
			) {
				event.preventDefault();
				setSelectedIds(new Set(filteredItems.map((item) => item.id)));
				return;
			}
			if (event.key === 'Delete' && selectMode && selectedIds.size > 0) {
				if (editable) return;
				event.preventDefault();
				requestBatchDelete();
				return;
			}
			if (
				event.key === 'Delete' &&
				!selectMode &&
				activeTab === 'files' &&
				gridFocusIndex >= 0 &&
				filteredItems[gridFocusIndex]?.can_delete !== false &&
				!editable
			) {
				const focusedItem = filteredItems[gridFocusIndex];
				if (!focusedItem) return;
				event.preventDefault();
				requestDeleteFile(focusedItem.id);
				return;
			}
			if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
				event.preventDefault();
				searchInputRef.current?.focus();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [
		activeTab,
		filteredItems,
		gridFocusIndex,
		requestBatchDelete,
		requestDeleteFile,
		searchInputRef,
		selectMode,
		selectedIds.size,
		setSelectedIds,
		setShowFilters,
	]);

	const viewGridFile = useCallback(
		(item: ContentItem) => {
			setPreviewItem(item);
			void registerView(item);
		},
		[registerView]
	);
	const closePreviewModal = useCallback(() => setPreviewItem(null), []);
	const previewNavigationIndex = useMemo(
		() =>
			previewItemResolved
				? filteredItems.findIndex((item) => item.id === previewItemResolved.id)
				: -1,
		[filteredItems, previewItemResolved]
	);
	const previewPreviousItem =
		previewNavigationIndex > 0
			? filteredItems[previewNavigationIndex - 1]
			: null;
	const previewNextItem =
		previewNavigationIndex >= 0 &&
		previewNavigationIndex < filteredItems.length - 1
			? filteredItems[previewNavigationIndex + 1]
			: null;
	const previewPositionLabel =
		previewNavigationIndex >= 0
			? t('pro.preview.position', {
					current: previewNavigationIndex + 1,
					total: filteredItems.length,
				})
			: null;
	const openPreviousPreview = useCallback(() => {
		if (!previewPreviousItem) return;
		setPreviewItem(previewPreviousItem);
		void registerView(previewPreviousItem);
	}, [previewPreviousItem, registerView]);
	const openNextPreview = useCallback(() => {
		if (!previewNextItem) return;
		setPreviewItem(previewNextItem);
		void registerView(previewNextItem);
	}, [previewNextItem, registerView]);

	useEffect(() => {
		prefetchAdjacentContentPreviews(filteredItems, previewItemResolved);
	}, [filteredItems, previewItemResolved]);

	return {
		previewItem,
		setPreviewItem,
		previewItemResolved,
		inlinePreviewId,
		inlinePreviewUrl,
		handleToggleInlinePreview,
		handleGridArrowNavigate,
		viewGridFile,
		closePreviewModal,
		previewPreviousItem,
		previewNextItem,
		previewPositionLabel,
		openPreviousPreview,
		openNextPreview,
		pendingDeleteFileId,
		setPendingDeleteFileId,
		pendingDeleteIsSharedOnly,
		requestDeleteFile,
		executeDeleteFile,
	};
}
