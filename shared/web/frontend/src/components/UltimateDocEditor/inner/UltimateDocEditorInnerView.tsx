/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational chrome stack for Ultimate Document Editor — receives the compose
 * view-model and renders UltimateDocEditorChromeStack.
 *
 * Invariants:
 * - No save/collab/companion hook wiring; behavior arrives via view-model props.
 *
 * Related:
 * - useUltimateDocEditorInnerCompose.ts, UltimateDocEditorInner.tsx
 */

import * as React from 'react';
import type { UltimateDocEditorInnerViewModel } from '../hooks/useUltimateDocEditorInnerCompose';
import { CreativeStudioGuideTourModal } from '@/components/guided-tour/CreativeStudioGuideTourModal';
import { DocEditorDragDropChrome } from '../chrome/DocEditorDragDropChrome';
import { UltimateDocEditorChromeStack } from '../chrome/UltimateDocEditorChromeStack';
import { UltimateDocEditorCloseConfirmModal } from '../chrome/UltimateDocEditorCloseConfirmModal';
import { UltimateDocEditorDestructiveConfirmModal } from '../chrome/UltimateDocEditorDestructiveConfirmModal';
import { UltimateDocEditorDocumentHeader } from '../chrome/UltimateDocEditorDocumentHeader';
import { UltimateDocEditorDraftRecoveryModal } from '../chrome/UltimateDocEditorDraftRecoveryModal';
import { UltimateDocEditorQuickStartGuideOverlay } from '../chrome/UltimateDocEditorQuickStartGuideOverlay';
import { UltimateDocEditorSaveErrorBanner } from '../chrome/UltimateDocEditorSaveErrorBanner';
import { UltimateDocEditorMainGrid } from '../chrome/UltimateDocEditorMainGrid';
import { UltimateDocEditorPanelOverlays } from '../chrome/UltimateDocEditorPanelOverlays';
import { cn } from '@/utils/cn';
import {
	ULTIMATE_DOC_EDITOR_GUIDE_AUDIO_LS_KEY,
	ULTIMATE_DOC_EDITOR_GUIDE_ROOT_ID,
	ULTIMATE_DOC_EDITOR_GUIDE_TOUR_FOLDER,
} from '../ultimateDocEditorGuideData';

export type UltimateDocEditorInnerViewProps = {
	vm: UltimateDocEditorInnerViewModel;
};

export const UltimateDocEditorInnerView: React.FC<
	UltimateDocEditorInnerViewProps
> = ({ vm }) => {
	const {
		t,
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
		activeCollaborators,
		clearAiFileManagerContext,
		persistedOnServer,
		shellFrame,
		docInWindowZ,
		embeddedModalZ,
		exportMenuPortalZ,
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
		eastDocPanelOpen,
		exportMenuOpen,
		setExportMenuOpen,
		exportMenuPosition,
		exportMenuRef,
		exportButtonRef,
		handleExportToggle,
		handleExport,
		setFileManagerOpen,
		closePanel,
		closeAllOverlays,
		togglePanel,
		panelOpenForSidebar,
		isDragOver,
		memoryWarning,
		dismissMemoryWarning,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		commentJumpFlashToken,
		activeCommentThreadId,
		openThreadById,
		handleCommentAnchorAction,
		commentAnchorRanges,
		commentAnchorMeta,
		collabConnected,
		collaborationEnabledByUser,
		collaborationEnabledForEditor,
		handleCollaborationYjsFailed,
		handleYjsConnectionStatusChange,
		editorScrollContainerRef,
		previewScrollRef,
		displayLoadError,
		handleRetryLoadAfterGridError,
		documentSyncKey,
		mode,
		onClose,
		embedded,
		tiptapEditor,
		previewMode,
		setPreviewMode,
		showGuide,
		setShowGuide,
		docGuideOpen,
		setDocGuideOpen,
		liveStats,
		toolbarCloseTick,
		markdownMode,
		markdownSource,
		markdownEdited,
		handleMarkdownSourceChange,
		handleToggleMarkdownMode,
		handleAIInsert,
		handleAIReplace,
		handleImageInsert,
		handleInsertVoiceDictation,
		docGuideLayoutKey,
		docGuideSteps,
		tiptapInitialContent,
		aiDocumentContext,
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
		handleDocumentChange,
		handleDocumentFlush,
		saveActionTooltip,
		handleSaveErrorBannerRetry,
		showCloseConfirm,
		isCloseConfirmSaving,
		resolveCloseConfirm,
		handleClose,
		handleSave,
		handleSaveAndCloseConfirm,
		onCollabConnect,
		disconnectCollabSession,
		handleRemoveDocTab,
		handleSwitchDocTab,
		handleSelectionUpdate,
		handleEditorReady,
		handleEditorUnmounted,
		handleScrollToDocumentTop,
		handleScrollToDocumentBottom,
		previewHtml,
		documentStatusAriaLabel,
		headerViewModeLine,
		draftDiffPreview,
		panelOverlaysProps,
	} = vm;

	return (
		<UltimateDocEditorChromeStack
			shell={{
				id: ULTIMATE_DOC_EDITOR_GUIDE_ROOT_ID,
				className: cn(
					'ultimate-doc-editor relative flex w-full min-h-0 flex-col overflow-hidden',
					embedded ? 'h-full min-h-0' : 'min-h-screen',
					embedded ? 'bg-transparent' : 'bg-[var(--desktop-surface-app)]',
					isDragOver && 'ring-4 ring-blue-400/50'
				),
				'data-desktop-window-ignore-context': true,
				onDragOver: handleDragOver,
				onDragLeave: handleDragLeave,
				onDrop: handleDrop,
			}}
			dragDropChrome={
				<DocEditorDragDropChrome
					isDragOver={isDragOver}
					memoryWarning={memoryWarning}
					memoryWarningSurfaceClass={memoryWarningSurfaceClass}
					reduceMotion={reduceMotion}
					zDragOverlay={docInWindowZ.dragOverlay}
					zMemoryToast={docInWindowZ.memoryToast}
					onDismissMemoryWarning={dismissMemoryWarning}
				/>
			}
			saveErrorBanner={
				<UltimateDocEditorSaveErrorBanner
					open={Boolean(currentDocument && loadError)}
					loadError={loadError ?? ''}
					titleLabel={t('shell.saveError.title')}
					retryLabel={mainGridLabels.loadRetry}
					zIndex={docInWindowZ.stickyAlert}
					onRetrySave={handleSaveErrorBannerRetry}
				/>
			}
			documentHeader={
				<UltimateDocEditorDocumentHeader
					shellFrame={shellFrame}
					stickyZIndex={docInWindowZ.stickyDocHeader}
					embedded={embedded}
					documentSource={documentSource}
					docTabOrder={docTabOrder}
					docTabTitles={docTabTitles}
					docTabSessions={docTabSessions}
					currentDocument={currentDocument}
					isDirty={isDirty}
					onDocTabSwitch={handleSwitchDocTab}
					onRemoveDocTab={handleRemoveDocTab}
					onOpenFileManagerForNewTab={() => setFileManagerOpen(true)}
					docHeaderMetaStripClass={docHeaderMetaStripClass}
					docHeaderToolbarVSepClass={docHeaderToolbarVSepClass}
					docToolbarClusterClass={docToolbarClusterClass}
					localDraftTooltip={localDraftTooltip}
					hasLocalDraftIndicator={hasLocalDraftIndicator}
					onOpenLocalDraftRecovery={handleOpenLocalDraftRecovery}
					documentStatusAriaLabel={documentStatusAriaLabel}
					isSaving={isSaving}
					draftConflict={draftConflict}
					persistedOnServer={persistedOnServer}
					lastSaved={lastSaved}
					metricBadgeDefaultSurface={metricBadgeDefaultSurface}
					reduceMotion={reduceMotion}
					headerViewModeLine={headerViewModeLine}
					liveStats={liveStats}
					renderHeaderPanelButton={renderHeaderPanelButton}
					onSaveClick={handleSave}
					saveTooltip={saveActionTooltip}
					isSaveDisabled={!isDirty && !currentDocument}
					exportMenuOpen={exportMenuOpen}
					exportMenuPosition={exportMenuPosition}
					exportButtonRef={exportButtonRef}
					exportMenuRef={exportMenuRef}
					exportMenuPortalZ={exportMenuPortalZ}
					onExportMenuToggle={handleExportToggle}
					onRequestCloseExportMenu={() => setExportMenuOpen(false)}
					onExportFormatPicked={(format) => {
						closeAllOverlays();
						void handleExport(format);
					}}
					onCollabDisconnect={disconnectCollabSession}
					onCollabConnect={onCollabConnect}
					activeCollaboratorsLength={activeCollaborators.length}
					collabConnected={collabConnected}
					onShowGuide={() => setShowGuide(true)}
					collaborationEnabledByUser={collaborationEnabledByUser}
					markdownMode={markdownMode}
					onToggleMarkdownMode={handleToggleMarkdownMode}
					previewMode={previewMode}
					onTogglePreviewMode={() => setPreviewMode(!previewMode)}
					onRequestCloseEditor={handleClose}
					hasCloseButton={Boolean(onClose)}
				/>
			}
			quickStartGuide={
				<UltimateDocEditorQuickStartGuideOverlay
					open={showGuide}
					reduceMotion={reduceMotion}
					cardClassName={docGuideCardClass}
					contentSurfacePresetClass={shellFramePreset.content}
					zIndex={docInWindowZ.guideCard}
					onDismissThanks={() => setShowGuide(false)}
					onRequestInterfaceTour={() => setDocGuideOpen(true)}
				/>
			}
			draftRecoveryModal={
				<UltimateDocEditorDraftRecoveryModal
					open={Boolean(draftRecoveryOpen && pendingDraft)}
					pendingDraft={pendingDraft}
					fallbackDocumentTitle={currentDocument?.title}
					draftConflict={draftConflict}
					draftDiffPreview={draftDiffPreview}
					draftRecoverySource={
						draftRecoverySource === 'auto' ? 'auto' : 'manual'
					}
					embeddedBackdropZ={embeddedModalZ.backdrop}
					embeddedContentZ={embeddedModalZ.content}
					onRequestClose={handleSkipDraftRecovery}
					onDiscardDraft={handleDiscardLocalDraft}
					onRestoreDraft={handleRestoreLocalDraft}
				/>
			}
			closeConfirmModal={
				<UltimateDocEditorCloseConfirmModal
					open={showCloseConfirm}
					isCloseConfirmSaving={isCloseConfirmSaving}
					documentTitle={currentDocument?.title}
					embeddedBackdropZ={embeddedModalZ.backdrop}
					embeddedContentZ={embeddedModalZ.content}
					onBackdropDismiss={() => resolveCloseConfirm(false)}
					onFrameDismiss={() => resolveCloseConfirm(false)}
					onStay={() => resolveCloseConfirm(false)}
					onSaveAndClose={() => {
						void handleSaveAndCloseConfirm();
					}}
					onCloseWithoutSaving={() => resolveCloseConfirm(true)}
				/>
			}
			destructiveConfirmModal={
				<UltimateDocEditorDestructiveConfirmModal
					open={destructiveConfirmOpen}
					payload={destructiveConfirmPayload}
					embeddedBackdropZ={embeddedModalZ.backdrop}
					embeddedContentZ={embeddedModalZ.content}
					onCancel={() => resolveDestructiveConfirm(false)}
					onConfirm={() => resolveDestructiveConfirm(true)}
				/>
			}
			mainGrid={
				<UltimateDocEditorMainGrid
					shellFrame={shellFrame}
					shellFramePreset={shellFramePreset}
					embedded={embedded}
					previewMode={previewMode}
					eastDocPanelOpen={eastDocPanelOpen}
					markdownMode={markdownMode}
					markdownEdited={markdownEdited}
					reduceMotion={reduceMotion}
					zStickyToolbar={docInWindowZ.stickyToolbar}
					zScrollFab={docInWindowZ.scrollFab}
					editorScrollContainerRef={editorScrollContainerRef}
					previewScrollRef={previewScrollRef}
					docMarkdownTextareaClass={docMarkdownTextareaClass}
					docScrollFabClass={docScrollFabClass}
					docPreviewProseClassName={docPreviewProseClassName}
					embeddedEastColumnClass={embeddedEastColumnClass}
					isLoadingDocument={isLoadingDocument}
					currentDocument={currentDocument}
					displayLoadError={displayLoadError}
					onRetryLoadAfterError={handleRetryLoadAfterGridError}
					markdownSource={markdownSource}
					onMarkdownSourceChange={handleMarkdownSourceChange}
					tiptapEditor={tiptapEditor}
					toolbarCloseTick={toolbarCloseTick}
					closeAllOverlays={closeAllOverlays}
					tiptapInitialContent={tiptapInitialContent}
					documentSyncKey={documentSyncKey}
					collaborationEnabledForEditor={collaborationEnabledForEditor}
					editorMode={mode}
					onCollaborationYjsFailed={handleCollaborationYjsFailed}
					onYjsConnectionStatusChange={handleYjsConnectionStatusChange}
					commentJumpFlashToken={commentJumpFlashToken}
					commentAnchorRanges={commentAnchorRanges}
					commentAnchorMeta={commentAnchorMeta}
					activeCommentThreadId={activeCommentThreadId}
					onCommentAnchorAction={handleCommentAnchorAction}
					onCommentAnchorClick={openThreadById}
					activeCollaborators={activeCollaborators}
					onEditorDocumentChange={handleDocumentChange}
					onEditorDocumentFlush={handleDocumentFlush}
					onEditorSelectionUpdate={handleSelectionUpdate}
					onEditorReady={handleEditorReady}
					onEditorUnmounted={handleEditorUnmounted}
					desktopUiScaleForEditor={desktopUiScaleForEditor}
					onScrollToDocumentTop={handleScrollToDocumentTop}
					onScrollToDocumentBottom={handleScrollToDocumentBottom}
					previewHtml={previewHtml}
					labels={mainGridLabels}
					aiPanelOpen={aiPanelOpen}
					imageGenPanelOpen={imageGenPanelOpen}
					closePanel={closePanel}
					selectedText={selectedText}
					aiDocumentContext={aiDocumentContext}
					aiFileManagerContext={aiFileManagerContext}
					onClearAiFileManagerContext={clearAiFileManagerContext}
					onAiInsert={handleAIInsert}
					onAiReplace={handleAIReplace}
					onImageInsert={handleImageInsert}
					panelOpenForSidebar={panelOpenForSidebar}
					onToggleSidebarPanel={togglePanel}
					onVoiceDictateInsert={handleInsertVoiceDictation}
				/>
			}
			panelOverlays={<UltimateDocEditorPanelOverlays {...panelOverlaysProps} />}
			guideTourModal={
				<CreativeStudioGuideTourModal
					open={docGuideOpen}
					onClose={() => setDocGuideOpen(false)}
					rootId={ULTIMATE_DOC_EDITOR_GUIDE_ROOT_ID}
					steps={docGuideSteps}
					audioLocalStorageKey={ULTIMATE_DOC_EDITOR_GUIDE_AUDIO_LS_KEY}
					tourAudioFolder={ULTIMATE_DOC_EDITOR_GUIDE_TOUR_FOLDER}
					spotlightLayoutKey={docGuideLayoutKey}
				/>
			}
		/>
	);
};
