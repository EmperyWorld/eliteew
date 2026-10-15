/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * State, effects, and handlers for File Manager list fetch/sort/search/pagination.
 *
 * Invariants:
 * - Server search debounce, client sort, and recent-doc localStorage behavior unchanged.
 * - Idle prefetch of FileLibraryPanel chunk when panel opens.
 *
 * Related:
 * - fileManagerConstants.ts, fileManagerTypes.ts
 * - store/editorStoreSelectors.ts (selectFileManagerPanelSlice)
 */

import { useDebounce } from '@/hooks/useDebounce';
import { useResizeObserverRect } from '@hooks/useResizeObserverRect';
import { notify } from '@/notifications';
import {
	importPaperlessToEliteEditor,
	type PaperlessDocumentItem,
} from '@/services/paperlessApi';
import { createFileId, type FileId } from '@/types/fileExchange';
import { log } from '@/utils/logger';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentFileExchange } from '../../hooks/useDocumentFileExchange';
import { useEditorStoreShallow } from '../../store/editorStoreContext';
import { selectFileManagerPanelSlice } from '../../store/editorStoreSelectors';
import type { UltimateDocument } from '../../types/editor.types';
import {
	DOC_LIST_LIMIT,
	ESTIMATE_ROW_COMPACT_PX,
	ESTIMATE_ROW_PX,
	loadFileLibraryPanel,
	loadPaperlessPickerPanel,
} from './fileManagerConstants';
import type {
	FileManagerPanelProps,
	SortField,
	SortOrder,
} from './fileManagerTypes';

export function useFileManagerPanel({
	isOpen,
	onClose,
	onOpenImport: _onOpenImport,
	onSelectDocument,
}: FileManagerPanelProps) {
	const { t, i18n } = useTranslation('ultimateDocEditor');
	const {
		documents,
		documentsTotal,
		currentDocument,
		isLoading,
		isLoadingMoreDocuments,
		error,
		listDocuments,
		createDocument,
		deleteDocument,
		fileManagerListCompact,
		setFileManagerListCompact,
		openAIPanelWithFileFromList,
	} = useEditorStoreShallow(selectFileManagerPanelSlice);

	const [searchInput, setSearchInput] = useState('');
	const debouncedSearch = useDebounce(searchInput, 320);
	const [sortField, setSortField] = useState<SortField>('updated_at');
	const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
	const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
		null
	);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [recentDocuments, setRecentDocuments] = useState<string[]>([]);
	const [showLibraryPanel, setShowLibraryPanel] = useState(false);
	const [showPaperlessPanel, setShowPaperlessPanel] = useState(false);
	const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
	const [docContextMenu, setDocContextMenu] = useState<{
		x: number;
		y: number;
		doc: UltimateDocument;
	} | null>(null);
	const listScrollRef = useRef<HTMLDivElement>(null);
	const listScrollRect = useResizeObserverRect(listScrollRef, isOpen);
	const listHeight = useMemo(() => {
		const h = listScrollRect.height;
		if (h < 80) {
			return 420;
		}
		return Math.min(560, Math.max(280, Math.round(h)));
	}, [listScrollRect.height]);

	const { loadDocumentById } = useDocumentFileExchange();

	const estimateMainListRowHeight = useCallback(
		(_index: number) =>
			fileManagerListCompact ? ESTIMATE_ROW_COMPACT_PX : ESTIMATE_ROW_PX,
		[fileManagerListCompact]
	);

	const handleAskAiFromRow = useCallback(
		(doc: UltimateDocument) => {
			openAIPanelWithFileFromList(doc);
			onClose();
		},
		[openAIPanelWithFileFromList, onClose]
	);

	/** Тот же динамический import, что у `lazy` — подгрузка в idle при открытии панели. */
	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const ric = window.requestIdleCallback;
		if (typeof ric === 'function') {
			const id = ric(() => {
				void loadFileLibraryPanel();
			});
			return () => window.cancelIdleCallback(id);
		}
		void loadFileLibraryPanel();
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const q = debouncedSearch.trim();
		void listDocuments({
			search: q || undefined,
			skip: 0,
			limit: DOC_LIST_LIMIT,
		});
	}, [isOpen, debouncedSearch, listDocuments]);

	useEffect(() => {
		if (isOpen) {
			setSelectedDocumentIds([]);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			setDocContextMenu(null);
		}
	}, [isOpen]);

	useEffect(() => {
		const recent = localStorage.getItem('doc-recent-documents');
		if (recent) {
			try {
				const parsed = JSON.parse(recent) as string[];
				if (Array.isArray(parsed)) {
					setRecentDocuments(parsed);
				}
			} catch {
				// Ignore parse errors
			}
		}
	}, []);

	const formatRelativeDate = useCallback(
		(dateString: string): string => {
			const date = new Date(dateString);
			const now = new Date();
			const diff = now.getTime() - date.getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));

			if (days === 0) {
				return t('fileManager.dateToday');
			}
			if (days === 1) {
				return t('fileManager.dateYesterday');
			}
			if (days < 7) {
				return t('fileManager.dateDaysAgo', { count: days });
			}
			if (days < 30) {
				return t('fileManager.dateWeeksAgo', { count: Math.floor(days / 7) });
			}
			if (days < 365) {
				return t('fileManager.dateMonthsAgo', { count: Math.floor(days / 30) });
			}
			return date.toLocaleDateString(i18n.language, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			});
		},
		[t, i18n.language]
	);

	const sortedDocuments = useMemo(() => {
		const sorted = [...documents].sort((a, b) => {
			let comparison = 0;
			if (sortField === 'updated_at') {
				comparison =
					new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
			} else if (sortField === 'title') {
				comparison = a.title.localeCompare(b.title, undefined, {
					sensitivity: 'base',
				});
			} else {
				comparison = a.word_count - b.word_count;
			}
			return sortOrder === 'asc' ? comparison : -comparison;
		});
		return sorted;
	}, [documents, sortField, sortOrder]);

	const recentDocs = useMemo(() => {
		return recentDocuments
			.map((id) => documents.find((doc) => doc.id === id))
			.filter((doc): doc is UltimateDocument => doc !== undefined)
			.slice(0, 3);
	}, [recentDocuments, documents]);

	const recentIdSet = useMemo(
		() => new Set(recentDocs.map((d) => d.id)),
		[recentDocs]
	);

	const hasSearch = debouncedSearch.trim().length > 0;

	const mainListDocuments = useMemo(() => {
		if (!hasSearch && recentDocs.length > 0) {
			return sortedDocuments.filter((d) => !recentIdSet.has(d.id));
		}
		return sortedDocuments;
	}, [sortedDocuments, hasSearch, recentDocs.length, recentIdSet]);

	const toggleSort = useCallback(
		(field: SortField): void => {
			if (sortField === field) {
				setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
			} else {
				setSortField(field);
				setSortOrder('desc');
			}
		},
		[sortField, sortOrder]
	);

	const openLibraryPanel = useCallback(() => {
		void loadFileLibraryPanel();
		setShowLibraryPanel(true);
	}, []);

	const openPaperlessPanel = useCallback(() => {
		void loadPaperlessPickerPanel();
		setShowPaperlessPanel(true);
	}, []);

	const closePaperlessPanel = useCallback(() => {
		setShowPaperlessPanel(false);
	}, []);

	const closeLibraryPanel = useCallback(() => {
		setShowLibraryPanel(false);
	}, []);

	const handleCreateNew = useCallback(() => {
		setShowCreateDialog(true);
	}, []);

	const handleCreateDocumentSubmit = async (title: string): Promise<void> => {
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			return;
		}

		try {
			await createDocument(trimmedTitle, t('fileManager.initialDocBody'));
			await listDocuments({ limit: DOC_LIST_LIMIT });
			setShowCreateDialog(false);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			notify.error(t('fileManager.errors.createFailed'), msg);
		}
	};

	const handleLibraryFileSelect = useCallback(
		async (fileId: FileId): Promise<void> => {
			try {
				await loadDocumentById(fileId);
				setShowLibraryPanel(false);
				onClose();
			} catch (err) {
				const detail = err instanceof Error ? err.message : String(err);
				log.error(
					'FileManagerPanel',
					`Failed to load document from library: ${detail}`,
					err instanceof Error ? err : undefined
				);
			}
		},
		[loadDocumentById, onClose]
	);

	const handlePaperlessImport = useCallback(
		async (item: PaperlessDocumentItem): Promise<void> => {
			try {
				const result = await importPaperlessToEliteEditor(item.id);
				const documentId = String(
					result.document_id ?? result.documentId ?? ''
				);
				if (!documentId) {
					throw new Error(t('fileManager.errors.paperlessImportMissingId'));
				}
				await loadDocumentById(createFileId(documentId));
				setShowPaperlessPanel(false);
				onClose();
			} catch (err) {
				const detail = err instanceof Error ? err.message : String(err);
				notify.error(t('fileManager.errors.paperlessImportFailed'), detail);
				throw err;
			}
		},
		[loadDocumentById, onClose, t]
	);

	const handleSelectDocument = useCallback(
		(document: UltimateDocument): void => {
			const newRecent = [
				document.id,
				...recentDocuments.filter((id) => id !== document.id),
			].slice(0, 5);
			setRecentDocuments(newRecent);
			localStorage.setItem('doc-recent-documents', JSON.stringify(newRecent));

			setSelectedDocumentIds((prev) => prev.filter((id) => id !== document.id));
			void onSelectDocument(document);
			onClose();
		},
		[recentDocuments, onSelectDocument, onClose]
	);

	const handleDeleteDocumentById = useCallback(
		async (documentId: string): Promise<void> => {
			try {
				await deleteDocument(documentId);
				setShowDeleteConfirm(null);
				await listDocuments({
					search: debouncedSearch.trim() || undefined,
					limit: DOC_LIST_LIMIT,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				notify.error(t('fileManager.errors.deleteFailed'), msg);
				setShowDeleteConfirm(null);
			}
		},
		[deleteDocument, listDocuments, debouncedSearch, t]
	);

	const toggleDocumentSelection = useCallback((documentId: string): void => {
		setSelectedDocumentIds((prev) =>
			prev.includes(documentId)
				? prev.filter((id) => id !== documentId)
				: [...prev, documentId]
		);
	}, []);

	const handleDeleteClickId = useCallback((id: string) => {
		setShowDeleteConfirm(id);
	}, []);

	const handleDocumentContextMenu = useCallback(
		(e: React.MouseEvent, doc: UltimateDocument) => {
			e.preventDefault();
			e.stopPropagation();
			setDocContextMenu({ x: e.clientX, y: e.clientY, doc });
		},
		[]
	);

	const cancelDeleteConfirm = useCallback(() => {
		setShowDeleteConfirm(null);
	}, []);

	const handleLoadMore = useCallback((): void => {
		void listDocuments({
			search: debouncedSearch.trim() || undefined,
			skip: documents.length,
			limit: DOC_LIST_LIMIT,
			append: true,
		});
	}, [listDocuments, debouncedSearch, documents.length]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				if (docContextMenu) {
					setDocContextMenu(null);
				} else if (showCreateDialog) {
					setShowCreateDialog(false);
				} else if (showDeleteConfirm) {
					setShowDeleteConfirm(null);
				} else {
					onClose();
				}
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, docContextMenu, showCreateDialog, showDeleteConfirm, onClose]);

	const pendingDeleteTitle = useMemo(() => {
		if (!showDeleteConfirm) return '';
		const d = documents.find((x) => x.id === showDeleteConfirm);
		return d?.title?.trim() || t('header.untitled');
	}, [documents, showDeleteConfirm, t]);

	const showLoadMore =
		documents.length < documentsTotal && documentsTotal > 0 && !isLoading;

	return {
		t,
		documents,
		documentsTotal,
		currentDocument,
		isLoading,
		isLoadingMoreDocuments,
		error,
		searchInput,
		setSearchInput,
		sortField,
		sortOrder,
		showDeleteConfirm,
		showCreateDialog,
		setShowCreateDialog,
		showLibraryPanel,
		showPaperlessPanel,
		selectedDocumentIds,
		docContextMenu,
		setDocContextMenu,
		listScrollRef,
		listHeight,
		fileManagerListCompact,
		setFileManagerListCompact,
		openAIPanelWithFileFromList,
		estimateMainListRowHeight,
		formatRelativeDate,
		sortedDocuments,
		recentDocs,
		hasSearch,
		mainListDocuments,
		toggleSort,
		openLibraryPanel,
		openPaperlessPanel,
		closePaperlessPanel,
		closeLibraryPanel,
		handleCreateNew,
		handleCreateDocumentSubmit,
		handleLibraryFileSelect,
		handlePaperlessImport,
		handleSelectDocument,
		handleDeleteDocumentById,
		toggleDocumentSelection,
		handleDeleteClickId,
		handleDocumentContextMenu,
		cancelDeleteConfirm,
		handleLoadMore,
		pendingDeleteTitle,
		handleAskAiFromRow,
		showLoadMore,
	};
}

export type FileManagerPanelViewModel = ReturnType<typeof useFileManagerPanel>;
