/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bootstrap-stage compose for UltimateDocEditorInner — store, shell, panels, export,
 * drag-drop, comments, collab session, persist capability, open-target, and TipTap content sync.
 *
 * Invariants:
 * - No new stores; wiring only. Collab join and open-target session contracts unchanged.
 *
 * Related:
 * - useUltimateDocEditorInnerCompose.ts, useUltimateDocEditorInnerContentCompose.ts
 */

import type { Editor } from '@tiptap/react';
import { useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/namespaces';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { createFileId } from '../../../types/fileExchange';
import { useDocument } from './useDocument';
import { useDocEditorCollaborationSession } from './useDocEditorCollaborationSession';
import { useDocEditorDestructiveConfirm } from './useDocEditorDestructiveConfirm';
import { useDocEditorEarlyBootstrapEffects } from './useDocEditorEarlyBootstrapEffects';
import {
	type DocEditorCloseAllOverlays,
	useDocEditorExport,
} from './useDocEditorExport';
import { useDocEditorOpenTargetSession } from './useDocEditorOpenTargetSession';
import { useDocEditorPanels } from './useDocEditorPanels';
import { useDocEditorPersistCapabilityRefs } from './useDocEditorPersistCapabilityRefs';
import { useDocEditorPreviewScrollSync } from './useDocEditorPreviewScrollSync';
import { useDocEditorShellPresentation } from './useDocEditorShellPresentation';
import { useDocEditorTipTapContentSync } from './useDocEditorTipTapContentSync';
import type { DocEditorYjsConnectionStatus } from '../utils/docEditorYjsConnectionStatus';
import { resolveDocEditorDocumentSyncKey } from '../utils/docEditorInitialContentSync';
import { useDocEditorCloseDocGuideOnMount } from './useDocEditorCloseDocGuideOnMount';
import { useDocEditorDragDrop } from './useDocEditorDragDrop';
import { useDocEditorCommentsSession } from './useDocEditorCommentsSession';
import { useDocumentFileExchange } from './useDocumentFileExchange';
import {
	useEditorStoreApi,
	useEditorStoreShallow,
} from '../store/editorStoreContext';
import {
	selectDocEditorInnerActionsSlice,
	selectDocEditorInnerDocumentSlice,
	selectDocEditorInnerPanelSlice,
} from '../store/editorStoreSelectors';
import { buildDocEditorOracleSnapshot } from '../utils/docEditorOracleSnapshot';
import { normalizeContentToHtml } from '../utils/htmlComparableText';
import { normalizeDocumentContentForEditor } from '../utils/ultimateDocEditorBootstrap';
import type { DocEditorSelectionRange } from '../utils/runtimeDialogEvents';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { useOptionalDesktopShellSettingsBridge } from '../../../pages/Desktop/context/DesktopShellSettingsBridgeContext';
import { useDesktopShellFrame } from '../../../pages/Desktop/context/DesktopShellFrameContext';
import {
	useDocEditorInWindowStackZIndex,
	useDocEditorToolbarPortalPopoverZIndex,
	useEmbeddedPortaledModalZIndex,
} from '../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import { clampDesktopUiScale } from '../../../pages/Desktop/utils/desktopUiScale';
import { useNotifications } from '@/notifications';
import {
	canPersistCanonicalDocument,
	type UltimateDocEditorProps,
} from '../types/editor.types';
import type { PendingDocInsert } from '../types/pendingDocInsert';

export function useUltimateDocEditorInnerBootstrapCompose(
	props: UltimateDocEditorProps
) {
	const {
		documentId,
		documentIds,
		activeDocumentId: activeDocumentIdProp,
		tabTitles: tabTitlesProp,
		unifiedContentId,
		docEditorTabs,
		activeDocEditorTab,
		docOpenRequestId,
		mode = 'edit',
		onSave,
		onClose,
		embedded = false,
		onPayloadChange,
		openCollabAfterLoad = false,
		autoJoinCollaborationAfterLoad = false,
	} = props;

	const editorStoreApi = useEditorStoreApi();
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const {
		requestDestructiveConfirm,
		destructiveConfirmOpen,
		destructiveConfirmPayload,
		resolveDestructiveConfirm,
	} = useDocEditorDestructiveConfirm();
	const reduceMotion = useReducedMotion();
	const mainGridLabels = useMemo(
		() => ({
			loadLoadingTitle: t('shell.load.loadingTitle'),
			loadLoadingDesc: t('shell.load.loadingDesc'),
			loadFailedTitle: t('shell.load.failedTitle'),
			loadRetry: t('shell.load.retry'),
			loadingEditorTitle: t('loadingEditorTitle'),
			loadingEditorExtensions: t('loadingEditorExtensions'),
			previewEscToClose: t('shell.preview.escToClose'),
			markdownRibbonTitle: t('mainGrid.markdownRibbonTitle'),
			markdownRibbonHint: t('mainGrid.markdownRibbonHint'),
			markdownStatusEdited: t('mainGrid.markdownStatusEdited'),
			markdownStatusClean: t('mainGrid.markdownStatusClean'),
			markdownFieldLabel: t('mainGrid.markdownFieldLabel'),
			markdownPlaceholder: t('mainGrid.markdownPlaceholder'),
			markdownTextareaAria: t('mainGrid.markdownTextareaAria'),
			scrollToTop: t('mainGrid.scrollToTop'),
			scrollToBottom: t('mainGrid.scrollToBottom'),
			previewTitleMarkdown: t('mainGrid.previewTitleMarkdown'),
			previewTitleDocument: t('mainGrid.previewTitleDocument'),
			previewHintMarkdown: t('mainGrid.previewHintMarkdown'),
			previewHintDocument: t('mainGrid.previewHintDocument'),
			eastPanelLoadingTitle: t('mainGrid.eastPanelLoadingTitle'),
			eastPanelLoadingDesc: t('mainGrid.eastPanelLoadingDesc'),
		}),
		[t]
	);
	const {
		currentDocument,
		isDirty,
		isSaving,
		isLoadingDocument,
		error: loadError,
		lastSaved,
		selectedText,
		documentSource,
		docTabOrder,
		docTabTitles,
		docTabSessions,
	} = useEditorStoreShallow(selectDocEditorInnerDocumentSlice);

	const {
		aiPanelOpen,
		aiFileManagerContext,
		imageGenPanelOpen,
		collabPanelOpen,
		activeCollaborators,
		searchPanelOpen,
		versionsPanelOpen,
	} = useEditorStoreShallow(selectDocEditorInnerPanelSlice);

	const {
		openAIPanel,
		closeAIPanel,
		clearAiFileManagerContext,
		openImageGenPanel,
		closeImageGenPanel,
		openCollabPanel,
		closeCollabPanel,
		openSearchPanel,
		closeSearchPanel,
		openVersionsPanel,
		closeVersionsPanel,
		setSelectedText,
		updateDocument,
		switchDocTab,
		removeDocTab,
		initDocTabsFromWindowPayload,
	} = useEditorStoreShallow(selectDocEditorInnerActionsSlice);

	const { error: notifyError, success: notifySuccess } = useNotifications();

	const collabOpenedFromPayloadRef = useRef(false);

	const persistedOnServer = Boolean(
		currentDocument?.id && currentDocument.id !== 'temp'
	);

	const { user } = useAuth();
	const shellTheme = useDesktopShellTheme();
	const shellFrame = useDesktopShellFrame();
	const docInWindowZ = useDocEditorInWindowStackZIndex();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const exportMenuPortalZ = useDocEditorToolbarPortalPopoverZIndex();
	const optionalShellBridge = useOptionalDesktopShellSettingsBridge();
	const desktopUiScaleForEditor = useMemo(
		() => clampDesktopUiScale(optionalShellBridge?.desktopUiScale ?? 1),
		[optionalShellBridge?.desktopUiScale]
	);
	const {
		shellFramePreset,
		docToolbarClusterClass,
		docHeaderMetaStripClass,
		docHeaderToolbarVSepClass,
		metricBadgeDefaultSurface,
		docScrollFabClass,
		docMarkdownTextareaClass,
		embeddedEastColumnClass,
		docGuideCardClass,
		memoryWarningSurfaceClass,
		docPreviewProseClassName,
	} = useDocEditorShellPresentation(shellFrame, shellTheme);
	const { loadDocument, createDocument } = useDocument();
	const {
		currentFileId,
		currentContent,
		saveCurrentDocument,
		loadDocumentById,
		error: fileExchangeLoadError,
		clearLoadError,
	} = useDocumentFileExchange();
	const hasLoadFailure = Boolean(loadError || fileExchangeLoadError);
	useDocEditorEarlyBootstrapEffects({
		openCollabAfterLoad,
		collabOpenedFromPayloadRef,
		hasLoadFailure,
		isLoadingDocument,
		currentDocumentId: currentDocument?.id,
		documentId,
		openCollabPanel,
	});
	const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);
	const [editorSelectionRange, setEditorSelectionRange] =
		useState<DocEditorSelectionRange | null>(null);
	const [previewMode, setPreviewMode] = useState(false);
	const [showGuide, setShowGuide] = useState(false);
	const [docGuideOpen, setDocGuideOpen] = useState(false);
	/** Восточная колонка: AI или генерация изображений (взаимоисключение в store). */
	const eastDocPanelOpen = aiPanelOpen || imageGenPanelOpen;
	useDocEditorCloseDocGuideOnMount(setDocGuideOpen);
	const openDocGuideTour = useCallback(() => {
		setDocGuideOpen(true);
	}, []);
	useDesktopGuideTourOpener(openDocGuideTour);
	const closeAllOverlaysForExportRef = useRef<DocEditorCloseAllOverlays | null>(
		null
	);
	const {
		exportMenuOpen,
		setExportMenuOpen,
		exportMenuPosition,
		exportMenuRef,
		exportButtonRef,
		handleExportToggle,
		handleExport,
	} = useDocEditorExport({
		closeAllOverlaysRef: closeAllOverlaysForExportRef,
		editorStoreApi,
		currentDocument,
		tiptapEditor,
	});
	const [liveStats, setLiveStats] = useState({ words: 0, characters: 0 });
	const applyOracleStatsToHeader = useCallback(
		(stats: { words: number; characters: number }) => {
			setLiveStats(stats);
		},
		[]
	);
	const programmaticUpdateRef = useRef(false);
	const [toolbarCloseTick, setToolbarCloseTick] = useState(0);
	const {
		fileManagerOpen,
		setFileManagerOpen,
		importPanelOpen,
		setImportPanelOpen,
		ocrPanelOpen,
		tableEditorOpen,
		mathEditorOpen,
		commentsPanelOpen,
		setCommentsPanelOpen,
		templatesPanelOpen,
		chartsPanelOpen,
		pdfPanelOpen,
		getPanelOpenState,
		closePanel,
		closeAllOverlays,
		showPanel,
		togglePanel,
		panelOpenForSidebar,
		anyDocOverlayOpen,
	} = useDocEditorPanels({
		store: {
			aiPanelOpen,
			openAIPanel,
			closeAIPanel,
			imageGenPanelOpen,
			openImageGenPanel,
			closeImageGenPanel,
			collabPanelOpen,
			openCollabPanel,
			closeCollabPanel,
			searchPanelOpen,
			openSearchPanel,
			closeSearchPanel,
			versionsPanelOpen,
			openVersionsPanel,
			closeVersionsPanel,
		},
		exportMenuOpen,
		setExportMenuOpen,
		setToolbarCloseTick,
	});
	closeAllOverlaysForExportRef.current = closeAllOverlays;

	const {
		isDragOver,
		memoryWarning,
		dismissMemoryWarning,
		handleDragOver,
		handleDragLeave,
		handleDrop,
	} = useDocEditorDragDrop({
		tiptapEditor,
		showPanel,
	});

	const {
		commentJumpFlashToken,
		activeCommentThreadId,
		setActiveCommentThreadId,
		setCommentThreads,
		externalThreadAction,
		handleJumpToCommentSelection,
		openThreadById,
		handleCommentAnchorAction,
		handleExternalThreadActionHandled,
		commentAnchorRanges,
		commentAnchorMeta,
		resetCommentsSession,
	} = useDocEditorCommentsSession({
		tiptapEditor,
		setSelectedText,
		setEditorSelectionRange,
		setCommentsPanelOpen,
	});

	const {
		collabConnected,
		collabError,
		collabJoin,
		collabLeave,
		collabUpdateCursor,
		collabKickParticipant,
		collabMySocketId,
		collaborationEnabledByUser,
		setCollaborationEnabledByUser,
		setCollabJoinedDocId,
		collaborationEnabledForEditor,
		isCollabDocumentOwner,
		collaborationEnabledForEditorRef,
		collabYjsBootstrapRef,
		handleCollaborationYjsFailed,
		autoJoinCollabFromInviteRef,
	} = useDocEditorCollaborationSession({
		notifySuccess,
		currentDocument,
		user: user && typeof user.id === 'string' ? { id: user.id } : undefined,
	});

	const [yjsConnectionStatus, setYjsConnectionStatus] =
		useState<DocEditorYjsConnectionStatus>('idle');
	const handleYjsConnectionStatusChange = useCallback(
		(status: DocEditorYjsConnectionStatus) => {
			setYjsConnectionStatus(status);
		},
		[]
	);

	const isCollabDocumentOwnerRef = useRef(isCollabDocumentOwner);
	useEffect(() => {
		isCollabDocumentOwnerRef.current = isCollabDocumentOwner;
	}, [isCollabDocumentOwner]);

	const canPersistCanonical = useMemo(
		() => canPersistCanonicalDocument(currentDocument),
		[currentDocument]
	);
	const payloadWantsUnifiedContent = useMemo(() => {
		if (
			activeDocEditorTab?.source === 'unifiedContent' &&
			activeDocEditorTab.id.trim().length > 0
		) {
			return true;
		}
		return Boolean(unifiedContentId?.trim());
	}, [activeDocEditorTab, unifiedContentId]);
	const canPersistUnifiedContent = useMemo(
		() => (currentFileId ? currentContent?.canEdit !== false : true),
		[currentFileId, currentContent?.canEdit]
	);
	const {
		canPersistCanonicalRef,
		canPersistUnifiedContentRef,
		payloadWantsUnifiedContentRef,
	} = useDocEditorPersistCapabilityRefs({
		canPersistCanonical,
		canPersistUnifiedContent,
		payloadWantsUnifiedContent,
	});
	const currentFileIdRef = useRef<typeof currentFileId>(null);
	const saveCurrentDocumentRef = useRef(saveCurrentDocument);
	saveCurrentDocumentRef.current = saveCurrentDocument;
	currentFileIdRef.current = currentFileId;
	const lastSelectionRef = useRef<{
		text: string;
		from: number | null;
		to: number | null;
	}>({
		text: '',
		from: null,
		to: null,
	});
	const lastCollabCursorRef = useRef<{
		line: number;
		column: number;
		sentAt: number;
	} | null>(null);

	const editorScrollContainerRef = useRef<HTMLDivElement | null>(null);
	const { previewScrollRef } = useDocEditorPreviewScrollSync({
		previewMode,
		setPreviewMode,
		editorScrollContainerRef,
	});
	const pendingDocInsertRef = useRef<PendingDocInsert | null>(null);
	/** Sync-boundary oracle commit (load, template, draft) — not typing path. */
	const updateStats = useCallback(
		(html: string) => {
			const snapshot = buildDocEditorOracleSnapshot(
				normalizeContentToHtml(html)
			);
			editorStoreApi.getState().commitAnalyticalSnapshot(snapshot);
			setLiveStats({
				words: snapshot.words,
				characters: snapshot.characters,
			});
		},
		[editorStoreApi]
	);

	const { openTarget, displayLoadError } = useDocEditorOpenTargetSession({
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
	});

	const handleRetryLoadAfterGridError = useCallback(() => {
		if (!openTarget) return;
		if (openTarget.targetType === 'unifiedContent') {
			clearLoadError();
			void loadDocumentById(createFileId(openTarget.id), {
				requestId: openTarget.requestId,
			});
			return;
		}
		void editorStoreApi.getState().loadDocument(openTarget.id, {
			requestId: openTarget.requestId,
		});
	}, [openTarget, clearLoadError, loadDocumentById, editorStoreApi]);

	const baseContent = useMemo((): string => {
		const fromDoc = currentDocument?.content;
		const fromContent = currentContent?.html;
		// После любого редактирования источник правды — store; иначе при открытом файле
		// editorInitialContent остаётся равным props (currentContent.html), эффект sync
		// видит расхождение с TipTap и перезаписывает документ — пропадают вставки из панелей.
		if (isDirty && typeof fromDoc === 'string') {
			return fromDoc;
		}
		if (currentFileId && typeof fromContent === 'string' && fromContent !== '')
			return fromContent;
		if (typeof fromDoc === 'string') return fromDoc;
		if (typeof fromContent === 'string' && fromContent !== '')
			return fromContent;
		return '';
	}, [currentDocument?.content, currentContent?.html, currentFileId, isDirty]);
	const documentSyncKey = useMemo(
		() =>
			resolveDocEditorDocumentSyncKey(
				documentId,
				currentDocument?.id,
				currentFileId
			),
		[documentId, currentDocument?.id, currentFileId]
	);
	const editorInitialContent = useMemo(
		() =>
			normalizeDocumentContentForEditor(
				baseContent,
				currentDocument?.content_type
			),
		[baseContent, currentDocument?.content_type]
	);

	const { markSkipNextEditorInitialSync } = useDocEditorTipTapContentSync({
		tiptapEditor,
		editorInitialContent,
		collaborationEnabledForEditor,
		programmaticUpdateRef,
		documentSyncKey,
	});

	return {
		editorStoreApi,
		t,
		requestDestructiveConfirm,
		destructiveConfirmOpen,
		destructiveConfirmPayload,
		resolveDestructiveConfirm,
		reduceMotion,
		mainGridLabels,
		currentDocument,
		isDirty,
		isSaving,
		isLoadingDocument,
		loadError,
		lastSaved,
		selectedText,
		documentSource,
		docTabOrder,
		docTabTitles,
		docTabSessions,
		aiPanelOpen,
		aiFileManagerContext,
		imageGenPanelOpen,
		collabPanelOpen,
		activeCollaborators,
		searchPanelOpen,
		versionsPanelOpen,
		openAIPanel,
		closeAIPanel,
		clearAiFileManagerContext,
		openImageGenPanel,
		closeImageGenPanel,
		openCollabPanel,
		closeCollabPanel,
		openSearchPanel,
		closeSearchPanel,
		openVersionsPanel,
		closeVersionsPanel,
		setSelectedText,
		updateDocument,
		switchDocTab,
		removeDocTab,
		initDocTabsFromWindowPayload,
		notifyError,
		notifySuccess,
		collabOpenedFromPayloadRef,
		persistedOnServer,
		user,
		shellTheme,
		shellFrame,
		docInWindowZ,
		embeddedModalZ,
		exportMenuPortalZ,
		optionalShellBridge,
		desktopUiScaleForEditor,
		shellFramePreset,
		docToolbarClusterClass,
		docHeaderMetaStripClass,
		docHeaderToolbarVSepClass,
		metricBadgeDefaultSurface,
		docScrollFabClass,
		docMarkdownTextareaClass,
		embeddedEastColumnClass,
		docGuideCardClass,
		memoryWarningSurfaceClass,
		docPreviewProseClassName,
		loadDocument,
		createDocument,
		currentFileId,
		currentContent,
		saveCurrentDocument,
		loadDocumentById,
		fileExchangeLoadError,
		clearLoadError,
		hasLoadFailure,
		eastDocPanelOpen,
		openDocGuideTour,
		closeAllOverlaysForExportRef,
		exportMenuOpen,
		setExportMenuOpen,
		exportMenuPosition,
		exportMenuRef,
		exportButtonRef,
		handleExportToggle,
		handleExport,
		applyOracleStatsToHeader,
		programmaticUpdateRef,
		fileManagerOpen,
		setFileManagerOpen,
		importPanelOpen,
		setImportPanelOpen,
		ocrPanelOpen,
		tableEditorOpen,
		mathEditorOpen,
		commentsPanelOpen,
		setCommentsPanelOpen,
		templatesPanelOpen,
		chartsPanelOpen,
		pdfPanelOpen,
		getPanelOpenState,
		closePanel,
		closeAllOverlays,
		showPanel,
		togglePanel,
		panelOpenForSidebar,
		anyDocOverlayOpen,
		isDragOver,
		memoryWarning,
		dismissMemoryWarning,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		commentJumpFlashToken,
		activeCommentThreadId,
		setActiveCommentThreadId,
		setCommentThreads,
		externalThreadAction,
		handleJumpToCommentSelection,
		openThreadById,
		handleCommentAnchorAction,
		handleExternalThreadActionHandled,
		commentAnchorRanges,
		commentAnchorMeta,
		resetCommentsSession,
		collabConnected,
		collabError,
		collabJoin,
		collabLeave,
		collabUpdateCursor,
		collabKickParticipant,
		collabMySocketId,
		collaborationEnabledByUser,
		setCollaborationEnabledByUser,
		setCollabJoinedDocId,
		collaborationEnabledForEditor,
		isCollabDocumentOwner,
		collaborationEnabledForEditorRef,
		collabYjsBootstrapRef,
		handleCollaborationYjsFailed,
		autoJoinCollabFromInviteRef,
		handleYjsConnectionStatusChange,
		isCollabDocumentOwnerRef,
		canPersistCanonical,
		payloadWantsUnifiedContent,
		canPersistUnifiedContent,
		canPersistCanonicalRef,
		canPersistUnifiedContentRef,
		payloadWantsUnifiedContentRef,
		currentFileIdRef,
		saveCurrentDocumentRef,
		lastSelectionRef,
		lastCollabCursorRef,
		editorScrollContainerRef,
		previewScrollRef,
		pendingDocInsertRef,
		updateStats,
		openTarget,
		displayLoadError,
		handleRetryLoadAfterGridError,
		baseContent,
		documentSyncKey,
		editorInitialContent,
		markSkipNextEditorInitialSync,
		tiptapEditor,
		setTiptapEditor,
		editorSelectionRange,
		setEditorSelectionRange,
		previewMode,
		setPreviewMode,
		showGuide,
		setShowGuide,
		docGuideOpen,
		setDocGuideOpen,
		liveStats,
		toolbarCloseTick,
		yjsConnectionStatus,
		documentId,
		documentIds,
		activeDocumentIdProp,
		tabTitlesProp,
		unifiedContentId,
		docEditorTabs,
		activeDocEditorTab,
		docOpenRequestId,
		mode,
		onSave,
		onClose,
		embedded,
		onPayloadChange,
		openCollabAfterLoad,
		autoJoinCollaborationAfterLoad,
	};
}
