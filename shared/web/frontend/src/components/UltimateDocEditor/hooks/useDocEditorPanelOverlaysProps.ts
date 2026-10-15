/**
 * Сборка пропсов для {@link UltimateDocEditorPanelOverlays} без раздувания JSX оркестратора.
 */

import { useCallback, useMemo } from 'react';

import type { StoreApi } from 'zustand';

import { createFileId } from '@/types/fileExchange';

import type { UltimateDocEditorPanelOverlaysProps } from '../chrome/UltimateDocEditorPanelOverlays';
import type { EditorStore } from '../store/editorStore';
import type {
	UltimateDocument,
	UseDocumentReturn,
} from '../types/editor.types';
import type { DocEditorYjsConnectionStatus } from '../utils/docEditorYjsConnectionStatus';

import type { OverlayKey } from './docEditorPanelKeys';

export interface UseDocEditorPanelOverlaysPropsParams {
	searchPanelOpen: boolean;
	collabPanelOpen: boolean;
	versionsPanelOpen: boolean;
	fileManagerOpen: boolean;
	importPanelOpen: boolean;
	ocrPanelOpen: boolean;
	tableEditorOpen: boolean;
	mathEditorOpen: boolean;
	commentsPanelOpen: boolean;
	templatesPanelOpen: boolean;
	chartsPanelOpen: boolean;
	pdfPanelOpen: boolean;

	currentDocument: UltimateDocument | null;

	activeCollaborators: UltimateDocEditorPanelOverlaysProps['collabCollaborators'];
	collabConnected: boolean;
	collabError: unknown;
	collabYjsConnectionStatus: DocEditorYjsConnectionStatus;
	collaborationEnabledForEditor: boolean;
	isCollabDocumentOwner: boolean;
	collabMySocketId: string | null;
	collabKickParticipant: UltimateDocEditorPanelOverlaysProps['onCollabKickParticipant'];

	embedded: boolean;
	editorStoreApi: StoreApi<EditorStore>;
	loadDocument: UseDocumentReturn['loadDocument'];

	openCollabPanel: () => void;
	setCollabJoinedDocId: (id: string | null) => void;
	collabLeave: () => void | Promise<void>;
	setCollaborationEnabledByUser: (enabled: boolean) => void;

	closePanel: (panel: OverlayKey) => void;

	onSearchSelect: UltimateDocEditorPanelOverlaysProps['onSearchSelect'];
	onFileManagerOpenImport: UltimateDocEditorPanelOverlaysProps['onFileManagerOpenImport'];
	onFileManagerSelectDocument: UltimateDocEditorPanelOverlaysProps['onFileManagerSelectDocument'];
	onImportComplete: UltimateDocEditorPanelOverlaysProps['onImportComplete'];
	onOcrInsertText: UltimateDocEditorPanelOverlaysProps['onOcrInsertText'];
	onInsertTable: UltimateDocEditorPanelOverlaysProps['onInsertTable'];
	onInsertFormula: UltimateDocEditorPanelOverlaysProps['onInsertFormula'];

	commentsCurrentUser: UltimateDocEditorPanelOverlaysProps['commentsCurrentUser'];
	commentsPermissionRole: UltimateDocEditorPanelOverlaysProps['commentsPermissionRole'];
	commentsSelectedText: UltimateDocEditorPanelOverlaysProps['commentsSelectedText'];
	commentsSelectionRange: UltimateDocEditorPanelOverlaysProps['commentsSelectionRange'];
	onCommentsJumpToSelection: UltimateDocEditorPanelOverlaysProps['onCommentsJumpToSelection'];
	onCommentsThreadsChange: UltimateDocEditorPanelOverlaysProps['onCommentsThreadsChange'];
	onCommentsFocusThread: UltimateDocEditorPanelOverlaysProps['onCommentsFocusThread'];
	commentsFocusedThreadId: UltimateDocEditorPanelOverlaysProps['commentsFocusedThreadId'];
	commentsExternalAction: UltimateDocEditorPanelOverlaysProps['commentsExternalAction'];
	onCommentsExternalActionHandled: UltimateDocEditorPanelOverlaysProps['onCommentsExternalActionHandled'];
	setActiveCommentThreadId: (id: string | null) => void;

	onTemplateCreate: UltimateDocEditorPanelOverlaysProps['onTemplateCreate'];
	onInsertChart: UltimateDocEditorPanelOverlaysProps['onInsertChart'];
	onInsertDiagram: UltimateDocEditorPanelOverlaysProps['onInsertDiagram'];
	onInsertPdfHtml: UltimateDocEditorPanelOverlaysProps['onInsertPdfHtml'];
}

export function useDocEditorPanelOverlaysProps(
	params: UseDocEditorPanelOverlaysPropsParams
): UltimateDocEditorPanelOverlaysProps {
	const {
		searchPanelOpen,
		collabPanelOpen,
		versionsPanelOpen,
		fileManagerOpen,
		importPanelOpen,
		ocrPanelOpen,
		tableEditorOpen,
		mathEditorOpen,
		commentsPanelOpen,
		templatesPanelOpen,
		chartsPanelOpen,
		pdfPanelOpen,
		currentDocument,
		activeCollaborators,
		collabConnected,
		collabError,
		collabYjsConnectionStatus,
		collaborationEnabledForEditor,
		isCollabDocumentOwner,
		collabMySocketId,
		collabKickParticipant,
		embedded,
		editorStoreApi,
		loadDocument,
		openCollabPanel,
		setCollabJoinedDocId,
		collabLeave,
		setCollaborationEnabledByUser,
		closePanel,
		onSearchSelect,
		onFileManagerOpenImport,
		onFileManagerSelectDocument,
		onImportComplete,
		onOcrInsertText,
		onInsertTable,
		onInsertFormula,
		commentsCurrentUser,
		commentsPermissionRole,
		commentsSelectedText,
		commentsSelectionRange,
		onCommentsJumpToSelection,
		onCommentsThreadsChange,
		onCommentsFocusThread,
		commentsFocusedThreadId,
		commentsExternalAction,
		onCommentsExternalActionHandled,
		setActiveCommentThreadId,
		onTemplateCreate,
		onInsertChart,
		onInsertDiagram,
		onInsertPdfHtml,
	} = params;

	const onCollabAcceptInvite = useCallback(
		(id: string) => {
			openCollabPanel();
			setCollabJoinedDocId(null);
			void collabLeave();
			setCollaborationEnabledByUser(false);
			const st = editorStoreApi.getState();
			if (embedded && st.documentSource === 'doc_editor') {
				void st.addDocTab(id);
			} else {
				void loadDocument(id);
			}
		},
		[
			openCollabPanel,
			setCollabJoinedDocId,
			collabLeave,
			setCollaborationEnabledByUser,
			editorStoreApi,
			embedded,
			loadDocument,
		]
	);

	const onVersionRestored = useCallback(() => {
		setCollabJoinedDocId(null);
		void collabLeave();
		setCollaborationEnabledByUser(false);
		if (currentDocument?.id) {
			void loadDocument(currentDocument.id);
		}
	}, [
		setCollabJoinedDocId,
		collabLeave,
		setCollaborationEnabledByUser,
		currentDocument?.id,
		loadDocument,
	]);

	const onCloseComments = useCallback(() => {
		setActiveCommentThreadId(null);
		closePanel('comments');
	}, [setActiveCommentThreadId, closePanel]);

	return useMemo(
		(): UltimateDocEditorPanelOverlaysProps => ({
			searchPanelOpen,
			onCloseSearch: () => closePanel('search'),
			onSearchSelect,
			collabPanelOpen,
			onCloseCollab: () => closePanel('collab'),
			collabDocumentId: currentDocument?.id ?? '',
			collabCollaborators: activeCollaborators,
			collabConnected,
			collabError: collabError ? String(collabError) : undefined,
			collabYjsConnectionStatus,
			collabCanSendInvites:
				collaborationEnabledForEditor &&
				collabConnected &&
				isCollabDocumentOwner,
			collabIsDocumentOwner: isCollabDocumentOwner,
			collabMySocketId,
			onCollabKickParticipant: collabKickParticipant,
			onCollabAcceptInvite,
			versionsPanelOpen,
			onCloseVersions: () => closePanel('versions'),
			versionHistoryFileId: currentDocument
				? createFileId(currentDocument.id)
				: null,
			versionHistoryDocumentId: currentDocument?.id,
			onVersionRestored,
			fileManagerOpen,
			onCloseFileManager: () => closePanel('fileManager'),
			onFileManagerOpenImport,
			onFileManagerSelectDocument,
			importPanelOpen,
			onCloseImport: () => closePanel('import'),
			onImportComplete,
			ocrPanelOpen,
			onCloseOcr: () => closePanel('ocr'),
			onOcrInsertText,
			tableEditorOpen,
			onCloseTable: () => closePanel('table'),
			onInsertTable,
			mathEditorOpen,
			onCloseMath: () => closePanel('math'),
			onInsertFormula,
			commentsPanelOpen,
			onCloseComments,
			commentsDocumentId: currentDocument?.id,
			commentsCurrentUser,
			commentsPermissionRole,
			commentsSelectedText,
			commentsSelectionRange,
			onCommentsJumpToSelection,
			onCommentsThreadsChange,
			onCommentsFocusThread,
			commentsFocusedThreadId,
			commentsExternalAction,
			onCommentsExternalActionHandled,
			templatesPanelOpen,
			onCloseTemplates: () => closePanel('templates'),
			onTemplateCreate,
			chartsPanelOpen,
			onCloseCharts: () => closePanel('charts'),
			onInsertChart,
			onInsertDiagram,
			pdfPanelOpen,
			onClosePdf: () => closePanel('pdf'),
			onInsertPdfHtml,
		}),
		[
			searchPanelOpen,
			closePanel,
			onSearchSelect,
			collabPanelOpen,
			activeCollaborators,
			collabConnected,
			collabError,
			collaborationEnabledForEditor,
			isCollabDocumentOwner,
			collabMySocketId,
			collabKickParticipant,
			onCollabAcceptInvite,
			versionsPanelOpen,
			currentDocument,
			onVersionRestored,
			fileManagerOpen,
			onFileManagerOpenImport,
			onFileManagerSelectDocument,
			importPanelOpen,
			onImportComplete,
			ocrPanelOpen,
			onOcrInsertText,
			tableEditorOpen,
			onInsertTable,
			mathEditorOpen,
			onInsertFormula,
			commentsPanelOpen,
			onCloseComments,
			commentsCurrentUser,
			commentsPermissionRole,
			commentsSelectedText,
			commentsSelectionRange,
			onCommentsJumpToSelection,
			onCommentsThreadsChange,
			onCommentsFocusThread,
			commentsFocusedThreadId,
			commentsExternalAction,
			onCommentsExternalActionHandled,
			templatesPanelOpen,
			onTemplateCreate,
			chartsPanelOpen,
			onInsertChart,
			onInsertDiagram,
			pdfPanelOpen,
			onInsertPdfHtml,
			collabYjsConnectionStatus,
		]
	);
}
