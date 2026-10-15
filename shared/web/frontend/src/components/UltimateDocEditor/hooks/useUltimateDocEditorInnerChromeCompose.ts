/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chrome/save/collab-stage compose for UltimateDocEditorInner — companion shell payload,
 * drafts, autosave, leave/close, collab auto-join, tabs, TipTap surface handlers,
 * header/preview memos, and panel overlay props.
 *
 * Invariants:
 * - Companion excerpt/selection/listing and save/collab behavior unchanged.
 *
 * Related:
 * - useUltimateDocEditorInnerCompose.ts, inner/UltimateDocEditorInnerView.tsx
 */

import type { useUltimateDocEditorInnerContentCompose } from './useUltimateDocEditorInnerContentCompose';
import { useCallback, useMemo } from 'react';
import { useDocEditorCollaborationAutoJoinAfterLoad } from './useDocEditorCollaborationSession';
import { useDocEditorCollabHeaderActions } from './useDocEditorCollabHeaderActions';
import { useDocEditorDocTabsOrchestration } from './useDocEditorDocTabsOrchestration';
import { useDocEditorDraftPersistence } from './useDocEditorDraftPersistence';
import { useDocEditorEscapeDismissOverlays } from './useDocEditorEscapeDismissOverlays';
import { useDocEditorLeaveAndCloseConfirm } from './useDocEditorLeaveAndCloseConfirm';
import { useDocEditorSaveErrorBannerRetryHandler } from './useDocEditorSaveErrorBannerRetryHandler';
import { useDocEditorTipTapSurfaceHandlers } from './useDocEditorTipTapSurfaceHandlers';
import { useDocEditorAutosave } from './useDocEditorAutosave';
import { useDocEditorCompanionShellPayload } from './useDocEditorCompanionShellPayload';
import {
	resolveDocEditorCollabSaveMode,
	saveActionTooltipKeyForMode,
} from '../utils/docEditorCollabSavePolicy';
import { useDocEditorCanonicalSave } from './useDocEditorCanonicalSave';
import {
	useDocEditorEditorDocumentLifecycleEffects,
	useDocEditorUnifiedContentStoreSync,
} from './useDocEditorBootstrapContentEffects';
import { useDocEditorDirectCloseHandler } from './useDocEditorDirectCloseHandler';
import { useDocEditorDocumentOpenFromPanelsHandlers } from './useDocEditorDocumentOpenFromPanelsHandlers';
import { useDocEditorEditorHtmlStoreSync } from './useDocEditorEditorHtmlStoreSync';
import { useDocEditorHeaderPanelButton } from './useDocEditorHeaderPanelButton';
import { useDocEditorPanelOverlaysProps } from './useDocEditorPanelOverlaysProps';
import {
	contentToPlainText,
	normalizeDocumentContentForEditor,
} from '../utils/ultimateDocEditorBootstrap';
import { getUserDisplayName } from '@/utils/userDisplayName';
import { useDesktopWindowBeforeClose } from '../../../pages/Desktop/context/DesktopWindowContext';
import { isEffectivelyEmptyDocHtml } from '../utils/htmlComparableText';
import { buildDraftDiffPreview } from '../utils/docEditorDraftLocal';
import {
	getUltimateDocEditorGuideSteps,
	type UltimateDocEditorGuideLayoutKey,
} from '../ultimateDocEditorGuideData';

export function useUltimateDocEditorInnerChromeCompose(
	session: ReturnType<typeof useUltimateDocEditorInnerContentCompose>
) {
	const {
		editorStoreApi,
		t,
		requestDestructiveConfirm,
		currentDocument,
		isDirty,
		isSaving,
		isLoadingDocument,
		loadError,
		lastSaved,
		selectedText,
		documentSource,
		collabPanelOpen,
		activeCollaborators,
		searchPanelOpen,
		versionsPanelOpen,
		openCollabPanel,
		closeSearchPanel,
		setSelectedText,
		updateDocument,
		switchDocTab,
		removeDocTab,
		notifyError,
		persistedOnServer,
		user,
		loadDocument,
		currentFileId,
		currentContent,
		saveCurrentDocument,
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
		templatesPanelOpen,
		chartsPanelOpen,
		pdfPanelOpen,
		getPanelOpenState,
		closePanel,
		closeAllOverlays,
		togglePanel,
		anyDocOverlayOpen,
		activeCommentThreadId,
		setActiveCommentThreadId,
		setCommentThreads,
		externalThreadAction,
		handleJumpToCommentSelection,
		handleExternalThreadActionHandled,
		resetCommentsSession,
		collabConnected,
		collabError,
		collabJoin,
		collabLeave,
		collabUpdateCursor,
		collabKickParticipant,
		collabMySocketId,
		setCollaborationEnabledByUser,
		setCollabJoinedDocId,
		collaborationEnabledForEditor,
		isCollabDocumentOwner,
		collaborationEnabledForEditorRef,
		collabYjsBootstrapRef,
		autoJoinCollabFromInviteRef,
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
		updateStats,
		openTarget,
		editorInitialContent,
		tiptapEditor,
		setTiptapEditor,
		editorSelectionRange,
		setEditorSelectionRange,
		previewMode,
		showGuide,
		setShowGuide,
		docGuideOpen,
		setDocGuideOpen,
		yjsConnectionStatus,
		markdownMode,
		markdownModeRef,
		renderedMarkdownPreview,
		markdownOriginalHtmlRef,
		markdownBaselineRef,
		setMarkdownMode,
		setMarkdownSource,
		setMarkdownEdited,
		setRenderedMarkdownPreview,
		convertMarkdownToHtml,
		resetMarkdownForDocumentSwitch,
		applyPendingInsertToEditorRef,
		handleInsertText,
		handleInsertPdfHtml,
		handleInsertTable,
		handleInsertFormula,
		handleInsertChart,
		handleInsertDiagram,
		resolveHtmlForSave,
		resolveHtmlForSaveRef,
		documentId,
		unifiedContentId,
		docOpenRequestId,
		mode,
		onSave,
		onClose,
		embedded,
		onPayloadChange,
		autoJoinCollaborationAfterLoad,
	} = session;

	const docGuideLayoutKey = useMemo((): UltimateDocEditorGuideLayoutKey => {
		if (mode === 'view') return 'view';
		if (previewMode) return 'preview';
		if (markdownMode) return 'markdown';
		return 'edit';
	}, [mode, previewMode, markdownMode]);
	const docGuideSteps = useMemo(
		() => getUltimateDocEditorGuideSteps(docGuideLayoutKey),
		[docGuideLayoutKey]
	);

	/** Для TipTap/Yjs: не отдавать пустой initialContent, если в store уже есть текст (гонка getHTML / второй «Подключиться»). */
	const tiptapInitialContent = useMemo(() => {
		const init = editorInitialContent;
		const doc = normalizeDocumentContentForEditor(
			currentDocument?.content ?? '',
			currentDocument?.content_type
		);
		if (isEffectivelyEmptyDocHtml(init) && !isEffectivelyEmptyDocHtml(doc)) {
			return doc;
		}
		return init;
	}, [
		editorInitialContent,
		currentDocument?.content,
		currentDocument?.content_type,
	]);
	const aiDocumentContext = useMemo(
		() =>
			contentToPlainText(
				currentDocument?.content || currentContent?.html || ''
			),
		[currentContent?.html, currentDocument?.content]
	);

	useDocEditorCompanionShellPayload({
		embedded: Boolean(embedded),
		onPayloadChange,
		currentDocumentContent: currentDocument?.content ?? '',
		currentContentHtml: currentContent?.html ?? '',
		aiDocumentContext,
		selectedText,
		unifiedContentId,
		documentTitle: currentDocument?.title,
	});

	const currentReviewUser = useMemo(() => {
		if (!user) {
			return undefined;
		}

		const name = getUserDisplayName(user) || t('inner.you');
		const avatarSource = name;

		return {
			id: user.id,
			name,
			avatar: avatarSource.charAt(0).toUpperCase(),
		};
	}, [user, t]);
	const currentReviewPermissionRole = useMemo<
		'owner' | 'reviewer' | 'viewer'
	>(() => {
		const role = String(user?.role ?? '').toLowerCase();
		if (role === 'viewer') {
			return 'viewer';
		}
		if (role === 'reviewer' || role === 'moderator') {
			return 'reviewer';
		}
		return 'owner';
	}, [user?.role]);

	const {
		draftRecoveryOpen,
		draftRecoverySource,
		pendingDraft,
		draftConflict,
		hasLocalDraftIndicator,
		localDraftTooltip,
		handleRestoreLocalDraft,
		handleSkipDraftRecovery,
		handleDiscardLocalDraft,
		handleOpenLocalDraftRecovery,
	} = useDocEditorDraftPersistence({
		currentFileId,
		currentDocument,
		documentId,
		documentSource,
		payloadWantsUnifiedContent,
		canPersistCanonical,
		collaborationEnabledForEditor,
		editorInitialContent,
		isDirty,
		isLoadingDocument,
		editorStoreApi,
		updateStats,
		tiptapEditor,
		programmaticUpdateRef,
		markdownOriginalHtmlRef,
		markdownBaselineRef,
		setMarkdownMode,
		setMarkdownSource,
		setMarkdownEdited,
		setRenderedMarkdownPreview,
	});

	useDocEditorEscapeDismissOverlays({
		docGuideOpen,
		showGuide,
		anyDocOverlayOpen,
		setDocGuideOpen,
		setShowGuide,
		closeAllOverlays,
	});

	const renderHeaderPanelButton = useDocEditorHeaderPanelButton(
		getPanelOpenState,
		togglePanel
	);

	useDocEditorUnifiedContentStoreSync({
		currentContent,
		currentFileId,
		userId: user?.id,
		editorStoreApi,
		updateStats,
	});

	const {
		latestEditorHtmlRef,
		handleDocumentChange,
		handleDocumentFlush,
		flushPendingEditorHtmlToStore,
		syncEditorHtmlToStoreBeforeCollab,
		commitOracleHtmlSnapshot,
		initIncrementalStatsFromEditor,
	} = useDocEditorEditorHtmlStoreSync({
		editorStoreApi,
		markdownMode,
		tiptapEditor,
		currentDocumentId: currentDocument?.id,
		programmaticUpdateRef,
		collaborationEnabledForEditorRef,
		collabYjsBootstrapRef,
		onOracleStatsCommitted: applyOracleStatsToHeader,
	});

	const { flushOwnerCollabCanonical } = useDocEditorAutosave({
		editorStoreApi,
		resolveHtmlForSaveRef,
		saveCurrentDocumentRef,
		payloadWantsUnifiedContentRef,
		currentFileIdRef,
		canPersistCanonicalRef,
		canPersistUnifiedContentRef,
		collaborationEnabledForEditorRef,
		isCollabDocumentOwnerRef,
		isDirty,
		isSaving,
		currentDocument,
	});

	const collabSaveMode = useMemo(
		() =>
			resolveDocEditorCollabSaveMode({
				collaborationActive: collaborationEnabledForEditor,
				isDocumentOwner: isCollabDocumentOwner,
				canPersistCanonical,
			}),
		[collaborationEnabledForEditor, isCollabDocumentOwner, canPersistCanonical]
	);
	const saveActionTooltip = t(saveActionTooltipKeyForMode(collabSaveMode));

	const handleSaveErrorBannerRetry = useDocEditorSaveErrorBannerRetryHandler({
		flushPendingEditorHtmlToStore,
		editorStoreApi,
		updateDocument,
		collaborationEnabledForEditorRef,
	});

	const beforeCloseCtx = useDesktopWindowBeforeClose();
	const {
		getLeaveGuardDecision,
		showCloseConfirm,
		isCloseConfirmSaving,
		setIsCloseConfirmSaving,
		openDirectCloseConfirm,
		resolveCloseConfirm,
	} = useDocEditorLeaveAndCloseConfirm({
		editorStoreApi,
		openTargetRequestId: openTarget?.requestId,
		onClose,
		flushPendingEditorHtmlToStore,
		registerBeforeClose: beforeCloseCtx?.registerBeforeClose,
		unregisterBeforeClose: beforeCloseCtx?.unregisterBeforeClose,
	});

	const handleClose = useDocEditorDirectCloseHandler({
		onClose,
		getLeaveGuardDecision,
		openDirectCloseConfirm,
		openTargetRequestId: openTarget?.requestId,
	});

	const { handleSave, handleSaveAndCloseConfirm } = useDocEditorCanonicalSave({
		flushPendingEditorHtmlToStore,
		resolveHtmlForSave,
		currentFileId,
		payloadWantsUnifiedContent,
		notifyError,
		canPersistUnifiedContent,
		saveCurrentDocument,
		editorStoreApi,
		onSave,
		currentDocument,
		collaborationEnabledForEditor,
		updateDocument,
		isCloseConfirmSaving,
		setIsCloseConfirmSaving,
		getLeaveGuardDecision,
		resolveCloseConfirm,
	});

	useDocEditorCollaborationAutoJoinAfterLoad({
		autoJoinCollaborationAfterLoad,
		loadError,
		isLoadingDocument,
		currentDocumentId: currentDocument?.id,
		documentId,
		autoJoinCollabFromInviteRef,
		collabYjsBootstrapRef,
		setCollabJoinedDocId,
		setCollaborationEnabledByUser,
		syncEditorHtmlToStoreBeforeCollab,
		collabJoin,
		editorStoreApi,
	});

	const onBeforeCollabDisconnect = useCallback(async (): Promise<void> => {
		if (!isCollabDocumentOwner || !collaborationEnabledForEditorRef.current) {
			return;
		}
		const { isDirty: dirtyNow } = editorStoreApi.getState();
		if (!dirtyNow) {
			return;
		}
		await flushPendingEditorHtmlToStore();
		await flushOwnerCollabCanonical();
	}, [
		editorStoreApi,
		flushOwnerCollabCanonical,
		flushPendingEditorHtmlToStore,
		isCollabDocumentOwner,
		collaborationEnabledForEditorRef.current,
	]);

	const { onCollabConnect, disconnectCollabSession } =
		useDocEditorCollabHeaderActions({
			currentDocument,
			setCollabJoinedDocId,
			collabLeave,
			setCollaborationEnabledByUser,
			collabYjsBootstrapRef,
			syncEditorHtmlToStoreBeforeCollab,
			collabJoin,
			onBeforeDisconnect: onBeforeCollabDisconnect,
		});

	const { handleRemoveDocTab, handleSwitchDocTab } =
		useDocEditorDocTabsOrchestration({
			editorStoreApi,
			flushPendingEditorHtmlToStore,
			removeDocTab,
			switchDocTab,
			collaborationEnabledForEditor,
			currentDocumentId: currentDocument?.id,
			documentSource,
			openTargetRequestId: openTarget?.requestId,
			disconnectCollabSession,
			requestDestructiveConfirm,
		});

	const {
		handleOpenImportFromFileManager,
		handleImportComplete,
		handleDocumentSelect,
		handleFileManagerDocumentSelect,
	} = useDocEditorDocumentOpenFromPanelsHandlers({
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
	});

	useDocEditorEditorDocumentLifecycleEffects({
		editorInitialContent,
		updateStats,
		resetMarkdownForDocumentSwitch,
		resetCommentsSession,
		setSelectedText,
		setEditorSelectionRange,
		lastSelectionRef,
		lastCollabCursorRef,
		latestEditorHtmlRef,
		editorScrollContainerRef,
	});

	const {
		handleSelectionUpdate,
		handleEditorReady,
		handleEditorUnmounted,
		handleCreateFromTemplate,
		handleScrollToDocumentTop,
		handleScrollToDocumentBottom,
	} = useDocEditorTipTapSurfaceHandlers({
		setSelectedText,
		setEditorSelectionRange,
		lastSelectionRef,
		lastCollabCursorRef,
		collabUpdateCursor,
		setTiptapEditor,
		initIncrementalStatsFromEditor,
		commitOracleHtmlSnapshot,
		markdownModeRef,
		applyPendingInsertToEditorRef,
		convertMarkdownToHtml,
		setMarkdownEdited,
		setMarkdownMode,
		setMarkdownSource,
		tiptapEditor,
		markdownBaselineRef,
		markdownOriginalHtmlRef,
		editorScrollContainerRef,
	});

	const previewHtml = useMemo(() => {
		const markdownEmptyHtml = `<p><em>${t('inner.preview.markdownEmpty')}</em></p>`;
		const editorEmptyHtml = `<p><em>${t('inner.preview.editorEmpty')}</em></p>`;
		if (markdownMode) {
			return renderedMarkdownPreview || markdownEmptyHtml;
		}

		// Не вызывать getHTML() здесь: на каждый символ это дублировало сериализацию из onUpdate
		// и раздувало INP. HTML попадает в store через versioned analytical pipeline (handleDocumentChange).
		if (tiptapEditor) {
			return (
				currentContent?.html ||
				currentDocument?.content ||
				editorInitialContent ||
				editorEmptyHtml
			);
		}

		return (
			currentContent?.html ||
			currentDocument?.content ||
			editorInitialContent ||
			editorEmptyHtml
		);
	}, [
		markdownMode,
		renderedMarkdownPreview,
		tiptapEditor,
		currentContent?.html,
		currentDocument?.content,
		editorInitialContent,
		t,
	]);

	const documentStatusAriaLabel = useMemo(() => {
		if (isSaving) {
			return t('header.statusBadgeAria', { state: t('header.statusSaving') });
		}
		if (draftConflict) {
			return t('header.statusBadgeAria', {
				state: t('header.statusDraftConflict'),
			});
		}
		if (hasLocalDraftIndicator) {
			return t('header.statusBadgeAria', {
				state: t('header.statusLocalDraft'),
			});
		}
		if (isDirty) {
			return t('header.statusBadgeAria', { state: t('header.statusUnsaved') });
		}
		if (!persistedOnServer) {
			return t('header.statusBadgeAria', {
				state: t('header.statusNoServerRecord'),
			});
		}
		if (lastSaved) {
			return t('header.statusBadgeAria', { state: t('header.statusSaved') });
		}
		return t('header.statusBadgeAria', { state: t('header.statusDraft') });
	}, [
		t,
		isSaving,
		draftConflict,
		hasLocalDraftIndicator,
		isDirty,
		persistedOnServer,
		lastSaved,
	]);

	const headerViewModeLine = useMemo(() => {
		const mode = previewMode
			? t('header.viewModePreview')
			: markdownMode
				? t('header.viewModeMarkdown')
				: t('header.viewModeFormatted');
		return t('header.viewModeLine', { mode });
	}, [t, previewMode, markdownMode]);

	const draftDiffPreview = useMemo(() => {
		if (!pendingDraft) {
			return null;
		}
		return buildDraftDiffPreview(
			editorInitialContent || '<p></p>',
			pendingDraft.content || '<p></p>'
		);
	}, [editorInitialContent, pendingDraft]);

	const panelOverlaysProps = useDocEditorPanelOverlaysProps({
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
		collabYjsConnectionStatus: yjsConnectionStatus,
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
		onSearchSelect: handleDocumentSelect,
		onFileManagerOpenImport: handleOpenImportFromFileManager,
		onFileManagerSelectDocument: handleFileManagerDocumentSelect,
		onImportComplete: handleImportComplete,
		onOcrInsertText: handleInsertText,
		onInsertTable: handleInsertTable,
		onInsertFormula: handleInsertFormula,
		commentsCurrentUser: currentReviewUser,
		commentsPermissionRole: currentReviewPermissionRole,
		commentsSelectedText: selectedText,
		commentsSelectionRange: editorSelectionRange,
		onCommentsJumpToSelection: handleJumpToCommentSelection,
		onCommentsThreadsChange: setCommentThreads,
		onCommentsFocusThread: setActiveCommentThreadId,
		commentsFocusedThreadId: activeCommentThreadId,
		commentsExternalAction: externalThreadAction,
		onCommentsExternalActionHandled: handleExternalThreadActionHandled,
		setActiveCommentThreadId,
		onTemplateCreate: handleCreateFromTemplate,
		onInsertChart: handleInsertChart,
		onInsertDiagram: handleInsertDiagram,
		onInsertPdfHtml: handleInsertPdfHtml,
	});

	return {
		...session,
		docGuideLayoutKey,
		docGuideSteps,
		tiptapInitialContent,
		aiDocumentContext,
		currentReviewUser,
		currentReviewPermissionRole,
		draftRecoveryOpen,
		draftRecoverySource,
		pendingDraft,
		draftConflict,
		hasLocalDraftIndicator,
		localDraftTooltip,
		handleRestoreLocalDraft,
		handleSkipDraftRecovery,
		handleDiscardLocalDraft,
		handleOpenLocalDraftRecovery,
		renderHeaderPanelButton,
		latestEditorHtmlRef,
		handleDocumentChange,
		handleDocumentFlush,
		flushPendingEditorHtmlToStore,
		syncEditorHtmlToStoreBeforeCollab,
		commitOracleHtmlSnapshot,
		initIncrementalStatsFromEditor,
		flushOwnerCollabCanonical,
		collabSaveMode,
		saveActionTooltip,
		handleSaveErrorBannerRetry,
		beforeCloseCtx,
		getLeaveGuardDecision,
		showCloseConfirm,
		isCloseConfirmSaving,
		setIsCloseConfirmSaving,
		openDirectCloseConfirm,
		resolveCloseConfirm,
		handleClose,
		handleSave,
		handleSaveAndCloseConfirm,
		onBeforeCollabDisconnect,
		onCollabConnect,
		disconnectCollabSession,
		handleRemoveDocTab,
		handleSwitchDocTab,
		handleOpenImportFromFileManager,
		handleImportComplete,
		handleDocumentSelect,
		handleFileManagerDocumentSelect,
		handleSelectionUpdate,
		handleEditorReady,
		handleEditorUnmounted,
		handleCreateFromTemplate,
		handleScrollToDocumentTop,
		handleScrollToDocumentBottom,
		previewHtml,
		documentStatusAriaLabel,
		headerViewModeLine,
		draftDiffPreview,
		panelOverlaysProps,
	};
}
