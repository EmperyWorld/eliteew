/**
 * Колбэки вставки в документ: AI, изображения, таблицы, формулы, диаграммы, PDF HTML, голос.
 * Очередь при Markdown / редактор ещё не готов — через pendingDocInsertRef + useDocEditorPendingInserts.
 */

import type { Editor } from '@tiptap/react';
import {
	useCallback,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import type { ChartConfig, DiagramConfig } from '../types/editor.types';
import type { PendingDocInsert } from '../types/pendingDocInsert';
import {
	buildChartFigureTiptapContent,
	svgToDataUriForEditor,
} from '../utils/chartRenderer';
import {
	resolveMediaUrlForEditor,
	sanitizeInsertionHtml,
} from '../utils/docEditorInsertion';
import {
	escapeHtmlForComparable,
	generateDocEditorTableHtml,
	type DocEditorTableData,
} from '../utils/htmlComparableText';
import { normalizeInlineMathLatex } from '../utils/normalizeMathLatex';
import { shortenDataUrlForImageInsert } from '../utils/shortenDataUrlForImageInsert';

export interface UseDocEditorInsertionHandlersParams {
	tiptapEditor: Editor | null;
	markdownMode: boolean;
	setMarkdownMode: Dispatch<SetStateAction<boolean>>;
	pendingDocInsertRef: MutableRefObject<PendingDocInsert | null>;
	markSkipNextEditorInitialSync: () => void;
}

export interface UseDocEditorInsertionHandlersResult {
	handleAIInsert: (text: string) => void;
	handleAIReplace: (text: string) => void;
	handleImageInsert: (imageUrl: string) => void;
	handleInsertText: (text: string) => void;
	handleInsertPdfHtml: (pdfHtml: string) => void;
	handleInsertVoiceDictation: (plainText: string) => void;
	handleInsertTable: (tableData: DocEditorTableData) => void;
	handleInsertFormula: (formula: { latex: string }) => void;
	handleInsertChart: (_chartHtml: string, chartConfig: ChartConfig) => void;
	handleInsertDiagram: (
		diagramSvg: string,
		diagramConfig?: DiagramConfig
	) => void;
}

export function useDocEditorInsertionHandlers(
	params: UseDocEditorInsertionHandlersParams
): UseDocEditorInsertionHandlersResult {
	const {
		tiptapEditor,
		markdownMode,
		setMarkdownMode,
		pendingDocInsertRef,
		markSkipNextEditorInitialSync,
	} = params;

	const handleAIInsert = useCallback(
		(text: string) => {
			if (tiptapEditor) {
				tiptapEditor.chain().focus().insertContent(text).run();
			}
		},
		[tiptapEditor]
	);

	const handleAIReplace = useCallback(
		(text: string) => {
			if (tiptapEditor) {
				tiptapEditor
					.chain()
					.focus()
					.deleteSelection()
					.insertContent(text)
					.run();
			}
		},
		[tiptapEditor]
	);

	const handleImageInsert = useCallback(
		(imageUrl: string) => {
			if (markdownMode) {
				pendingDocInsertRef.current = { kind: 'image', url: imageUrl };
				setMarkdownMode(false);
				return;
			}
			if (!tiptapEditor) {
				pendingDocInsertRef.current = { kind: 'image', url: imageUrl };
				return;
			}
			const src = resolveMediaUrlForEditor(
				shortenDataUrlForImageInsert(imageUrl)
			);
			tiptapEditor.chain().focus().setImage({ src }).run();
			markSkipNextEditorInitialSync();
		},
		[
			tiptapEditor,
			markdownMode,
			markSkipNextEditorInitialSync,
			setMarkdownMode,
			pendingDocInsertRef,
		]
	);

	const handleInsertText = useCallback(
		(text: string) => {
			if (tiptapEditor) {
				tiptapEditor.chain().focus().insertContent(text).run();
			}
		},
		[tiptapEditor]
	);

	/** HTML из панели PDF (ссылка на файл); не смешивать с plain-text вставкой. */
	const handleInsertPdfHtml = useCallback(
		(pdfHtml: string) => {
			if (markdownMode) {
				pendingDocInsertRef.current = { kind: 'pdfHtml', html: pdfHtml };
				setMarkdownMode(false);
				return;
			}
			if (!tiptapEditor) {
				pendingDocInsertRef.current = { kind: 'pdfHtml', html: pdfHtml };
				return;
			}
			const safe = sanitizeInsertionHtml(pdfHtml);
			tiptapEditor.chain().focus().insertContent(safe).run();
			markSkipNextEditorInitialSync();
		},
		[
			tiptapEditor,
			markdownMode,
			markSkipNextEditorInitialSync,
			setMarkdownMode,
			pendingDocInsertRef,
		]
	);

	/** Plain STT lines → safe HTML with breaks at cursor (same flow as ArlyQueen voice input). */
	const handleInsertVoiceDictation = useCallback(
		(plainText: string) => {
			if (!tiptapEditor) {
				return;
			}
			const trimmed = plainText.trim();
			if (!trimmed) {
				return;
			}
			const html = trimmed
				.split('\n')
				.map((line) => escapeHtmlForComparable(line))
				.join('<br>');
			tiptapEditor.chain().focus().insertContent(html).run();
		},
		[tiptapEditor]
	);

	const handleInsertTable = useCallback(
		(tableData: DocEditorTableData): void => {
			if (markdownMode) {
				pendingDocInsertRef.current = { kind: 'table', tableData };
				setMarkdownMode(false);
				return;
			}
			if (!tiptapEditor) {
				pendingDocInsertRef.current = { kind: 'table', tableData };
				return;
			}
			const htmlTable = sanitizeInsertionHtml(
				generateDocEditorTableHtml(tableData)
			);
			const ok = tiptapEditor.chain().focus().insertContent(htmlTable).run();
			if (!ok) {
				tiptapEditor
					.chain()
					.focus()
					.insertContent('<p></p>')
					.insertContent(htmlTable)
					.run();
			}
			markSkipNextEditorInitialSync();
		},
		[
			tiptapEditor,
			markdownMode,
			markSkipNextEditorInitialSync,
			setMarkdownMode,
			pendingDocInsertRef,
		]
	);

	const handleInsertFormula = useCallback(
		(formula: { latex: string }): void => {
			if (markdownMode) {
				pendingDocInsertRef.current = { kind: 'formula', latex: formula.latex };
				setMarkdownMode(false);
				return;
			}
			if (!tiptapEditor) {
				pendingDocInsertRef.current = { kind: 'formula', latex: formula.latex };
				return;
			}
			const latex = normalizeInlineMathLatex(formula.latex);
			if (!latex) {
				return;
			}
			tiptapEditor
				.chain()
				.focus()
				.insertContent({
					type: 'inlineMath',
					attrs: { latex },
				})
				.run();
			markSkipNextEditorInitialSync();
		},
		[
			tiptapEditor,
			markdownMode,
			markSkipNextEditorInitialSync,
			setMarkdownMode,
			pendingDocInsertRef,
		]
	);

	const handleInsertChart = useCallback(
		(_chartHtml: string, chartConfig: ChartConfig): void => {
			if (markdownMode) {
				pendingDocInsertRef.current = { kind: 'chart', chartConfig };
				setMarkdownMode(false);
				return;
			}
			if (!tiptapEditor) {
				pendingDocInsertRef.current = { kind: 'chart', chartConfig };
				return;
			}
			tiptapEditor
				.chain()
				.focus()
				.insertContent(buildChartFigureTiptapContent(chartConfig))
				.run();
			markSkipNextEditorInitialSync();
		},
		[
			tiptapEditor,
			markdownMode,
			markSkipNextEditorInitialSync,
			setMarkdownMode,
			pendingDocInsertRef,
		]
	);

	const handleInsertDiagram = useCallback(
		(diagramSvg: string, diagramConfig?: DiagramConfig): void => {
			if (markdownMode) {
				pendingDocInsertRef.current = {
					kind: 'diagram',
					svg: diagramSvg,
					diagramConfig,
				};
				setMarkdownMode(false);
				return;
			}
			if (!tiptapEditor) {
				pendingDocInsertRef.current = {
					kind: 'diagram',
					svg: diagramSvg,
					diagramConfig,
				};
				return;
			}
			const svg = diagramSvg.trim();
			if (!svg.startsWith('<svg')) {
				tiptapEditor
					.chain()
					.focus()
					.insertContent(sanitizeInsertionHtml(diagramSvg))
					.run();
				markSkipNextEditorInitialSync();
				return;
			}
			const src = svgToDataUriForEditor(svg);
			tiptapEditor.chain().focus().setImage({ src, alt: 'Diagram' }).run();
			markSkipNextEditorInitialSync();
		},
		[
			tiptapEditor,
			markdownMode,
			markSkipNextEditorInitialSync,
			setMarkdownMode,
			pendingDocInsertRef,
		]
	);

	return {
		handleAIInsert,
		handleAIReplace,
		handleImageInsert,
		handleInsertText,
		handleInsertPdfHtml,
		handleInsertVoiceDictation,
		handleInsertTable,
		handleInsertFormula,
		handleInsertChart,
		handleInsertDiagram,
	};
}
