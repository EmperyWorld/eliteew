/**
 * Основная сетка редактора: левая rail, колонка редактора, опционально превью и восточная панель (ИИ / изображения).
 */

import type { Editor } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import { motion } from 'framer-motion';
import { lazy, type FC, type RefObject, Suspense } from 'react';

import type { DesktopWindowStyle } from '@/types/profile';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppStatusBadge,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellNavRailClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

import { DOC_EDITOR_TOOLBAR_STICKY_CLASS } from '../EditorCore/docEditorToolbarChrome';
import { EditorPanelSidebar } from './EditorPanelSidebar';
import {
	DOC_EDITOR_CANVAS_INNER_CLASS,
	DOC_EDITOR_CANVAS_PAD_CLASS,
	DOC_EDITOR_CANVAS_SHELL_CLASS,
} from './docEditorCanvasChrome';
import { DOC_EDITOR_SIDEBAR_OUTER_CLASS } from './docEditorSidebarChrome';
import type { OverlayKey } from '../hooks/docEditorPanelKeys';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CodeBracketIcon,
	ExclamationCircleIcon,
	EyeIcon,
} from '@heroicons/react/24/outline';

import {
	AiFileManagerContext,
	CollaboratorInfo,
	CommentAnchorMeta,
	CommentAnchorRange,
	CommentThreadAction,
	ImageGenerationPanelProps,
	UltimateDocument,
	TiptapEditorProps,
	UltimateDocEditorProps,
} from '../types/editor.types';

const EditorToolbar = lazy(() =>
	import('../EditorCore/EditorToolbar').then((m) => ({
		default: m.EditorToolbar,
	}))
);
const TiptapEditor = lazy(() =>
	import('../EditorCore/TiptapEditor').then((m) => ({
		default: m.TiptapEditor,
	}))
);
const AIAssistantPanel = lazy(() =>
	import('../Panels/AIAssistantPanel').then((m) => ({
		default: m.AIAssistantPanel,
	}))
);
const ImageGenerationPanel = lazy(() =>
	import('../Panels/ImageGenerationPanel').then((m) => ({
		default: m.ImageGenerationPanel,
	}))
);

export interface UltimateDocEditorMainGridLabels {
	loadLoadingTitle: string;
	loadLoadingDesc: string;
	loadFailedTitle: string;
	loadRetry: string;
	loadingEditorTitle: string;
	loadingEditorExtensions: string;
	previewEscToClose: string;
	markdownRibbonTitle: string;
	markdownRibbonHint: string;
	markdownStatusEdited: string;
	markdownStatusClean: string;
	markdownFieldLabel: string;
	markdownPlaceholder: string;
	markdownTextareaAria: string;
	scrollToTop: string;
	scrollToBottom: string;
	previewTitleMarkdown: string;
	previewTitleDocument: string;
	previewHintMarkdown: string;
	previewHintDocument: string;
	eastPanelLoadingTitle: string;
	eastPanelLoadingDesc: string;
}

export interface UltimateDocEditorMainGridProps {
	shellFrame: DesktopWindowStyle;
	shellFramePreset: { frame: string; content: string };
	embedded: boolean;
	previewMode: boolean;
	eastDocPanelOpen: boolean;
	markdownMode: boolean;
	markdownEdited: boolean;
	reduceMotion: boolean | null;
	zStickyToolbar: number;
	zScrollFab: number;
	editorScrollContainerRef: RefObject<HTMLDivElement | null>;
	previewScrollRef: RefObject<HTMLDivElement | null>;
	docMarkdownTextareaClass: string;
	docScrollFabClass: string;
	docPreviewProseClassName: string;
	embeddedEastColumnClass: string;
	isLoadingDocument: boolean;
	currentDocument: UltimateDocument | null;
	displayLoadError: string | null | undefined;
	onRetryLoadAfterError: () => void;
	markdownSource: string;
	onMarkdownSourceChange: (markdown: string) => void;
	tiptapEditor: Editor | null;
	toolbarCloseTick: number;
	closeAllOverlays: (opts?: { skipToolbar?: boolean }) => void;
	tiptapInitialContent: string;
	documentSyncKey: string;
	collaborationEnabledForEditor: boolean;
	editorMode: UltimateDocEditorProps['mode'];
	onCollaborationYjsFailed: () => void;
	onYjsConnectionStatusChange?: TiptapEditorProps['onYjsConnectionStatusChange'];
	commentJumpFlashToken: number;
	commentAnchorRanges: CommentAnchorRange[];
	commentAnchorMeta: Record<string, CommentAnchorMeta>;
	activeCommentThreadId: string | null;
	onCommentAnchorAction: (payload: {
		threadId: string;
		action: CommentThreadAction;
	}) => void;
	onCommentAnchorClick: (threadId: string) => void;
	activeCollaborators: CollaboratorInfo[];
	onEditorDocumentChange: (payload: {
		editor: Editor;
		transaction: Transaction;
	}) => void;
	onEditorDocumentFlush: (payload: { editor: Editor }) => void;
	onEditorSelectionUpdate: (
		text: string,
		position: { from: number; to: number; line?: number; column?: number }
	) => void;
	onEditorReady: (editor: Editor) => void;
	onEditorUnmounted: () => void;
	desktopUiScaleForEditor: number;
	onScrollToDocumentTop: () => void;
	onScrollToDocumentBottom: () => void;
	previewHtml: string;
	labels: UltimateDocEditorMainGridLabels;
	aiPanelOpen: boolean;
	imageGenPanelOpen: boolean;
	closePanel: (panel: OverlayKey) => void;
	selectedText: string;
	aiDocumentContext: string;
	aiFileManagerContext: AiFileManagerContext | null;
	onClearAiFileManagerContext: () => void;
	onAiInsert: (text: string) => void;
	onAiReplace: (text: string) => void;
	onImageInsert: ImageGenerationPanelProps['onInsertImage'];
	panelOpenForSidebar: Record<OverlayKey, boolean>;
	onToggleSidebarPanel: (key: OverlayKey) => void;
	onVoiceDictateInsert: (plainText: string) => void;
}

export const UltimateDocEditorMainGrid: FC<UltimateDocEditorMainGridProps> = ({
	shellFrame,
	shellFramePreset,
	embedded,
	previewMode,
	eastDocPanelOpen,
	markdownMode,
	markdownEdited,
	reduceMotion,
	zStickyToolbar,
	zScrollFab,
	editorScrollContainerRef,
	previewScrollRef,
	docMarkdownTextareaClass,
	docScrollFabClass,
	docPreviewProseClassName,
	embeddedEastColumnClass,
	isLoadingDocument,
	currentDocument,
	displayLoadError,
	onRetryLoadAfterError,
	markdownSource,
	onMarkdownSourceChange,
	tiptapEditor,
	toolbarCloseTick,
	closeAllOverlays,
	tiptapInitialContent,
	documentSyncKey,
	collaborationEnabledForEditor,
	editorMode,
	onCollaborationYjsFailed,
	onYjsConnectionStatusChange,
	commentJumpFlashToken,
	commentAnchorRanges,
	commentAnchorMeta,
	activeCommentThreadId,
	onCommentAnchorAction,
	onCommentAnchorClick,
	activeCollaborators,
	onEditorDocumentChange,
	onEditorDocumentFlush,
	onEditorSelectionUpdate,
	onEditorReady,
	onEditorUnmounted,
	desktopUiScaleForEditor,
	onScrollToDocumentTop,
	onScrollToDocumentBottom,
	previewHtml,
	labels,
	aiPanelOpen,
	imageGenPanelOpen,
	closePanel,
	selectedText,
	aiDocumentContext,
	aiFileManagerContext,
	onClearAiFileManagerContext,
	onAiInsert,
	onAiReplace,
	onImageInsert,
	panelOpenForSidebar,
	onToggleSidebarPanel,
	onVoiceDictateInsert,
}) => {
	return (
		<div
			className={`grid min-h-0 flex-1 overflow-hidden ${
				previewMode && eastDocPanelOpen
					? 'grid-cols-[minmax(44px,44px)_minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,28rem)]'
					: previewMode
						? 'grid-cols-[minmax(44px,44px)_minmax(0,1fr)_minmax(0,1fr)]'
						: eastDocPanelOpen
							? 'grid-cols-[minmax(44px,44px)_minmax(0,1fr)_minmax(18rem,28rem)]'
							: 'grid-cols-[minmax(44px,44px)_minmax(0,1fr)]'
			}`}
		>
			<div
				className={cn(
					'relative col-start-2 row-start-1 min-h-0 min-w-0 overflow-hidden',
					previewMode && 'border-r border-(--desktop-border-subtle)',
					!embedded && 'bg-(--desktop-surface-app)',
					embedded && 'bg-transparent'
				)}
			>
				<div
					ref={editorScrollContainerRef}
					className="h-full min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar scrollbar-gutter-stable"
					data-doc-editor-scroll
					data-doc-guide="editor-surface"
				>
					<div className="w-full max-w-none mx-auto">
						<div
							className={DOC_EDITOR_TOOLBAR_STICKY_CLASS}
							style={{
								zIndex: zStickyToolbar,
							}}
							data-doc-guide="editor-toolbar-sticky"
						>
							{markdownMode ? (
								<DesktopAppPanel
									className={cn(
										'flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-none',
										embedded
											? shellFramePreset.frame
											: getDesktopShellContentPanelClassName(shellFrame)
									)}
								>
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<CodeBracketIcon
												width={16}
												height={16}
												className="text-[rgb(var(--desktop-accent-rgb))]"
											/>
											<span className="text-sm font-semibold text-(--desktop-text-primary)">
												{labels.markdownRibbonTitle}
											</span>
										</div>
										<p className="mt-1 text-xs text-(--desktop-text-muted)">
											{labels.markdownRibbonHint}
										</p>
									</div>
									<DesktopAppStatusBadge className="shrink-0">
										{markdownEdited
											? labels.markdownStatusEdited
											: labels.markdownStatusClean}
									</DesktopAppStatusBadge>
								</DesktopAppPanel>
							) : (
								<Suspense
									fallback={
										<div
											className={cn(
												'h-14 rounded-xl',
												embedded
													? shellFramePreset.frame
													: getDesktopShellContentPanelClassName(shellFrame)
											)}
										/>
									}
								>
									<EditorToolbar
										editor={tiptapEditor}
										className={cn(
											'rounded-xl shadow-none',
											embedded
												? shellFramePreset.frame
												: getDesktopShellContentPanelClassName(shellFrame)
										)}
										closeSignal={toolbarCloseTick}
										onRequestExclusiveOpen={() =>
											closeAllOverlays({ skipToolbar: true })
										}
									/>
								</Suspense>
							)}
						</div>

						<div className={DOC_EDITOR_CANVAS_PAD_CLASS}>
							<DesktopAppPanel className={DOC_EDITOR_CANVAS_SHELL_CLASS}>
								<div className={DOC_EDITOR_CANVAS_INNER_CLASS}>
									{isLoadingDocument && !currentDocument ? (
										<div className="min-h-150" aria-live="polite">
											<DesktopAppEmptyState
												icon={
													<ArrowPathIcon
														className="h-10 w-10 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
														aria-hidden
													/>
												}
												title={labels.loadLoadingTitle}
												description={labels.loadLoadingDesc}
												className="min-h-150"
											/>
										</div>
									) : displayLoadError ? (
										<DesktopAppEmptyState
											icon={
												<ExclamationCircleIcon
													className="mb-4 h-12 w-12 shrink-0 text-red-400"
													aria-hidden
												/>
											}
											title={labels.loadFailedTitle}
											description={
												<span className="max-w-md wrap-break-word">
													{displayLoadError}
												</span>
											}
											className="min-h-150 px-4"
											role="alert"
										>
											<DesktopAppButton
												type="button"
												onClick={onRetryLoadAfterError}
												variant="accent"
											>
												{labels.loadRetry}
											</DesktopAppButton>
										</DesktopAppEmptyState>
									) : markdownMode ? (
										<div className="min-h-150">
											<label
												htmlFor="ultimate-doc-markdown-source"
												className="mb-3 block text-xs font-medium uppercase tracking-[0.16em] text-(--desktop-text-dim)"
											>
												{labels.markdownFieldLabel}
											</label>
											<textarea
												id="ultimate-doc-markdown-source"
												value={markdownSource}
												onChange={(event) =>
													onMarkdownSourceChange(event.target.value)
												}
												spellCheck={false}
												className={docMarkdownTextareaClass}
												placeholder={labels.markdownPlaceholder}
												aria-label={labels.markdownTextareaAria}
											/>
										</div>
									) : (
										<Suspense
											fallback={
												<DesktopAppEmptyState
													icon={
														<ArrowPathIcon
															className="h-10 w-10 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
															aria-hidden
														/>
													}
													title={labels.loadingEditorTitle}
													description={labels.loadingEditorExtensions}
													className="min-h-150"
												/>
											}
										>
											<TiptapEditor
												key={`${currentDocument?.id ?? 'no-doc'}-${collaborationEnabledForEditor ? 'yjs' : 'local'}`}
												shellWindowStyle={shellFrame}
												desktopUiScale={desktopUiScaleForEditor}
												initialContent={tiptapInitialContent}
												documentSyncKey={documentSyncKey}
												editable={editorMode !== 'view'}
												documentId={currentDocument?.id}
												enableCollaboration={collaborationEnabledForEditor}
												onCollaborationYjsFailed={onCollaborationYjsFailed}
												onYjsConnectionStatusChange={
													onYjsConnectionStatusChange
												}
												commentJumpFlashToken={commentJumpFlashToken}
												commentAnchors={commentAnchorRanges}
												commentAnchorMeta={commentAnchorMeta}
												activeCommentThreadId={activeCommentThreadId}
												onCommentAnchorAction={onCommentAnchorAction}
												onCommentAnchorClick={onCommentAnchorClick}
												activeCollaborators={activeCollaborators}
												onDocumentChange={onEditorDocumentChange}
												onDocumentFlush={onEditorDocumentFlush}
												onSelectionUpdate={onEditorSelectionUpdate}
												onEditorReady={onEditorReady}
												onEditorUnmounted={onEditorUnmounted}
											/>
										</Suspense>
									)}
								</div>
							</DesktopAppPanel>
						</div>
					</div>
				</div>

				<div
					className="pointer-events-none absolute bottom-6 right-4 flex flex-col gap-2"
					style={{
						zIndex: zScrollFab,
					}}
					data-doc-guide="fab-scroll"
				>
					<DesktopAppButton
						onClick={onScrollToDocumentTop}
						variant="neutral"
						size="icon"
						className={docScrollFabClass}
						title={labels.scrollToTop}
						aria-label={labels.scrollToTop}
					>
						<ArrowUpTrayIcon width={16} height={16} />
					</DesktopAppButton>
					<DesktopAppButton
						onClick={onScrollToDocumentBottom}
						variant="neutral"
						size="icon"
						className={docScrollFabClass}
						title={labels.scrollToBottom}
						aria-label={labels.scrollToBottom}
					>
						<ArrowDownTrayIcon width={16} height={16} />
					</DesktopAppButton>
				</div>
			</div>

			{previewMode ? (
				<div
					ref={previewScrollRef}
					className={cn(
						'col-start-3 row-start-1 min-h-0 min-w-0 overflow-y-auto overscroll-y-contain custom-scrollbar scrollbar-gutter-stable',
						embedded
							? embeddedEastColumnClass
							: 'border-l border-(--desktop-border-subtle) bg-(--desktop-surface-panel)'
					)}
					data-doc-guide="preview-pane"
				>
					<div
						className={cn(
							'w-full max-w-none mx-auto',
							embedded ? 'py-4 px-3' : 'py-10 px-6 sm:px-10'
						)}
					>
						<div
							className={cn(
								'mb-4 flex flex-wrap items-center gap-3 overflow-hidden rounded-(--desktop-radius-lg) sm:mb-6 sm:gap-4',
								getDesktopShellHeaderStripClassName(shellFrame)
							)}
						>
							<motion.div
								className={cn(
									'shrink-0 rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white',
									embedded ? 'p-2' : 'p-3'
								)}
								whileHover={
									reduceMotion ? undefined : { scale: 1.05, rotate: 5 }
								}
							>
								<EyeIcon
									width={embedded ? 18 : 24}
									height={embedded ? 18 : 24}
								/>
							</motion.div>
							<div className="min-w-0 flex-1">
								<h2
									className={cn(
										'font-extrabold text-(--desktop-text-primary)',
										embedded ? 'text-base' : 'text-xl'
									)}
								>
									{markdownMode
										? labels.previewTitleMarkdown
										: labels.previewTitleDocument}
								</h2>
								<p className="text-sm font-medium text-(--desktop-text-muted)">
									{markdownMode
										? labels.previewHintMarkdown
										: labels.previewHintDocument}
								</p>
								<p className="mt-1 text-xs text-(--desktop-text-dim)">
									{labels.previewEscToClose}
								</p>
							</div>
						</div>

						<div
							className={cn(
								'relative overflow-hidden shadow-(--desktop-shadow-panel)',
								getDesktopShellContentPanelClassName(shellFrame),
								embedded ? 'min-h-[min(360px,50vh)]' : 'min-h-200'
							)}
						>
							<div
								className={cn(
									'text-(--desktop-text-primary)',
									embedded ? 'p-4' : 'p-8 sm:p-12'
								)}
							>
								<div
									className={docPreviewProseClassName}
									// biome-ignore lint/security/noDangerouslySetInnerHtml: Live preview HTML derived from editor content pipeline
									dangerouslySetInnerHTML={{
										__html: previewHtml,
									}}
								/>
							</div>
						</div>
					</div>
				</div>
			) : null}

			{eastDocPanelOpen ? (
				<Suspense
					fallback={
						<div className="min-h-0 min-w-0 overflow-y-auto border-l border-(--desktop-border-subtle) p-4">
							<DesktopAppPanel>
								<DesktopAppEmptyState
									title={labels.eastPanelLoadingTitle}
									description={labels.eastPanelLoadingDesc}
									className="py-8"
								/>
							</DesktopAppPanel>
						</div>
					}
				>
					<div
						className={cn(
							'min-h-0 min-w-0 overflow-y-auto overscroll-y-contain scrollbar-gutter-stable',
							previewMode
								? 'col-start-4 row-start-1'
								: 'col-start-3 row-start-1',
							embedded
								? embeddedEastColumnClass
								: 'border-l border-(--desktop-border-subtle) bg-(--desktop-surface-panel)'
						)}
					>
						{aiPanelOpen ? (
							<AIAssistantPanel
								isOpen={aiPanelOpen}
								onClose={() => closePanel('ai')}
								selectedText={selectedText}
								documentText={aiDocumentContext}
								documentId={currentDocument?.id}
								fileManagerDocumentContext={aiFileManagerContext}
								onClearFileManagerDocumentContext={onClearAiFileManagerContext}
								onInsert={onAiInsert}
								onReplace={onAiReplace}
							/>
						) : (
							<ImageGenerationPanel
								isOpen={imageGenPanelOpen}
								layout="dock"
								onClose={() => closePanel('image')}
								onInsertImage={onImageInsert}
							/>
						)}
					</div>
				</Suspense>
			) : null}
			<div
				className={cn(
					'col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col overflow-hidden',
					embedded
						? getDesktopShellNavRailClassName(shellFrame)
						: DOC_EDITOR_SIDEBAR_OUTER_CLASS
				)}
				data-doc-guide="editor-panel-rail-column"
			>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-gutter-stable">
					<EditorPanelSidebar
						panelOpen={panelOpenForSidebar}
						onTogglePanel={onToggleSidebarPanel}
						onVoiceDictateInsert={onVoiceDictateInsert}
					/>
				</div>
			</div>
		</div>
	);
};
