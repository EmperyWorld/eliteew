/**
 * 🔥💎 Ultimate Document Editor - Custom Hooks 💎🔥
 *
 * Export all custom hooks
 */

export {
	type UseDocEditorSaveErrorBannerRetryHandlerParams,
	useDocEditorSaveErrorBannerRetryHandler,
} from './useDocEditorSaveErrorBannerRetryHandler';
export { useDocument } from './useDocument';
export { useDocEditorCloseDocGuideOnMount } from './useDocEditorCloseDocGuideOnMount';
export {
	type UseDocEditorDraftPersistenceParams,
	type UseDocEditorDraftPersistenceResult,
	useDocEditorDraftPersistence,
} from './useDocEditorDraftPersistence';
export {
	type DocEditorCloseAllOverlays,
	type UseDocEditorExportParams,
	type UseDocEditorExportResult,
	useDocEditorExport,
} from './useDocEditorExport';
export {
	type UseDocEditorMarkdownModeParams,
	type UseDocEditorMarkdownModeResult,
	useDocEditorMarkdownMode,
} from './useDocEditorMarkdownMode';
export {
	computeIncomingPayloadActiveDocId,
	computeIncomingPayloadDocIds,
	computeOpenTarget,
	type DocEditorSessionOpenTarget,
	useDocEditorOpenTargetSession,
} from './useDocEditorOpenTargetSession';
export {
	type DocEditorPanelsStoreSlice,
	useDocEditorPanels,
} from './useDocEditorPanels';
export {
	type UseDocEditorCommentsSessionParams,
	type UseDocEditorCommentsSessionResult,
	useDocEditorCommentsSession,
} from './useDocEditorCommentsSession';
export {
	type UseDocEditorLeaveAndCloseConfirmParams,
	type UseDocEditorLeaveAndCloseConfirmResult,
	useDocEditorLeaveAndCloseConfirm,
} from './useDocEditorLeaveAndCloseConfirm';
export {
	type UseDocEditorDirectCloseHandlerParams,
	useDocEditorDirectCloseHandler,
} from './useDocEditorDirectCloseHandler';
export {
	type UseDocEditorAutosaveParams,
	useDocEditorAutosave,
} from './useDocEditorAutosave';
export {
	type UseDocEditorCanonicalSaveParams,
	type UseDocEditorCanonicalSaveResult,
	useDocEditorCanonicalSave,
} from './useDocEditorCanonicalSave';
export {
	type UseDocEditorEditorHtmlStoreSyncParams,
	type UseDocEditorEditorHtmlStoreSyncResult,
	useDocEditorEditorHtmlStoreSync,
} from './useDocEditorEditorHtmlStoreSync';
export {
	type UseDocEditorDragDropParams,
	type UseDocEditorDragDropResult,
	useDocEditorDragDrop,
} from './useDocEditorDragDrop';
export {
	type UseDocEditorPendingInsertsParams,
	type UseDocEditorPendingInsertsResult,
	useDocEditorPendingInserts,
} from './useDocEditorPendingInserts';
export {
	type UseDocEditorPreviewScrollSyncParams,
	type UseDocEditorPreviewScrollSyncResult,
	useDocEditorPreviewScrollSync,
} from './useDocEditorPreviewScrollSync';
export {
	type UseDocEditorInsertionHandlersParams,
	type UseDocEditorInsertionHandlersResult,
	useDocEditorInsertionHandlers,
} from './useDocEditorInsertionHandlers';
export {
	type UseDocEditorResolveHtmlForSaveParams,
	type UseDocEditorResolveHtmlForSaveResult,
	useDocEditorResolveHtmlForSave,
} from './useDocEditorResolveHtmlForSave';
export {
	type UseDocEditorTipTapContentSyncParams,
	type UseDocEditorTipTapContentSyncResult,
	useDocEditorTipTapContentSync,
} from './useDocEditorTipTapContentSync';
export {
	type UseDocEditorTipTapSurfaceHandlersParams,
	type UseDocEditorTipTapSurfaceHandlersResult,
	useDocEditorTipTapSurfaceHandlers,
} from './useDocEditorTipTapSurfaceHandlers';
export {
	type DocEditorPanelsDocumentPick,
	type UseDocEditorDocumentOpenFromPanelsHandlersParams,
	type UseDocEditorDocumentOpenFromPanelsHandlersResult,
	useDocEditorDocumentOpenFromPanelsHandlers,
} from './useDocEditorDocumentOpenFromPanelsHandlers';
export {
	type DocEditorHeaderPanelButtonRenderer,
	useDocEditorHeaderPanelButton,
} from './useDocEditorHeaderPanelButton';
export {
	type DocEditorShellPresentation,
	DOC_EDITOR_HEADER_TOOLBAR_VSEP_CLASS,
	useDocEditorShellPresentation,
} from './useDocEditorShellPresentation';
export {
	type UseDocEditorPanelOverlaysPropsParams,
	useDocEditorPanelOverlaysProps,
} from './useDocEditorPanelOverlaysProps';
export {
	type DocEditorBootstrapUnifiedContent,
	type UseDocEditorEditorDocumentLifecycleEffectsParams,
	type UseDocEditorUnifiedContentStoreSyncParams,
	useDocEditorEditorDocumentLifecycleEffects,
	useDocEditorUnifiedContentStoreSync,
} from './useDocEditorBootstrapContentEffects';
export {
	type UseDocEditorEarlyBootstrapEffectsParams,
	useDocEditorEarlyBootstrapEffects,
} from './useDocEditorEarlyBootstrapEffects';
export {
	type UseDocEditorEscapeDismissOverlaysParams,
	useDocEditorEscapeDismissOverlays,
} from './useDocEditorEscapeDismissOverlays';
export {
	type UseDocEditorPersistCapabilityRefsParams,
	type UseDocEditorPersistCapabilityRefsResult,
	useDocEditorPersistCapabilityRefs,
} from './useDocEditorPersistCapabilityRefs';
export { useLlamaAI } from './useLlamaAI';
export { useComfyUI } from './useComfyUI';
export { useCollaboration } from './useCollaboration';
export {
	type UseDocEditorCollaborationAutoJoinAfterLoadParams,
	type UseDocEditorCollaborationSessionParams,
	type UseDocEditorCollaborationSessionResult,
	useDocEditorCollaborationAutoJoinAfterLoad,
	useDocEditorCollaborationSession,
} from './useDocEditorCollaborationSession';
export {
	type UseDocEditorCollabHeaderActionsParams,
	type UseDocEditorCollabHeaderActionsResult,
	useDocEditorCollabHeaderActions,
} from './useDocEditorCollabHeaderActions';
export {
	type UseDocEditorDocTabsOrchestrationParams,
	type UseDocEditorDocTabsOrchestrationResult,
	useDocEditorDocTabsOrchestration,
} from './useDocEditorDocTabsOrchestration';
export {
	type DocEditorDestructiveConfirmPayload,
	type DocEditorDestructiveConfirmVariant,
	type UseDocEditorDestructiveConfirmResult,
	useDocEditorDestructiveConfirm,
} from './useDocEditorDestructiveConfirm';
export { useDocumentSearch } from './useDocumentSearch';
export { useRuntimeDialogFocusTrap } from './useRuntimeDialogFocusTrap';
