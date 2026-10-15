/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Нормализация props окна Doc Editor → `openTarget`, гидратация вкладок, загрузка документа/unified файла и обратная
 * синхронизация payload в состояние окна рабочего стола (embedded/desktop).
 *
 * Invariants:
 * - При активной вкладке **`unifiedContent`** sync вложенных `doc_editor`-табов не вызывает **`switchDocTab`** по legacy id; открытие идёт через **`loadDocumentById`** из `openTarget`.
 *
 * Related:
 * - `desktopOpenPayloads.ts` (`mergeDocEditorPayload`), `UltimateDocEditorInner.tsx`.
 */

import type { StoreApi } from 'zustand';
import type {
	DocEditorActiveTab,
	DocEditorTabTarget,
} from '@/pages/Desktop/types/desktop.types';
import type { FileId } from '@/types/fileExchange';
import { createFileId } from '@/types/fileExchange';
import { emitDesktopFileOpened } from '@/pages/Desktop/hooks/useRecentFiles';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { EditorStore } from '../store/editorStore';
import type {
	UltimateDocEditorProps,
	UltimateDocument,
} from '../types/editor.types';
import { isDocEditorOpenTargetApplied } from '../utils/docEditorOpenTarget';

export type DocEditorSessionOpenTarget = {
	targetType: 'docEditor' | 'unifiedContent';
	id: string;
	requestId?: string;
} | null;

export function computeIncomingPayloadDocIds(params: {
	docEditorTabs?: DocEditorTabTarget[];
	documentIds?: string[];
	documentId?: string;
}): string[] {
	const { docEditorTabs, documentIds, documentId } = params;
	const fromMixed =
		docEditorTabs
			?.filter((tab) => tab.source === 'docEditor')
			.map((tab) => tab.id.trim())
			.filter((id) => id.length > 0) ?? [];
	if (fromMixed.length > 0) {
		return Array.from(new Set(fromMixed));
	}
	const fromLegacy =
		documentIds && documentIds.length > 0
			? documentIds.map((id) => id.trim()).filter((id) => id.length > 0)
			: documentId
				? [documentId.trim()].filter((id) => id.length > 0)
				: [];
	return Array.from(new Set(fromLegacy));
}

export function computeIncomingPayloadActiveDocId(params: {
	activeDocEditorTab?: DocEditorActiveTab;
	activeDocumentIdProp?: string;
}): string | undefined {
	const { activeDocEditorTab, activeDocumentIdProp } = params;
	if (
		activeDocEditorTab?.source === 'docEditor' &&
		activeDocEditorTab.id.trim()
	) {
		return activeDocEditorTab.id.trim();
	}
	const legacyActiveId = activeDocumentIdProp?.trim();
	return legacyActiveId || undefined;
}

export function computeOpenTarget(params: {
	mode: UltimateDocEditorProps['mode'];
	docEditorTabs?: DocEditorTabTarget[];
	activeDocEditorTab?: DocEditorActiveTab;
	unifiedContentId?: string;
	documentIds?: string[];
	documentId?: string;
	activeDocumentIdProp?: string;
	docOpenRequestId?: string;
}): DocEditorSessionOpenTarget {
	const {
		mode,
		docEditorTabs,
		activeDocEditorTab,
		unifiedContentId,
		documentIds,
		documentId,
		activeDocumentIdProp,
		docOpenRequestId,
	} = params;
	if (mode === 'create') return null;
	const mixedActive = activeDocEditorTab?.id.trim()
		? {
				source: activeDocEditorTab.source,
				id: activeDocEditorTab.id.trim(),
			}
		: null;
	const mixedActiveTab = mixedActive
		? docEditorTabs?.find(
				(tab) =>
					tab.source === mixedActive.source && tab.id.trim() === mixedActive.id
			)
		: null;
	const normalizedRequestId =
		docOpenRequestId?.trim() || mixedActiveTab?.requestId?.trim() || undefined;
	if (mixedActive) {
		return {
			targetType:
				mixedActive.source === 'unifiedContent'
					? ('unifiedContent' as const)
					: ('docEditor' as const),
			id: mixedActive.id,
			requestId: normalizedRequestId,
		};
	}
	const unifiedId = unifiedContentId?.trim();
	if (unifiedId && unifiedId.length > 0) {
		return {
			targetType: 'unifiedContent' as const,
			id: unifiedId,
			requestId: normalizedRequestId,
		};
	}
	const ids =
		documentIds && documentIds.length > 0
			? documentIds
			: documentId
				? [documentId]
				: [];
	const active = activeDocumentIdProp ?? ids[0] ?? documentId ?? '';
	const normalized = active.trim();
	if (!normalized) return null;
	return {
		targetType: 'docEditor' as const,
		id: normalized,
		requestId: normalizedRequestId,
	};
}

export interface UseDocEditorOpenTargetSessionParams {
	mode: UltimateDocEditorProps['mode'];
	embedded: boolean;
	documentId?: string;
	documentIds?: string[];
	activeDocumentIdProp?: string;
	tabTitles?: Record<string, string>;
	unifiedContentId?: string;
	docEditorTabs?: DocEditorTabTarget[];
	activeDocEditorTab?: DocEditorActiveTab;
	docOpenRequestId?: string;
	onPayloadChange?: UltimateDocEditorProps['onPayloadChange'];
	editorStoreApi: StoreApi<EditorStore>;
	loadDocumentById: (
		fileId: FileId,
		options?: { requestId?: string }
	) => Promise<void>;
	createDocument: (
		title: string,
		content?: string
	) => Promise<UltimateDocument>;
	updateStats: (html: string) => void;
	clearLoadError: () => void;
	initDocTabsFromWindowPayload: EditorStore['initDocTabsFromWindowPayload'];
	switchDocTab: EditorStore['switchDocTab'];
	collabLeave: () => Promise<void>;
	setCollabJoinedDocId: (id: string | null) => void;
	setCollaborationEnabledByUser: (v: boolean) => void;
	loadError: string | undefined;
	fileExchangeLoadError: string | null | undefined;
	currentDocument: EditorStore['currentDocument'];
	currentFileId: FileId | null;
	documentSource: EditorStore['documentSource'];
	docTabOrder: EditorStore['docTabOrder'];
}

export interface UseDocEditorOpenTargetSessionResult {
	openTarget: DocEditorSessionOpenTarget;
	incomingPayloadDocIds: string[];
	incomingPayloadActiveDocId: string | undefined;
	displayLoadError: string | null | undefined;
	createModeInitializedRef: MutableRefObject<boolean>;
}

export function useDocEditorOpenTargetSession(
	params: UseDocEditorOpenTargetSessionParams
): UseDocEditorOpenTargetSessionResult {
	const {
		mode,
		embedded,
		documentId,
		documentIds,
		activeDocumentIdProp,
		tabTitles: tabTitlesProp,
		unifiedContentId,
		docEditorTabs,
		activeDocEditorTab,
		docOpenRequestId,
		onPayloadChange,
		editorStoreApi,
		loadDocumentById,
		createDocument,
		updateStats,
		clearLoadError,
		initDocTabsFromWindowPayload,
		switchDocTab,
		collabLeave,
		setCollabJoinedDocId,
		setCollaborationEnabledByUser,
		loadError,
		fileExchangeLoadError,
		currentDocument,
		currentFileId,
		documentSource,
		docTabOrder,
	} = params;

	const createModeInitializedRef = useRef(false);
	const docTabsPayloadHydratedRef = useRef(false);
	const lastReportedDesktopSyncKeyRef = useRef<string | null>(null);

	const incomingPayloadDocIds = useMemo(
		() =>
			computeIncomingPayloadDocIds({
				docEditorTabs,
				documentIds,
				documentId,
			}),
		[docEditorTabs, documentIds, documentId]
	);

	const incomingPayloadActiveDocId = useMemo(
		() =>
			computeIncomingPayloadActiveDocId({
				activeDocEditorTab,
				activeDocumentIdProp,
			}),
		[activeDocEditorTab, activeDocumentIdProp]
	);

	const openTarget = useMemo(
		() =>
			computeOpenTarget({
				mode,
				docEditorTabs,
				activeDocEditorTab,
				unifiedContentId,
				documentIds,
				documentId,
				activeDocumentIdProp,
				docOpenRequestId,
			}),
		[
			mode,
			docEditorTabs,
			activeDocEditorTab,
			unifiedContentId,
			documentIds,
			documentId,
			activeDocumentIdProp,
			docOpenRequestId,
		]
	);

	useEffect(() => {
		if (docTabsPayloadHydratedRef.current) return;
		if (mode === 'create') return;
		if (incomingPayloadDocIds.length === 0) return;
		docTabsPayloadHydratedRef.current = true;
		initDocTabsFromWindowPayload({
			documentIds: incomingPayloadDocIds,
			documentId: incomingPayloadDocIds[0],
			activeDocumentId: incomingPayloadActiveDocId,
			tabTitles: tabTitlesProp,
		});
	}, [
		mode,
		incomingPayloadDocIds,
		incomingPayloadActiveDocId,
		tabTitlesProp,
		initDocTabsFromWindowPayload,
	]);

	useEffect(() => {
		if (!embedded || mode === 'create' || incomingPayloadDocIds.length === 0) {
			return;
		}
		const st = editorStoreApi.getState();
		const hasNew = incomingPayloadDocIds.some(
			(id) => !st.docTabOrder.includes(id)
		);
		const activeAlreadySelected =
			incomingPayloadActiveDocId != null &&
			st.currentDocument?.id === incomingPayloadActiveDocId &&
			st.documentSource === 'doc_editor';
		if (!hasNew && activeAlreadySelected) return;
		const merged = [...new Set([...st.docTabOrder, ...incomingPayloadDocIds])];
		editorStoreApi.setState({
			docTabOrder: merged,
			docTabTitles: { ...st.docTabTitles, ...(tabTitlesProp ?? {}) },
		});
		// Unified active tab: open load is driven by openTarget→loadDocumentById. Omitting switchDocTab avoids picking a stray
		// legacy doc_editor id when incomingPayloadActiveDocId is empty (mixed tabs only expose doc_editor ids here).
		if (activeDocEditorTab?.source === 'unifiedContent') {
			return;
		}
		const toOpen =
			incomingPayloadActiveDocId ??
			incomingPayloadDocIds.find((id) => !st.docTabOrder.includes(id));
		if (toOpen) {
			setCollabJoinedDocId(null);
			void collabLeave();
			setCollaborationEnabledByUser(false);
			void switchDocTab(toOpen);
		}
	}, [
		embedded,
		mode,
		activeDocEditorTab,
		incomingPayloadDocIds,
		incomingPayloadActiveDocId,
		tabTitlesProp,
		switchDocTab,
		collabLeave,
		editorStoreApi,
		setCollabJoinedDocId,
		setCollaborationEnabledByUser,
	]);

	useEffect(() => {
		if (mode === 'create') {
			if (createModeInitializedRef.current) {
				return;
			}
			createModeInitializedRef.current = true;
			void createDocument('Новый документ', '<p>Начните писать...</p>');
			updateStats('<p>Начните писать...</p>');
			return;
		}
		createModeInitializedRef.current = false;
		if (!openTarget) return;
		if (openTarget.targetType === 'unifiedContent') {
			clearLoadError();
			void loadDocumentById(createFileId(openTarget.id), {
				requestId: openTarget.requestId,
			});
			return;
		}
		if (embedded) {
			return;
		}
		const ac = new AbortController();
		void editorStoreApi.getState().loadDocument(openTarget.id, {
			signal: ac.signal,
			requestId: openTarget.requestId,
		});
		return () => ac.abort();
	}, [
		openTarget,
		mode,
		updateStats,
		createDocument,
		clearLoadError,
		loadDocumentById,
		embedded,
		editorStoreApi,
	]);

	const displayLoadError =
		loadError ||
		(openTarget?.targetType === 'unifiedContent'
			? fileExchangeLoadError
			: null);

	useEffect(() => {
		if (!currentDocument?.id) {
			return;
		}
		const syncKey = currentFileId
			? `unified:${String(currentFileId)}`
			: currentDocument.id !== 'temp'
				? `doc:${currentDocument.id}:tabs:${docTabOrder.join(':')}`
				: null;
		if (!syncKey) {
			return;
		}
		if (lastReportedDesktopSyncKeyRef.current === syncKey) {
			return;
		}
		lastReportedDesktopSyncKeyRef.current = syncKey;
		emitDesktopFileOpened({
			id: currentDocument.id,
			name: currentDocument.title || 'Без названия',
			type: 'document',
			path: currentFileId
				? `/content/${String(currentFileId)}`
				: `/documents/${currentDocument.id}`,
		});
		if (!embedded || !onPayloadChange) {
			return;
		}
		const openTargetApplied = isDocEditorOpenTargetApplied({
			openTarget:
				openTarget == null
					? null
					: {
							targetType: openTarget.targetType,
							id: openTarget.id,
						},
			currentFileId: currentFileId ? String(currentFileId) : null,
			currentDocumentId: currentDocument.id,
			documentSource,
		});
		if (!openTargetApplied) {
			return;
		}
		const st = editorStoreApi.getState();
		const mixedTabsFromPayload =
			docEditorTabs
				?.filter(
					(tab) =>
						tab.source === 'unifiedContent' &&
						tab.id.trim() &&
						!st.docTabOrder.includes(tab.id.trim())
				)
				.map((tab) => ({
					source: tab.source,
					id: tab.id.trim(),
					...(tab.title ? { title: tab.title } : {}),
					...(tab.requestId ? { requestId: tab.requestId } : {}),
				})) ?? [];
		const docTabs = st.docTabOrder
			.filter((id) => id.trim().length > 0)
			.map((id) => ({
				source: 'docEditor' as const,
				id,
				...(st.docTabTitles[id] ? { title: st.docTabTitles[id] } : {}),
			}));
		if (currentFileId) {
			const unifiedTitle = currentDocument?.title?.trim();
			const activeUnifiedTab = {
				source: 'unifiedContent' as const,
				id: String(currentFileId),
				...(unifiedTitle ? { title: unifiedTitle } : {}),
				...(openTarget?.requestId ? { requestId: openTarget.requestId } : {}),
			};
			const mixedTabs = [
				...docTabs,
				...mixedTabsFromPayload,
				...(!mixedTabsFromPayload.some(
					(tab) =>
						tab.source === activeUnifiedTab.source &&
						tab.id === activeUnifiedTab.id
				)
					? [activeUnifiedTab]
					: []),
			];
			const surfaceLabel =
				unifiedTitle || currentDocument?.title?.trim() || 'Без названия';
			onPayloadChange({
				unifiedContentId: String(currentFileId),
				documentId: undefined,
				documentIds:
					docTabs.length > 0 ? docTabs.map((tab) => tab.id) : undefined,
				activeDocumentId: undefined,
				tabTitles: st.docTabTitles,
				docEditorTabs: mixedTabs,
				activeDocEditorTab: {
					source: 'unifiedContent',
					id: String(currentFileId),
				},
				assistantSurfaceContext: {
					label: surfaceLabel,
					unifiedContentIds: [String(currentFileId)],
				},
				...(openTarget?.requestId
					? { docOpenRequestId: openTarget.requestId }
					: {}),
			});
			return;
		}
		if (currentDocument.id !== 'temp') {
			const active =
				st.currentDocument?.id && st.currentDocument.id !== 'temp'
					? st.currentDocument.id
					: undefined;
			const mixedTabs = [...docTabs, ...mixedTabsFromPayload];
			if (
				active &&
				!mixedTabs.some(
					(tab) => tab.source === 'docEditor' && tab.id === active
				)
			) {
				mixedTabs.push({
					source: 'docEditor',
					id: active,
					...(st.docTabTitles[active]
						? { title: st.docTabTitles[active] }
						: {}),
				});
			}
			const docSurfaceLabel =
				(active ? st.docTabTitles[active]?.trim() : '') ||
				currentDocument.title?.trim() ||
				'Без названия';
			onPayloadChange({
				documentId: currentDocument.id,
				unifiedContentId: undefined,
				documentIds:
					st.docTabOrder.length > 0
						? st.docTabOrder
						: active
							? [active]
							: undefined,
				activeDocumentId: active,
				tabTitles: st.docTabTitles,
				docEditorTabs: mixedTabs,
				activeDocEditorTab: active
					? { source: 'docEditor', id: active }
					: undefined,
				assistantSurfaceContext: {
					label: docSurfaceLabel,
				},
				...(openTarget?.requestId
					? { docOpenRequestId: openTarget.requestId }
					: {}),
			});
		}
	}, [
		currentDocument,
		embedded,
		onPayloadChange,
		currentFileId,
		docTabOrder,
		openTarget,
		documentSource,
		docEditorTabs,
		editorStoreApi,
	]);

	return {
		openTarget,
		incomingPayloadDocIds,
		incomingPayloadActiveDocId,
		displayLoadError,
		createModeInitializedRef,
	};
}
