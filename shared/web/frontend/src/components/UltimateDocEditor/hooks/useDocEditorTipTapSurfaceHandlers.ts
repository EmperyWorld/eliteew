/**
 * Колбэки поверхности редактора: onSelectionUpdate/onReady, шаблоны, scroll FAB.
 * Document change/flush — в `useDocEditorEditorHtmlStoreSync` (versioned pipeline).
 */

import type { Editor } from '@tiptap/react';
import {
	useCallback,
	type Dispatch,
	type MutableRefObject,
	type RefObject,
	type SetStateAction,
} from 'react';

import type { DocumentTemplate } from '../types/editor.types';
import type { DocEditorSelectionRange } from '../utils/runtimeDialogEvents';
import type { DocEditorOracleSnapshot } from '../utils/docEditorOracleSnapshot';
import { agentDebugLog } from '../utils/agentDebugLog';

export interface UseDocEditorTipTapSurfaceHandlersParams {
	setSelectedText: (text: string) => void;
	setEditorSelectionRange: Dispatch<
		SetStateAction<DocEditorSelectionRange | null>
	>;
	lastSelectionRef: MutableRefObject<{
		text: string;
		from: number | null;
		to: number | null;
	}>;
	lastCollabCursorRef: MutableRefObject<{
		line: number;
		column: number;
		sentAt: number;
	} | null>;
	collabUpdateCursor: (position: { line: number; column: number }) => void;

	setTiptapEditor: Dispatch<SetStateAction<Editor | null>>;
	initIncrementalStatsFromEditor: (editor: Editor) => void;
	commitOracleHtmlSnapshot: (html: string) => DocEditorOracleSnapshot;
	markdownModeRef: MutableRefObject<boolean>;
	applyPendingInsertToEditorRef: MutableRefObject<(editor: Editor) => void>;

	convertMarkdownToHtml: (md: string) => Promise<string>;
	setMarkdownMode: Dispatch<SetStateAction<boolean>>;
	setMarkdownSource: Dispatch<SetStateAction<string>>;
	setMarkdownEdited: Dispatch<SetStateAction<boolean>>;
	tiptapEditor: Editor | null;
	markdownBaselineRef: MutableRefObject<string>;
	markdownOriginalHtmlRef: MutableRefObject<string>;

	editorScrollContainerRef: RefObject<HTMLDivElement | null>;
}

export interface UseDocEditorTipTapSurfaceHandlersResult {
	handleSelectionUpdate: (
		text: string,
		position?: { from: number; to: number; line?: number; column?: number }
	) => void;
	handleEditorReady: (editor: Editor) => void;
	handleEditorUnmounted: () => void;
	handleCreateFromTemplate: (
		template: DocumentTemplate,
		mode?: 'replace' | 'insert' | 'append'
	) => Promise<void>;
	handleScrollToDocumentTop: () => void;
	handleScrollToDocumentBottom: () => void;
}

export function useDocEditorTipTapSurfaceHandlers(
	params: UseDocEditorTipTapSurfaceHandlersParams
): UseDocEditorTipTapSurfaceHandlersResult {
	const {
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
	} = params;

	const handleSelectionUpdate = useCallback(
		(
			text: string,
			position?: { from: number; to: number; line?: number; column?: number }
		) => {
			const nextFrom =
				position?.from != null &&
				position?.to != null &&
				position.from !== position.to
					? position.from
					: null;
			const nextTo =
				position?.from != null &&
				position?.to != null &&
				position.from !== position.to
					? position.to
					: null;

			const prev = lastSelectionRef.current;
			if (prev.text !== text) {
				setSelectedText(text);
			}
			if (prev.from !== nextFrom || prev.to !== nextTo) {
				if (nextFrom != null && nextTo != null) {
					setEditorSelectionRange({ from: nextFrom, to: nextTo });
				} else {
					setEditorSelectionRange(null);
				}
			}
			lastSelectionRef.current = { text, from: nextFrom, to: nextTo };

			if (
				position?.line != null &&
				position?.column != null &&
				collabUpdateCursor
			) {
				const now = Date.now();
				const last = lastCollabCursorRef.current;
				const changed =
					!last ||
					last.line !== position.line ||
					last.column !== position.column;
				const shouldSend = changed || !last || now - last.sentAt >= 120;
				if (shouldSend) {
					collabUpdateCursor({ line: position.line, column: position.column });
					lastCollabCursorRef.current = {
						line: position.line,
						column: position.column,
						sentAt: now,
					};
				}
			}
		},
		[
			setSelectedText,
			setEditorSelectionRange,
			collabUpdateCursor,
			lastSelectionRef,
			lastCollabCursorRef,
		]
	);

	const handleEditorReady = useCallback(
		(editor: Editor): void => {
			agentDebugLog({
				hypothesisId: 'H5',
				location: 'UltimateDocEditor.tsx:handleEditorReady',
				message: 'tiptap onEditorReady',
				data: { docSize: editor.state.doc.content.size },
				runId: 'pre-fix',
			});
			setTiptapEditor(editor);
			initIncrementalStatsFromEditor(editor);
			commitOracleHtmlSnapshot(editor.getHTML());
			queueMicrotask(() => {
				if (markdownModeRef.current) {
					return;
				}
				applyPendingInsertToEditorRef.current(editor);
			});
		},
		[
			commitOracleHtmlSnapshot,
			initIncrementalStatsFromEditor,
			markdownModeRef,
			applyPendingInsertToEditorRef,
			setTiptapEditor,
		]
	);

	const handleEditorUnmounted = useCallback((): void => {
		setTiptapEditor(null);
	}, [setTiptapEditor]);

	const handleCreateFromTemplate = useCallback(
		async (
			template: DocumentTemplate,
			mode: 'replace' | 'insert' | 'append' = 'replace'
		): Promise<void> => {
			const html = await convertMarkdownToHtml(template.content);
			const nextHtml = html || '<p></p>';

			if (mode === 'insert' && tiptapEditor) {
				tiptapEditor.chain().focus().insertContent(nextHtml).run();
				commitOracleHtmlSnapshot(tiptapEditor.getHTML());
				return;
			}

			if (mode === 'append' && tiptapEditor) {
				tiptapEditor
					.chain()
					.focus('end')
					.insertContent(`<p></p>${nextHtml}`)
					.run();
				commitOracleHtmlSnapshot(tiptapEditor.getHTML());
				return;
			}

			setMarkdownMode(false);
			setMarkdownSource('');
			setMarkdownEdited(false);
			markdownOriginalHtmlRef.current = nextHtml;
			markdownBaselineRef.current = template.content;

			commitOracleHtmlSnapshot(nextHtml);

			if (tiptapEditor) {
				tiptapEditor.commands.setContent(nextHtml, { emitUpdate: true });
				tiptapEditor.commands.focus('end');
			}
		},
		[
			convertMarkdownToHtml,
			commitOracleHtmlSnapshot,
			setMarkdownEdited,
			setMarkdownMode,
			setMarkdownSource,
			tiptapEditor,
			markdownBaselineRef,
			markdownOriginalHtmlRef,
		]
	);

	const handleScrollToDocumentTop = useCallback((): void => {
		editorScrollContainerRef.current?.scrollTo({
			top: 0,
			left: 0,
			behavior: 'smooth',
		});
	}, [editorScrollContainerRef]);

	const handleScrollToDocumentBottom = useCallback((): void => {
		const node = editorScrollContainerRef.current;
		if (!node) {
			return;
		}
		node.scrollTo({ top: node.scrollHeight, left: 0, behavior: 'smooth' });
	}, [editorScrollContainerRef]);

	return {
		handleSelectionUpdate,
		handleEditorReady,
		handleEditorUnmounted,
		handleCreateFromTemplate,
		handleScrollToDocumentTop,
		handleScrollToDocumentBottom,
	};
}
