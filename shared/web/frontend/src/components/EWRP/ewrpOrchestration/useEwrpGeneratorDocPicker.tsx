/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP source-document picker modal: CM list load, prefetch, filter memos, virtual rows.
 *
 * Invariants:
 * - Reopen shows cached `docItems` immediately while background refresh runs.
 *
 * Related:
 * - `EwrpDocPickerVirtualRow.tsx`, `EwrpGeneratorModals.tsx`
 */

import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
} from 'react';
import {
	EWRP_VIRTUAL_LIST_THRESHOLD,
	type ContentItem,
	filterEwrpDocItems,
	isEwrpCmTextSource,
	loadEwrpContentManagerItems,
} from '../EwrpGeneratorChunks';
import type { EwrpStatusResponse } from '@/services/ewrpApi';
import { EwrpDocPickerVirtualRow } from './EwrpDocPickerVirtualRow';

export type UseEwrpGeneratorDocPickerParams = {
	t: (key: string, opts?: Record<string, unknown>) => string;
	mainTab: 'generate' | 'presentations';
	status: EwrpStatusResponse | null;
	sourceDocument: ContentItem | null;
	setSourceDocument: React.Dispatch<React.SetStateAction<ContentItem | null>>;
	docItems: ContentItem[];
	setDocItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
	isDocPickerOpen: boolean;
	setIsDocPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
	docPickerLoading: boolean;
	setDocPickerLoading: React.Dispatch<React.SetStateAction<boolean>>;
	docPickerError: string | null;
	setDocPickerError: React.Dispatch<React.SetStateAction<string | null>>;
	docPickerSearch: string;
	setDocPickerSearch: React.Dispatch<React.SetStateAction<string>>;
	docItemsPrefetchLoading: boolean;
	setDocItemsPrefetchLoading: React.Dispatch<React.SetStateAction<boolean>>;
	docPickerSearchInputRef: React.RefObject<HTMLInputElement | null>;
	docPickerModalPanelRef: React.RefObject<HTMLDivElement | null>;
};

export function useEwrpGeneratorDocPicker(
	params: UseEwrpGeneratorDocPickerParams
) {
	const {
		t,
		mainTab,
		status,
		sourceDocument,
		setSourceDocument,
		docItems,
		setDocItems,
		isDocPickerOpen,
		setIsDocPickerOpen,
		docPickerLoading,
		setDocPickerLoading,
		setDocPickerError,
		docPickerSearch,
		setDocPickerSearch,
		setDocItemsPrefetchLoading,
		docPickerSearchInputRef,
	} = params;

	const docItemsPrefetchStartedRef = useRef(false);

	const closeDocPickerModal = useCallback(() => {
		setIsDocPickerOpen(false);
		setDocPickerSearch('');
	}, [setIsDocPickerOpen, setDocPickerSearch]);

	const handlePickDocFromModal = useCallback(
		(item: ContentItem) => {
			setSourceDocument(item);
			setIsDocPickerOpen(false);
			setDocPickerSearch('');
		},
		[setSourceDocument, setIsDocPickerOpen, setDocPickerSearch]
	);

	const openDocPicker = useCallback(() => {
		setIsDocPickerOpen(true);
		setDocPickerSearch('');
		setDocPickerError(null);
		if (docItems.length > 0) {
			void loadEwrpContentManagerItems()
				.then(setDocItems)
				.catch(() => {});
			return;
		}
		setDocPickerLoading(true);
		void (async () => {
			try {
				const items = await loadEwrpContentManagerItems();
				setDocItems(items);
			} catch (err: unknown) {
				setDocPickerError(
					(err as { message?: string })?.message ||
						t('notify.docListLoadFailed')
				);
			} finally {
				setDocPickerLoading(false);
			}
		})();
	}, [
		docItems.length,
		setIsDocPickerOpen,
		setDocPickerSearch,
		setDocPickerError,
		setDocItems,
		setDocPickerLoading,
		t,
	]);

	const retryDocPickerLoad = useCallback(() => {
		setDocPickerError(null);
		setDocPickerLoading(true);
		void (async () => {
			try {
				const items = await loadEwrpContentManagerItems();
				setDocItems(items);
			} catch (err: unknown) {
				setDocPickerError(
					(err as { message?: string })?.message ||
						t('notify.docListLoadFailed')
				);
			} finally {
				setDocPickerLoading(false);
			}
		})();
	}, [setDocPickerError, setDocPickerLoading, setDocItems, t]);

	useEffect(() => {
		if (docItems.length > 0 || docItemsPrefetchStartedRef.current) {
			return;
		}
		const shouldPrefetch =
			mainTab === 'presentations' ||
			Boolean(status?.source_content_id) ||
			Boolean(sourceDocument);
		if (!shouldPrefetch) {
			return;
		}
		docItemsPrefetchStartedRef.current = true;
		setDocItemsPrefetchLoading(true);
		void loadEwrpContentManagerItems()
			.then((items) => {
				setDocItems(items);
			})
			.catch(() => {
				docItemsPrefetchStartedRef.current = false;
			})
			.finally(() => {
				setDocItemsPrefetchLoading(false);
			});
	}, [
		mainTab,
		status?.source_content_id,
		sourceDocument,
		docItems.length,
		setDocItems,
		setDocItemsPrefetchLoading,
	]);

	useEffect(() => {
		if (sourceDocument && !isEwrpCmTextSource(sourceDocument)) {
			setSourceDocument(null);
		}
	}, [sourceDocument, setSourceDocument]);

	useEffect(() => {
		if (!isDocPickerOpen || docPickerLoading) return;
		const timerId = window.setTimeout(() => {
			docPickerSearchInputRef.current?.focus();
		}, 0);
		return () => clearTimeout(timerId);
	}, [isDocPickerOpen, docPickerLoading, docPickerSearchInputRef]);

	const deferredDocSearch = useDeferredValue(docPickerSearch);

	const filteredDocItems = useMemo(
		() => filterEwrpDocItems(docItems, deferredDocSearch),
		[docItems, deferredDocSearch]
	);

	const docPickerListVirtualized =
		filteredDocItems.length >= EWRP_VIRTUAL_LIST_THRESHOLD;

	const docListSummary = useMemo(() => {
		if (docItems.length === 0) {
			return null;
		}
		if (deferredDocSearch.trim()) {
			return t('form.docListCountFiltered', {
				filtered: filteredDocItems.length,
				total: docItems.length,
			});
		}
		return t('form.docListCount', { count: docItems.length });
	}, [docItems.length, filteredDocItems.length, deferredDocSearch, t]);

	const renderDocPickerVirtualItem = useCallback(
		(item: ContentItem) => (
			<EwrpDocPickerVirtualRow
				item={item}
				selected={sourceDocument?.id === item.id}
				onPick={handlePickDocFromModal}
			/>
		),
		[handlePickDocFromModal, sourceDocument?.id]
	);

	return {
		closeDocPickerModal,
		openDocPicker,
		retryDocPickerLoad,
		handlePickDocFromModal,
		deferredDocSearch,
		filteredDocItems,
		docPickerListVirtualized,
		docListSummary,
		renderDocPickerVirtualItem,
	};
}
