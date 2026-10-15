/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inner TipTap editor shell for Ultimate Doc Editor — useEditor wiring, gutter layout,
 * context menu, runtime dialogs, comment anchors, and floating chrome.
 *
 * Invariants:
 * - ПКМ по активному выделению не схлопывает selection (контекстное меню «Вырезать/Копировать»).
 * - Full-document HTML serialization is debounced; blur flushes the pending update.
 * - When collaboration is on, Y.Doc is source of truth — initialContent sync is skipped.
 *
 * Related:
 * - TiptapEditor.tsx, createCoreTiptapExtensions.ts, useTiptapGutterLayout.ts
 */
import { type AnyExtension } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { CodeBracketSquareIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import {
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import type { TiptapEditorProps } from '../types/editor.types';
import { DOC_EDITOR_TIPTAP_WRAPPER_CLASS } from '../chrome/docEditorCanvasChrome';
import {
	markDocEditorInitialContentSynced,
	markDocEditorInitialContentSyncedIfEquivalent,
	shouldSuppressStaleEditorInitialContentSync,
} from '../utils/docEditorInitialContentSync';
import { getTiptapEditorRootClassName } from '../utils/tiptapProseThemeClass';
import { createCoreTiptapExtensions } from './createCoreTiptapExtensions';
import {
	buildTiptapSelectionRangeSignature,
	shouldSkipTiptapSelectionWork,
} from './tiptapPerformanceGuards';
import { TiptapAnchorQuickMenu } from './TiptapAnchorQuickMenu';
import { TiptapBubbleMenu } from './TiptapBubbleMenu';
import { TiptapEditorProseStyles } from './tiptapEditorProseStyles';
import { TiptapFloatingMenu } from './TiptapFloatingMenu';
import { TiptapLineGutter } from './TiptapLineGutter';
import { TIPTAP_FLOATING_UI_OPTIONS } from './tiptapFloatingUiOptions';
import { useTiptapCommentAnchors } from './useTiptapCommentAnchors';
import { useTiptapGutterLayout } from './useTiptapGutterLayout';
import { useTiptapRuntimeDialogs } from './useTiptapRuntimeDialogs';

const EditorContextMenu = lazy(() =>
	import('../components/EditorContextMenu').then((module) => ({
		default: module.EditorContextMenu,
	}))
);
const ColorPicker = lazy(() =>
	import('../components/ColorPicker').then((module) => ({
		default: module.ColorPicker,
	}))
);
const RuntimeImageDialog = lazy(() =>
	import('../components/dialogs/RuntimeImageDialog').then((module) => ({
		default: module.RuntimeImageDialog,
	}))
);
const RuntimeLinkDialog = lazy(() =>
	import('../components/dialogs/RuntimeLinkDialog').then((module) => ({
		default: module.RuntimeLinkDialog,
	}))
);
const RuntimeTextPromptDialog = lazy(() =>
	import('../components/dialogs/RuntimeTextPromptDialog').then((module) => ({
		default: module.RuntimeTextPromptDialog,
	}))
);

export interface TiptapEditorInnerProps extends TiptapEditorProps {
	optionalExtensions: AnyExtension[];
	collaborationExtensions?: AnyExtension[];
}

export const TiptapEditorInner: React.FC<TiptapEditorInnerProps> = ({
	initialContent = '',
	editable = true,
	documentId,
	documentSyncKey = '',
	shellWindowStyle,
	desktopUiScale = 1,
	commentJumpFlashToken,
	commentAnchors = [],
	commentAnchorMeta = {},
	activeCommentThreadId = null,
	onCommentAnchorAction,
	onCommentAnchorClick,
	activeCollaborators = [],
	optionalExtensions,
	collaborationExtensions = [],
	onDocumentChange,
	onDocumentFlush,
	onUpdate,
	onSelectionUpdate,
	onEditorReady,
	onEditorUnmounted,
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const editorPlaceholder = t('editorPlaceholder');
	const [emptyOnboardingDismissed, setEmptyOnboardingDismissed] =
		useState(false);
	const [contextMenuOpen, setContextMenuOpen] = useState(false);
	const [contextMenuPosition, setContextMenuPosition] = useState({
		x: 0,
		y: 0,
	});
	const [floatingChromePaused, setFloatingChromePaused] = useState(false);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	const hasCollab = collaborationExtensions.length > 0;

	const shellTheme = useDesktopShellTheme();
	const editorRootClassName = useMemo(
		() => getTiptapEditorRootClassName(shellTheme),
		[shellTheme]
	);

	const onDocumentChangeRef = useRef(onDocumentChange);
	const onDocumentFlushRef = useRef(onDocumentFlush);
	const onUpdateRef = useRef(onUpdate);
	const onSelectionUpdateRef = useRef(onSelectionUpdate);
	const lastSelectionRangeSignatureRef = useRef<string>('');

	useEffect(() => {
		onDocumentChangeRef.current = onDocumentChange;
		onDocumentFlushRef.current = onDocumentFlush;
		onUpdateRef.current = onUpdate;
		onSelectionUpdateRef.current = onSelectionUpdate;
		return () => {
			onDocumentChangeRef.current = undefined;
			onDocumentFlushRef.current = undefined;
			onUpdateRef.current = undefined;
			onSelectionUpdateRef.current = undefined;
		};
	}, [onDocumentChange, onDocumentFlush, onUpdate, onSelectionUpdate]);

	useEffect(() => {
		let timeoutId = 0;
		const onResize = (): void => {
			setFloatingChromePaused(true);
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => {
				setFloatingChromePaused(false);
			}, 220);
		};
		window.addEventListener('resize', onResize, { passive: true });
		return (): void => {
			window.removeEventListener('resize', onResize);
			window.clearTimeout(timeoutId);
		};
	}, []);

	const editor = useEditor(
		{
			extensions: createCoreTiptapExtensions({
				editorPlaceholder,
				hasCollab,
				optionalExtensions,
				collaborationExtensions,
			}),
			content: initialContent,
			editable,
			editorProps: {
				attributes: {
					class: getTiptapEditorRootClassName('dark'),
				},
			},
			onUpdate: ({ editor: ed, transaction }) => {
				if (onDocumentChangeRef.current) {
					onDocumentChangeRef.current({ editor: ed, transaction });
					return;
				}
				if (onUpdateRef.current && transaction.docChanged) {
					onUpdateRef.current(ed.getHTML());
				}
			},
			onSelectionUpdate: ({ editor: ed }) => {
				const { from, to } = ed.state.selection;
				const doc = ed.state.doc;
				const rangeSignature = buildTiptapSelectionRangeSignature({
					from,
					to,
					docContentSize: doc.content.size,
				});
				if (
					shouldSkipTiptapSelectionWork(
						lastSelectionRangeSignatureRef.current,
						rangeSignature
					)
				) {
					return;
				}
				lastSelectionRangeSignatureRef.current = rangeSignature;
				const text = doc.textBetween(from, to);
				let line = 1;
				let column = 1;
				if (doc.content.childCount > 0) {
					let pos = 1;
					for (let i = 0; i < doc.content.childCount; i++) {
						const node = doc.content.child(i);
						const end = pos + node.nodeSize;
						if (from >= pos && from < end) {
							line = i + 1;
							column = Math.max(1, from - pos + 1);
							break;
						}
						pos = end;
					}
				}
				onSelectionUpdateRef.current?.(text, { from, to, line, column });
			},
		},
		[
			collaborationExtensions,
			documentId,
			editorPlaceholder,
			hasCollab,
			optionalExtensions,
		]
	);

	useEffect(() => {
		if (!editor) return;
		lastSelectionRangeSignatureRef.current = '';
	}, [editor]);

	useEffect(() => {
		if (!editor) return;
		editor.setOptions({
			editorProps: {
				...editor.options.editorProps,
				attributes: {
					...editor.options.editorProps?.attributes,
					class: editorRootClassName,
				},
			},
		});
	}, [editor, editorRootClassName]);

	useEffect(() => {
		if (!editor || hasCollab) return;
		const currentHtml = editor.getHTML();
		const syncKey =
			documentSyncKey || (documentId != null ? String(documentId) : '');
		if (
			markDocEditorInitialContentSyncedIfEquivalent({
				incomingHtml: initialContent,
				currentHtml,
				documentSyncKey: syncKey,
				lastSyncedDocumentKeyRef,
			})
		) {
			return;
		}
		if (
			shouldSuppressStaleEditorInitialContentSync({
				isEditorFocused: editor.isFocused,
				incomingHtml: initialContent,
				currentHtml,
				documentSyncKey: syncKey,
				lastSyncedDocumentKeyRef,
			})
		) {
			return;
		}
		editor.commands.setContent(initialContent, { emitUpdate: false });
		markDocEditorInitialContentSynced(lastSyncedDocumentKeyRef, syncKey);
	}, [editor, initialContent, hasCollab, documentId, documentSyncKey]);

	useEffect(() => {
		setEmptyOnboardingDismissed(false);
	}, []);

	useEffect(() => {
		if (editor) {
			editor.setEditable(editable);
		}
	}, [editor, editable]);

	const hasNotifiedReady = useRef(false);
	const lastSyncedDocumentKeyRef = useRef<string | null>(null);
	const editorHostRef = useRef<HTMLDivElement | null>(null);

	const { visualLines, gutterHeight, gutterTrackTransitionEnabled } =
		useTiptapGutterLayout({
			editor,
			editorHostRef,
			onDocumentFlushRef,
		});

	const runtimeDialogs = useTiptapRuntimeDialogs({
		editor,
		setContextMenuOpen,
	});

	const commentAnchorsUi = useTiptapCommentAnchors({
		editor,
		editorHostRef,
		commentAnchors,
		commentAnchorMeta,
		activeCommentThreadId,
		commentJumpFlashToken,
		documentId,
		onCommentAnchorAction,
		onCommentAnchorClick,
	});

	useEffect(() => {
		if (!editor || (editor as { isDestroyed?: boolean }).isDestroyed) {
			hasNotifiedReady.current = false;
			return;
		}
		if (hasNotifiedReady.current) {
			return;
		}
		if (typeof onEditorReady === 'function') {
			onEditorReady(editor);
		}
		hasNotifiedReady.current = true;
	}, [editor, onEditorReady]);

	useEffect(() => {
		if (!editor) {
			return;
		}
		return () => {
			onEditorUnmounted?.();
		};
	}, [editor, onEditorUnmounted]);

	const shouldPreserveContextMenuSelection = useCallback(
		(clientX: number, clientY: number): boolean => {
			if (!editor) {
				return false;
			}
			const { selection } = editor.state;
			if (selection.empty || selection.from >= selection.to) {
				return false;
			}
			const coords = editor.view.posAtCoords({
				left: clientX,
				top: clientY,
			});
			if (!coords) {
				return true;
			}
			return coords.pos >= selection.from && coords.pos <= selection.to;
		},
		[editor]
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			if (!editable || !editor) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();

			const target = event.target as HTMLElement | null;
			const dom = editor.view.dom;

			const imgEl = target?.closest?.('img');
			if (imgEl && dom.contains(imgEl)) {
				try {
					const pos = editor.view.posAtDOM(imgEl as Node, 0);
					if (typeof pos === 'number') {
						editor.chain().focus().setNodeSelection(pos).run();
					}
				} catch {
					/* ignore ambiguous DOM */
				}
			} else {
				const anchorEl = target?.closest?.('a');
				if (anchorEl && dom.contains(anchorEl)) {
					try {
						const pos = editor.view.posAtDOM(anchorEl as Node, 0);
						if (typeof pos === 'number') {
							editor.chain().focus().setTextSelection(pos).run();
						}
					} catch {
						/* ignore */
					}
				} else if (
					shouldPreserveContextMenuSelection(event.clientX, event.clientY)
				) {
					if (!editor.view.hasFocus()) {
						editor.chain().focus().run();
					}
				} else {
					const coords = editor.view.posAtCoords({
						left: event.clientX,
						top: event.clientY,
					});
					if (coords) {
						editor.chain().focus().setTextSelection(coords.pos).run();
					} else {
						editor.chain().focus().run();
					}
				}
			}

			setContextMenuPosition({ x: event.clientX, y: event.clientY });
			setContextMenuOpen(true);
		},
		[editable, editor, shouldPreserveContextMenuSelection]
	);

	const showEmptyOnboarding =
		Boolean(editor) &&
		editable &&
		!(editor?.getText() ?? '').replace(/\u00a0/g, ' ').trim() &&
		!emptyOnboardingDismissed;

	if (!editor) {
		return (
			<DesktopAppPanel className="flex h-64 items-center justify-center">
				<DesktopAppEmptyState
					title={t('loadingEditorTitle')}
					description={t('loadingEditorDesc')}
				/>
			</DesktopAppPanel>
		);
	}

	return (
		<DesktopAppPanel
			className={DOC_EDITOR_TIPTAP_WRAPPER_CLASS}
			onContextMenu={handleContextMenu}
		>
			{showEmptyOnboarding ? (
				<section
					className="shrink-0 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-accent)_12%,var(--desktop-surface-soft))] px-4 py-3"
					aria-label={t('shell.onboarding.emptyTitle')}
				>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm text-(--desktop-text-secondary)">
							<span className="font-semibold text-(--desktop-text-primary)">
								{t('shell.onboarding.emptyTitle')}
							</span>{' '}
							{t('shell.onboarding.emptyBody')}
						</p>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="shrink-0 self-start sm:self-center"
							onClick={() => setEmptyOnboardingDismissed(true)}
						>
							{t('shell.onboarding.dismiss')}
						</DesktopAppButton>
					</div>
				</section>
			) : null}
			<TiptapBubbleMenu
				editor={editor}
				floatingChromePaused={floatingChromePaused}
				floatingUiOptions={TIPTAP_FLOATING_UI_OPTIONS}
				onOpenTextColor={runtimeDialogs.handleBubbleOpenTextColor}
				onOpenHighlightColor={runtimeDialogs.handleBubbleOpenHighlightColor}
				onOpenLink={runtimeDialogs.handleBubbleOpenLink}
			/>

			<TiptapFloatingMenu
				editor={editor}
				floatingChromePaused={floatingChromePaused}
				floatingUiOptions={TIPTAP_FLOATING_UI_OPTIONS}
			/>

			<div className="flex min-h-0 flex-1">
				<TiptapLineGutter
					visualLines={visualLines}
					gutterHeight={gutterHeight}
					gutterTrackTransitionEnabled={gutterTrackTransitionEnabled}
					activeCollaborators={activeCollaborators}
				/>
				<div
					ref={editorHostRef}
					className="min-h-0 min-w-0 flex-1"
					onClickCapture={commentAnchorsUi.handleEditorClickCapture}
				>
					<EditorContent editor={editor} />
				</div>
			</div>

			{contextMenuOpen ? (
				<Suspense fallback={null}>
					<EditorContextMenu
						editor={editor}
						isOpen={contextMenuOpen}
						position={contextMenuPosition}
						onClose={() => setContextMenuOpen(false)}
						shellWindowStyle={shellWindowStyle}
						desktopUiScale={desktopUiScale}
					/>
				</Suspense>
			) : null}
			{runtimeDialogs.runtimeDialogRequest?.type === 'link' ? (
				<Suspense fallback={null}>
					<RuntimeLinkDialog
						isOpen
						onClose={runtimeDialogs.closeRuntimeDialog}
						onSubmit={runtimeDialogs.handleRuntimeLinkSubmit}
						initialUrl={runtimeDialogs.runtimeDialogRequest.initialUrl}
						initialText={runtimeDialogs.runtimeDialogRequest.initialText}
						selectedText={runtimeDialogs.runtimeDialogRequest.selectedText}
					/>
				</Suspense>
			) : null}
			{runtimeDialogs.runtimeDialogRequest?.type === 'image' ? (
				<Suspense fallback={null}>
					<RuntimeImageDialog
						isOpen
						onClose={runtimeDialogs.closeRuntimeDialog}
						onSubmit={runtimeDialogs.handleRuntimeImageSubmit}
						initialUrl={runtimeDialogs.runtimeDialogRequest.initialUrl}
						initialAlt={runtimeDialogs.runtimeDialogRequest.initialAlt}
					/>
				</Suspense>
			) : null}
			{runtimeDialogs.runtimeDialogRequest?.type === 'formula' ? (
				<Suspense fallback={null}>
					<RuntimeTextPromptDialog
						isOpen
						onClose={runtimeDialogs.closeRuntimeDialog}
						onSubmit={runtimeDialogs.handleRuntimeFormulaSubmit}
						title={t('formulaDialog.title')}
						description={t('formulaDialog.description')}
						label={t('formulaDialog.label')}
						placeholder={t('formulaDialog.placeholder')}
						submitLabel={t('formulaDialog.submit')}
						initialValue={runtimeDialogs.runtimeDialogRequest.initialValue}
						icon={CodeBracketSquareIcon}
					/>
				</Suspense>
			) : null}
			{runtimeDialogs.colorPickerOpen ? (
				<Suspense fallback={null}>
					<ColorPicker
						type={runtimeDialogs.colorPickerOpen}
						currentColor={
							runtimeDialogs.colorPickerOpen === 'text'
								? editor.getAttributes('textStyle').color || '#000000'
								: editor.getAttributes('highlight').color || '#FFFF00'
						}
						onColorChange={
							runtimeDialogs.colorPickerOpen === 'text'
								? runtimeDialogs.applyPendingTextColor
								: runtimeDialogs.applyPendingHighlightColor
						}
						onClose={runtimeDialogs.closeColorPicker}
						position={runtimeDialogs.colorPickerPosition}
					/>
				</Suspense>
			) : null}
			{commentAnchorsUi.anchorQuickMenu ? (
				<TiptapAnchorQuickMenu
					anchorQuickMenu={commentAnchorsUi.anchorQuickMenu}
					embeddedModalZContent={embeddedModalZ.content}
					commentAnchorMeta={commentAnchorMeta}
					copiedThreadId={commentAnchorsUi.copiedThreadId}
					onOpenThread={commentAnchorsUi.handleOpenAnchorThread}
					onReplyThread={commentAnchorsUi.handleReplyAnchorThread}
					onResolveThread={commentAnchorsUi.handleResolveAnchorThread}
					onCopyThreadLink={commentAnchorsUi.handleCopyThreadLink}
					onDismiss={commentAnchorsUi.dismissAnchorQuickMenu}
				/>
			) : null}
			<TiptapEditorProseStyles />
		</DesktopAppPanel>
	);
};
