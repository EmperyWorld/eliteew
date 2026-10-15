/**
 * Модальные/оверлейные панели редактора (ленивые импорты + Suspense).
 */

import * as React from 'react';
import { lazy, Suspense } from 'react';
import type { FileId } from '@/types/fileExchange';
import type {
	ChartConfig,
	DiagramConfig,
	DocumentImportResult,
	DocumentTemplatesPanelProps,
	SearchPanelProps,
	UltimateDocument,
	CollaboratorInfo,
	CommentThread,
	ExternalCommentThreadAction,
} from '../types/editor.types';
import type { DocEditorTableData } from '../utils/htmlComparableText';
import type { DocEditorSelectionRange } from '../utils/runtimeDialogEvents';
import { DocEditorLazyPanelFallback } from './DocEditorLazyPanelFallback';

const AdvancedTableEditor = lazy(() =>
	import('../Panels/AdvancedTableEditor').then((m) => ({
		default: m.AdvancedTableEditor,
	}))
);
const ChartsDiagramsPanel = lazy(() =>
	import('../Panels/ChartsDiagramsPanel').then((m) => ({
		default: m.ChartsDiagramsPanel,
	}))
);
const CollaborationPanel = lazy(() =>
	import('../Panels/CollaborationPanel').then((m) => ({
		default: m.CollaborationPanel,
	}))
);
const CommentsReviewPanel = lazy(() =>
	import('../Panels/CommentsReviewPanel').then((m) => ({
		default: m.CommentsReviewPanel,
	}))
);
const DocumentImportPanel = lazy(() =>
	import('../Panels/DocumentImportPanel').then((m) => ({
		default: m.DocumentImportPanel,
	}))
);
const DocumentTemplatesPanel = lazy(() =>
	import('../Panels/DocumentTemplatesPanel').then((m) => ({
		default: m.DocumentTemplatesPanel,
	}))
);
const FileManagerPanel = lazy(() =>
	import('../Panels/FileManagerPanel').then((m) => ({
		default: m.FileManagerPanel,
	}))
);
const MathFormulaEditor = lazy(() =>
	import('../Panels/MathFormulaEditor').then((m) => ({
		default: m.MathFormulaEditor,
	}))
);
const OCRPanel = lazy(() =>
	import('../Panels/OCRPanel').then((m) => ({ default: m.OCRPanel }))
);
const PDFProcessingPanel = lazy(() =>
	import('../Panels/PDFProcessingPanel').then((m) => ({
		default: m.PDFProcessingPanel,
	}))
);
const SearchPanel = lazy(() =>
	import('../Panels/SearchPanel').then((m) => ({ default: m.SearchPanel }))
);
const VersionHistoryPanel = lazy(() =>
	import('../Panels/VersionHistoryPanelV2').then((m) => ({
		default: m.VersionHistoryPanel,
	}))
);

export interface UltimateDocEditorPanelOverlaysProps {
	searchPanelOpen: boolean;
	onCloseSearch: () => void;
	onSearchSelect: SearchPanelProps['onSelectResult'];
	collabPanelOpen: boolean;
	onCloseCollab: () => void;
	collabDocumentId: string;
	collabCollaborators: CollaboratorInfo[];
	collabConnected: boolean;
	collabError: string | undefined;
	collabYjsConnectionStatus: import('../utils/docEditorYjsConnectionStatus').DocEditorYjsConnectionStatus;
	collabCanSendInvites: boolean;
	collabIsDocumentOwner: boolean;
	collabMySocketId: string | null;
	onCollabKickParticipant: (targetSocketId: string) => void;
	onCollabAcceptInvite: (documentId: string) => void;
	versionsPanelOpen: boolean;
	onCloseVersions: () => void;
	versionHistoryFileId: FileId | null;
	versionHistoryDocumentId: string | undefined;
	onVersionRestored: () => void;
	fileManagerOpen: boolean;
	onCloseFileManager: () => void;
	onFileManagerOpenImport: () => void;
	onFileManagerSelectDocument: (
		document: UltimateDocument
	) => void | Promise<void>;
	importPanelOpen: boolean;
	onCloseImport: () => void;
	onImportComplete: (results: DocumentImportResult[]) => void | Promise<void>;
	ocrPanelOpen: boolean;
	onCloseOcr: () => void;
	onOcrInsertText: (text: string) => void;
	tableEditorOpen: boolean;
	onCloseTable: () => void;
	onInsertTable: (tableData: DocEditorTableData) => void;
	mathEditorOpen: boolean;
	onCloseMath: () => void;
	onInsertFormula: (formula: { latex: string }) => void;
	commentsPanelOpen: boolean;
	onCloseComments: () => void;
	commentsDocumentId: string | undefined;
	commentsCurrentUser?: { id: string; name: string; avatar?: string };
	commentsPermissionRole?: 'owner' | 'reviewer' | 'viewer';
	commentsSelectedText: string;
	commentsSelectionRange: DocEditorSelectionRange | null;
	onCommentsJumpToSelection: (
		selection: NonNullable<CommentThread['selection']>
	) => void;
	onCommentsThreadsChange: (threads: CommentThread[]) => void;
	onCommentsFocusThread: (threadId: string | null) => void;
	commentsFocusedThreadId: string | null;
	commentsExternalAction: ExternalCommentThreadAction | null;
	onCommentsExternalActionHandled: (token: number) => void;
	templatesPanelOpen: boolean;
	onCloseTemplates: () => void;
	onTemplateCreate: NonNullable<
		DocumentTemplatesPanelProps['onCreateFromTemplate']
	>;
	chartsPanelOpen: boolean;
	onCloseCharts: () => void;
	onInsertChart: (chartHtml: string, chartConfig: ChartConfig) => void;
	onInsertDiagram: (diagramSvg: string, diagramConfig?: DiagramConfig) => void;
	pdfPanelOpen: boolean;
	onClosePdf: () => void;
	onInsertPdfHtml: (pdfHtml: string) => void;
}

export function UltimateDocEditorPanelOverlays(
	props: UltimateDocEditorPanelOverlaysProps
): React.JSX.Element {
	const {
		searchPanelOpen,
		onCloseSearch,
		onSearchSelect,
		collabPanelOpen,
		onCloseCollab,
		collabDocumentId,
		collabCollaborators,
		collabConnected,
		collabError,
		collabYjsConnectionStatus,
		collabCanSendInvites,
		collabIsDocumentOwner,
		collabMySocketId,
		onCollabKickParticipant,
		onCollabAcceptInvite,
		versionsPanelOpen,
		onCloseVersions,
		versionHistoryFileId,
		versionHistoryDocumentId,
		onVersionRestored,
		fileManagerOpen,
		onCloseFileManager,
		onFileManagerOpenImport,
		onFileManagerSelectDocument,
		importPanelOpen,
		onCloseImport,
		onImportComplete,
		ocrPanelOpen,
		onCloseOcr,
		onOcrInsertText,
		tableEditorOpen,
		onCloseTable,
		onInsertTable,
		mathEditorOpen,
		onCloseMath,
		onInsertFormula,
		commentsPanelOpen,
		onCloseComments,
		commentsDocumentId,
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
		onCloseTemplates,
		onTemplateCreate,
		chartsPanelOpen,
		onCloseCharts,
		onInsertChart,
		onInsertDiagram,
		pdfPanelOpen,
		onClosePdf,
		onInsertPdfHtml,
	} = props;

	return (
		<>
			{searchPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<SearchPanel
						isOpen={searchPanelOpen}
						onClose={onCloseSearch}
						onSelectResult={onSearchSelect}
					/>
				</Suspense>
			)}

			{collabPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<CollaborationPanel
						isOpen={collabPanelOpen}
						onClose={onCloseCollab}
						documentId={collabDocumentId}
						collaborators={collabCollaborators}
						isConnected={collabConnected}
						connectionError={collabError}
						yjsConnectionStatus={collabYjsConnectionStatus}
						canSendInvites={collabCanSendInvites}
						isDocumentOwner={collabIsDocumentOwner}
						mySocketId={collabMySocketId}
						onKickParticipant={onCollabKickParticipant}
						onAcceptInvite={onCollabAcceptInvite}
					/>
				</Suspense>
			)}

			{versionsPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<VersionHistoryPanel
						isOpen={versionsPanelOpen}
						onClose={onCloseVersions}
						fileId={versionHistoryFileId}
						documentId={versionHistoryDocumentId}
						onVersionRestored={onVersionRestored}
					/>
				</Suspense>
			)}

			{fileManagerOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<FileManagerPanel
						isOpen={fileManagerOpen}
						onClose={onCloseFileManager}
						onOpenImport={onFileManagerOpenImport}
						onSelectDocument={onFileManagerSelectDocument}
					/>
				</Suspense>
			)}

			{importPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<DocumentImportPanel
						isOpen={importPanelOpen}
						onClose={onCloseImport}
						onImportComplete={onImportComplete}
					/>
				</Suspense>
			)}

			{ocrPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<OCRPanel
						isOpen={ocrPanelOpen}
						onClose={onCloseOcr}
						onInsertText={onOcrInsertText}
					/>
				</Suspense>
			)}

			{tableEditorOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<AdvancedTableEditor
						isOpen={tableEditorOpen}
						onClose={onCloseTable}
						onInsertTable={onInsertTable}
					/>
				</Suspense>
			)}

			{mathEditorOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<MathFormulaEditor
						isOpen={mathEditorOpen}
						onClose={onCloseMath}
						onInsertFormula={onInsertFormula}
					/>
				</Suspense>
			)}

			{commentsPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<CommentsReviewPanel
						isOpen={commentsPanelOpen}
						onClose={onCloseComments}
						documentId={commentsDocumentId}
						currentUser={commentsCurrentUser}
						permissionRole={commentsPermissionRole}
						selectedText={commentsSelectedText}
						selectionRange={commentsSelectionRange}
						onJumpToSelection={onCommentsJumpToSelection}
						onThreadsChange={onCommentsThreadsChange}
						onFocusThread={onCommentsFocusThread}
						focusedThreadId={commentsFocusedThreadId}
						externalThreadAction={commentsExternalAction}
						onExternalThreadActionHandled={onCommentsExternalActionHandled}
					/>
				</Suspense>
			)}

			{templatesPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<DocumentTemplatesPanel
						isOpen={templatesPanelOpen}
						onClose={onCloseTemplates}
						onCreateFromTemplate={(template, mode) => {
							void onTemplateCreate(template, mode ?? 'replace');
						}}
					/>
				</Suspense>
			)}

			{chartsPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<ChartsDiagramsPanel
						isOpen={chartsPanelOpen}
						onClose={onCloseCharts}
						onInsertChart={onInsertChart}
						onInsertDiagram={onInsertDiagram}
					/>
				</Suspense>
			)}

			{pdfPanelOpen && (
				<Suspense fallback={<DocEditorLazyPanelFallback />}>
					<PDFProcessingPanel
						isOpen={pdfPanelOpen}
						onClose={onClosePdf}
						onInsertProcessedPDF={onInsertPdfHtml}
					/>
				</Suspense>
			)}
		</>
	);
}
