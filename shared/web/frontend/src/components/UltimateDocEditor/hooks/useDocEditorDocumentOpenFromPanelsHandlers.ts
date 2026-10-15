/**
 * Открытие документа из панелей: импорт, поиск, file manager (в т.ч. новое окно).
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import { requestOpenDocEditor } from '@/pages/Desktop/utils/desktopDeepLink';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import type { StoreApi } from 'zustand';

import type { DocEditorDestructiveConfirmPayload } from './useDocEditorDestructiveConfirm';
import type { EditorStore } from '../store/editorStore';
import type {
	DocumentImportResult,
	UltimateDocEditorProps,
} from '../types/editor.types';

export type DocEditorPanelsDocumentPick = {
	id?: string;
	title?: string;
};

export interface UseDocEditorDocumentOpenFromPanelsHandlersParams {
	editorStoreApi: StoreApi<EditorStore>;
	embedded: boolean;
	loadDocument: (id: string) => Promise<unknown>;
	onPayloadChange?: UltimateDocEditorProps['onPayloadChange'];
	docOpenRequestId: string | undefined;
	setImportPanelOpen: Dispatch<SetStateAction<boolean>>;
	setFileManagerOpen: Dispatch<SetStateAction<boolean>>;
	closeSearchPanel: () => void;

	collaborationEnabledForEditor: boolean;
	flushPendingEditorHtmlToStore: () => void;
	disconnectCollabSession: () => void;
	requestDestructiveConfirm: (
		payload: DocEditorDestructiveConfirmPayload
	) => Promise<boolean>;
}

export interface UseDocEditorDocumentOpenFromPanelsHandlersResult {
	handleOpenImportFromFileManager: () => void;
	handleImportComplete: (
		results: DocumentImportResult[]
	) => void | Promise<void>;
	handleDocumentSelect: (
		document: DocEditorPanelsDocumentPick
	) => void | Promise<void>;
	handleFileManagerDocumentSelect: (
		document: DocEditorPanelsDocumentPick
	) => void | Promise<void>;
}

export function useDocEditorDocumentOpenFromPanelsHandlers(
	params: UseDocEditorDocumentOpenFromPanelsHandlersParams
): UseDocEditorDocumentOpenFromPanelsHandlersResult {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const {
		editorStoreApi,
		embedded,
		loadDocument,
		onPayloadChange,
		docOpenRequestId,
		setImportPanelOpen,
		setFileManagerOpen,
		closeSearchPanel,
		collaborationEnabledForEditor,
		flushPendingEditorHtmlToStore,
		disconnectCollabSession,
		requestDestructiveConfirm,
	} = params;

	const handleOpenImportFromFileManager = useCallback(() => {
		setFileManagerOpen(false);
		setImportPanelOpen(true);
	}, [setFileManagerOpen, setImportPanelOpen]);

	const handleImportComplete = useCallback(
		async (results: DocumentImportResult[]): Promise<void> => {
			const importedDocuments = results
				.filter((result) => result.success && result.document?.id)
				.map((result) => result.document);

			if (importedDocuments.length === 1 && importedDocuments[0]?.id) {
				const id = importedDocuments[0].id;
				if (collaborationEnabledForEditor) {
					const ok = await requestDestructiveConfirm({
						title: t('destructiveConfirm.openOtherDocCollabTitle'),
						message: t('destructiveConfirm.openOtherDocCollabMessage'),
						confirmLabel: t('destructiveConfirm.continue'),
						cancelLabel: t('destructiveConfirm.cancel'),
						variant: 'warning',
					});
					if (!ok) return;
				}
				flushPendingEditorHtmlToStore();
				disconnectCollabSession();
				const st = editorStoreApi.getState();
				if (embedded && st.documentSource === 'doc_editor') {
					void st.addDocTab(id);
					st.setDocTabTitle(id, importedDocuments[0].title ?? '');
				} else {
					void loadDocument(id);
				}
				onPayloadChange?.({
					documentId: id,
					unifiedContentId: undefined,
					docEditorTabs: [{ source: 'docEditor', id }],
					activeDocEditorTab: { source: 'docEditor', id },
					...(docOpenRequestId?.trim()
						? { docOpenRequestId: docOpenRequestId.trim() }
						: {}),
				});
				setImportPanelOpen(false);
			}
		},
		[
			loadDocument,
			onPayloadChange,
			embedded,
			docOpenRequestId,
			editorStoreApi.getState,
			setImportPanelOpen,
			collaborationEnabledForEditor,
			requestDestructiveConfirm,
			t,
			flushPendingEditorHtmlToStore,
			disconnectCollabSession,
		]
	);

	const handleDocumentSelect = useCallback(
		async (document: DocEditorPanelsDocumentPick): Promise<void> => {
			if (!document.id) {
				closeSearchPanel();
				return;
			}
			if (collaborationEnabledForEditor) {
				const ok = await requestDestructiveConfirm({
					title: t('destructiveConfirm.openOtherDocCollabTitle'),
					message: t('destructiveConfirm.openOtherDocCollabMessage'),
					confirmLabel: t('destructiveConfirm.continue'),
					cancelLabel: t('destructiveConfirm.cancel'),
					variant: 'warning',
				});
				if (!ok) {
					closeSearchPanel();
					return;
				}
			}
			flushPendingEditorHtmlToStore();
			disconnectCollabSession();
			const st = editorStoreApi.getState();
			if (embedded && st.documentSource === 'doc_editor') {
				if (st.docTabOrder.includes(document.id)) {
					void st.switchDocTab(document.id);
				} else {
					void st.addDocTab(document.id);
				}
				if (document.title) {
					st.setDocTabTitle(document.id, document.title);
				}
			} else {
				void st.loadDocument(document.id, {
					requestId: docOpenRequestId?.trim() || undefined,
				});
			}
			onPayloadChange?.({
				documentId: document.id,
				unifiedContentId: undefined,
				docEditorTabs: [{ source: 'docEditor', id: document.id }],
				activeDocEditorTab: { source: 'docEditor', id: document.id },
				...(docOpenRequestId?.trim()
					? { docOpenRequestId: docOpenRequestId.trim() }
					: {}),
			});
			closeSearchPanel();
		},
		[
			closeSearchPanel,
			onPayloadChange,
			embedded,
			flushPendingEditorHtmlToStore,
			disconnectCollabSession,
			collaborationEnabledForEditor,
			docOpenRequestId,
			editorStoreApi.getState,
			requestDestructiveConfirm,
			t,
		]
	);

	const handleFileManagerDocumentSelect = useCallback(
		(document: DocEditorPanelsDocumentPick): void | Promise<void> => {
			if (!document.id) {
				return handleDocumentSelect(document);
			}
			const st = editorStoreApi.getState();
			if (embedded && st.documentSource === 'doc_editor') {
				requestOpenDocEditor({
					targetType: 'docEditor',
					id: document.id,
					forceNewWindow: true,
					...(docOpenRequestId?.trim()
						? { requestId: docOpenRequestId.trim() }
						: {}),
				});
				closeSearchPanel();
				return;
			}
			return handleDocumentSelect(document);
		},
		[
			closeSearchPanel,
			docOpenRequestId,
			embedded,
			handleDocumentSelect,
			editorStoreApi.getState,
		]
	);

	return {
		handleOpenImportFromFileManager,
		handleImportComplete,
		handleDocumentSelect,
		handleFileManagerDocumentSelect,
	};
}
