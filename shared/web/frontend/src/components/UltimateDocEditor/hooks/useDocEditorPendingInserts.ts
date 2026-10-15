/**
 * Отложенная вставка в TipTap (очередь, flush при готовности редактора, выход из Markdown).
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { PendingDocInsert } from '../types/pendingDocInsert';
import {
	buildChartFigureTiptapContent,
	svgToDataUriForEditor,
} from '../utils/chartRenderer';
import {
	resolveMediaUrlForEditor,
	sanitizeInsertionHtml,
} from '../utils/docEditorInsertion';
import { generateDocEditorTableHtml } from '../utils/htmlComparableText';
import { normalizeInlineMathLatex } from '../utils/normalizeMathLatex';
import { shortenDataUrlForImageInsert } from '../utils/shortenDataUrlForImageInsert';
import { agentDebugLog } from '../utils/agentDebugLog';

export interface UseDocEditorPendingInsertsParams {
	pendingDocInsertRef: MutableRefObject<PendingDocInsert | null>;
	tiptapEditor: Editor | null;
	markdownModeRef: MutableRefObject<boolean>;
	markSkipNextEditorInitialSync: () => void;
}

export interface UseDocEditorPendingInsertsResult {
	applyPendingInsertToEditorRef: MutableRefObject<(ed: Editor) => void>;
	applyPendingInsertToEditor: (ed: Editor) => void;
	flushPendingDocumentInsert: () => void;
}

export function useDocEditorPendingInserts(
	params: UseDocEditorPendingInsertsParams
): UseDocEditorPendingInsertsResult {
	const {
		pendingDocInsertRef,
		tiptapEditor,
		markdownModeRef,
		markSkipNextEditorInitialSync,
	} = params;

	const applyPendingInsertToEditorRef = useRef<(ed: Editor) => void>(() => {});

	const applyPendingInsertToEditor = useCallback(
		(ed: Editor): void => {
			const pending = pendingDocInsertRef.current;
			if (!pending) {
				return;
			}
			let formulaLatex: string | undefined;
			if (pending.kind === 'formula') {
				formulaLatex = normalizeInlineMathLatex(pending.latex);
				if (!formulaLatex) {
					return;
				}
			}
			pendingDocInsertRef.current = null;
			agentDebugLog({
				hypothesisId: 'H4',
				location: 'useDocEditorPendingInserts:applyPendingInsertToEditor',
				message: 'apply pending',
				data: { kind: pending.kind },
				runId: 'pre-fix',
			});
			switch (pending.kind) {
				case 'image': {
					const src = resolveMediaUrlForEditor(
						shortenDataUrlForImageInsert(pending.url)
					);
					ed.chain().focus().setImage({ src }).run();
					break;
				}
				case 'formula': {
					if (formulaLatex == null || formulaLatex === '') break;
					ed.chain()
						.focus()
						.insertContent({
							type: 'inlineMath',
							attrs: { latex: formulaLatex },
						})
						.run();
					break;
				}
				case 'diagram': {
					const svg = pending.svg.trim();
					if (!svg.startsWith('<svg')) {
						ed.chain()
							.focus()
							.insertContent(sanitizeInsertionHtml(pending.svg))
							.run();
						break;
					}
					const src = svgToDataUriForEditor(svg);
					ed.chain().focus().setImage({ src, alt: 'Diagram' }).run();
					break;
				}
				case 'chart': {
					ed.chain()
						.focus()
						.insertContent(buildChartFigureTiptapContent(pending.chartConfig))
						.run();
					break;
				}
				case 'pdfHtml': {
					const safe = sanitizeInsertionHtml(pending.html);
					ed.chain().focus().insertContent(safe).run();
					break;
				}
				case 'table': {
					const htmlTable = sanitizeInsertionHtml(
						generateDocEditorTableHtml(pending.tableData)
					);
					const ok = ed.chain().focus().insertContent(htmlTable).run();
					if (!ok) {
						ed.chain()
							.focus()
							.insertContent('<p></p>')
							.insertContent(htmlTable)
							.run();
					}
					break;
				}
				default: {
					const _exhaustive: never = pending;
					void _exhaustive;
				}
			}
			markSkipNextEditorInitialSync();
		},
		[pendingDocInsertRef, markSkipNextEditorInitialSync]
	);

	useEffect(() => {
		applyPendingInsertToEditorRef.current = applyPendingInsertToEditor;
	}, [applyPendingInsertToEditor]);

	const flushPendingDocumentInsert = useCallback((): void => {
		const pendingPeek = pendingDocInsertRef.current;
		if (!tiptapEditor || markdownModeRef.current) {
			agentDebugLog({
				hypothesisId: !tiptapEditor ? 'H1' : 'H3',
				location: 'useDocEditorPendingInserts:flushPendingDocumentInsert',
				message: 'flush skipped',
				data: {
					hasTiptap: Boolean(tiptapEditor),
					markdownMode: markdownModeRef.current,
					pendingKind: pendingPeek?.kind ?? null,
				},
				runId: 'pre-fix',
			});
		}
		if (!tiptapEditor || markdownModeRef.current) {
			return;
		}
		applyPendingInsertToEditor(tiptapEditor);
	}, [
		tiptapEditor,
		markdownModeRef,
		pendingDocInsertRef,
		applyPendingInsertToEditor,
	]);

	useEffect(() => {
		flushPendingDocumentInsert();
	}, [flushPendingDocumentInsert]);

	return {
		applyPendingInsertToEditorRef,
		applyPendingInsertToEditor,
		flushPendingDocumentInsert,
	};
}
