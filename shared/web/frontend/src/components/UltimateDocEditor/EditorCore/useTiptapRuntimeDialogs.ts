/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime dialog and color-picker wiring for Ultimate Doc Editor TipTap — link/image/formula
 * inserts, DOC_EDITOR_RUNTIME_DIALOG_EVENT listener, and bubble-menu color shortcuts.
 *
 * Invariants:
 * - Opening a runtime dialog closes the context menu (setContextMenuOpen(false)).
 * - Color picker applies to pendingColorRange when set, else current selection.
 *
 * Related:
 * - TiptapEditorInner.tsx, runtimeDialogEvents.ts
 */
import type { Editor } from '@tiptap/react';
import {
	useCallback,
	useEffect,
	useState,
	type Dispatch,
	type MouseEvent,
	type SetStateAction,
} from 'react';
import { normalizeInlineMathLatex } from '../utils/normalizeMathLatex';
import { shortenDataUrlForImageInsert } from '../utils/shortenDataUrlForImageInsert';
import {
	DOC_EDITOR_RUNTIME_DIALOG_EVENT,
	type DocEditorRuntimeDialogRequest,
	type DocEditorSelectionRange,
} from '../utils/runtimeDialogEvents';

type EditorInsertDialogRequest = Extract<
	DocEditorRuntimeDialogRequest,
	{ type: 'link' | 'image' | 'formula' }
>;

export interface UseTiptapRuntimeDialogsOptions {
	editor: Editor | null;
	setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
}

export interface UseTiptapRuntimeDialogsResult {
	colorPickerOpen: 'text' | 'highlight' | null;
	colorPickerPosition: { x: number; y: number };
	runtimeDialogRequest: EditorInsertDialogRequest | null;
	closeColorPicker: () => void;
	applyPendingTextColor: (color: string) => void;
	applyPendingHighlightColor: (color: string) => void;
	handleRuntimeLinkSubmit: (url: string, text: string) => void;
	handleRuntimeImageSubmit: (url: string, alt: string) => void;
	handleRuntimeFormulaSubmit: (value: string) => void;
	closeRuntimeDialog: () => void;
	handleBubbleOpenTextColor: (event: MouseEvent<HTMLButtonElement>) => void;
	handleBubbleOpenHighlightColor: (
		event: MouseEvent<HTMLButtonElement>
	) => void;
	handleBubbleOpenLink: () => void;
}

export function useTiptapRuntimeDialogs({
	editor,
	setContextMenuOpen,
}: UseTiptapRuntimeDialogsOptions): UseTiptapRuntimeDialogsResult {
	const [colorPickerOpen, setColorPickerOpen] = useState<
		'text' | 'highlight' | null
	>(null);
	const [colorPickerPosition, setColorPickerPosition] = useState({
		x: 0,
		y: 0,
	});
	const [pendingColorRange, setPendingColorRange] =
		useState<DocEditorSelectionRange | null>(null);
	const [runtimeDialogRequest, setRuntimeDialogRequest] =
		useState<EditorInsertDialogRequest | null>(null);

	const getCurrentSelectionRange = useCallback(():
		| DocEditorSelectionRange
		| undefined => {
		if (!editor || editor.state.selection.empty) {
			return undefined;
		}

		return {
			from: editor.state.selection.from,
			to: editor.state.selection.to,
		};
	}, [editor]);

	const getSelectedTextForRange = useCallback(
		(range?: DocEditorSelectionRange): string => {
			if (!editor || !range || range.from === range.to) {
				return '';
			}

			return editor.state.doc.textBetween(range.from, range.to);
		},
		[editor]
	);

	const closeColorPicker = useCallback(() => {
		setColorPickerOpen(null);
		setPendingColorRange(null);
	}, []);

	const closeRuntimeDialog = useCallback(() => {
		setRuntimeDialogRequest(null);
	}, []);

	const openRuntimeDialog = useCallback(
		(request: DocEditorRuntimeDialogRequest) => {
			if (!editor) {
				return;
			}

			const resolvedRange = request.range ?? getCurrentSelectionRange();
			setContextMenuOpen(false);

			if (request.type === 'textColor' || request.type === 'highlightColor') {
				setPendingColorRange(resolvedRange ?? null);
				setColorPickerPosition(request.position);
				setColorPickerOpen(request.type === 'textColor' ? 'text' : 'highlight');
				return;
			}

			if (request.type === 'link') {
				setRuntimeDialogRequest({
					type: 'link',
					range: resolvedRange,
					initialUrl: request.initialUrl,
					initialText: request.initialText,
					selectedText:
						request.selectedText ?? getSelectedTextForRange(resolvedRange),
				});
				return;
			}

			if (request.type === 'image') {
				setRuntimeDialogRequest({
					type: 'image',
					range: resolvedRange,
					initialUrl: request.initialUrl,
					initialAlt: request.initialAlt,
				});
				return;
			}

			if (request.type === 'formula') {
				setRuntimeDialogRequest({
					type: 'formula',
					range: resolvedRange,
					initialValue: request.initialValue,
				});
			}
		},
		[
			editor,
			getCurrentSelectionRange,
			getSelectedTextForRange,
			setContextMenuOpen,
		]
	);

	useEffect(() => {
		const handleRuntimeDialogRequest = (event: Event): void => {
			const detail = (event as CustomEvent<DocEditorRuntimeDialogRequest>)
				.detail;
			if (!detail) {
				return;
			}

			openRuntimeDialog(detail);
		};

		window.addEventListener(
			DOC_EDITOR_RUNTIME_DIALOG_EVENT,
			handleRuntimeDialogRequest
		);
		return (): void => {
			window.removeEventListener(
				DOC_EDITOR_RUNTIME_DIALOG_EVENT,
				handleRuntimeDialogRequest
			);
		};
	}, [openRuntimeDialog]);

	const applyPendingTextColor = useCallback(
		(color: string) => {
			if (!editor) {
				return;
			}

			const chain = editor.chain().focus();
			if (pendingColorRange) {
				chain.setTextSelection(pendingColorRange);
			}
			chain.setColor(color).run();
			closeColorPicker();
		},
		[closeColorPicker, editor, pendingColorRange]
	);

	const applyPendingHighlightColor = useCallback(
		(color: string) => {
			if (!editor) {
				return;
			}

			const chain = editor.chain().focus();
			if (pendingColorRange) {
				chain.setTextSelection(pendingColorRange);
			}
			chain.toggleHighlight({ color }).run();
			closeColorPicker();
		},
		[closeColorPicker, editor, pendingColorRange]
	);

	const handleRuntimeLinkSubmit = useCallback(
		(url: string, text: string) => {
			if (
				!editor ||
				!runtimeDialogRequest ||
				runtimeDialogRequest.type !== 'link'
			) {
				return;
			}

			const selectedText = runtimeDialogRequest.selectedText?.trim() ?? '';
			const finalText = text.trim() || selectedText || url;
			const range = runtimeDialogRequest.range;
			const chain = editor.chain().focus();

			if (range && range.from !== range.to) {
				if (selectedText && finalText === selectedText) {
					chain.setTextSelection(range).setLink({ href: url }).run();
				} else {
					chain
						.deleteRange(range)
						.insertContent({
							type: 'text',
							text: finalText,
							marks: [{ type: 'link', attrs: { href: url } }],
						})
						.run();
				}
			} else {
				chain
					.insertContent({
						type: 'text',
						text: finalText,
						marks: [{ type: 'link', attrs: { href: url } }],
					})
					.run();
			}

			setRuntimeDialogRequest(null);
		},
		[editor, runtimeDialogRequest]
	);

	const handleRuntimeImageSubmit = useCallback(
		(url: string, alt: string) => {
			if (
				!editor ||
				!runtimeDialogRequest ||
				runtimeDialogRequest.type !== 'image'
			) {
				return;
			}

			const chain = editor.chain().focus();
			if (runtimeDialogRequest.range) {
				chain.deleteRange(runtimeDialogRequest.range);
			}
			chain
				.setImage({ src: shortenDataUrlForImageInsert(url.trim()), alt })
				.run();
			setRuntimeDialogRequest(null);
		},
		[editor, runtimeDialogRequest]
	);

	const handleRuntimeFormulaSubmit = useCallback(
		(value: string) => {
			if (
				!editor ||
				!runtimeDialogRequest ||
				runtimeDialogRequest.type !== 'formula'
			) {
				return;
			}

			const latex = normalizeInlineMathLatex(value);
			if (!latex) {
				setRuntimeDialogRequest(null);
				return;
			}

			const chain = editor.chain().focus();
			if (runtimeDialogRequest.range) {
				chain.deleteRange(runtimeDialogRequest.range);
			}
			chain
				.insertContent({
					type: 'inlineMath',
					attrs: { latex },
				})
				.run();
			setRuntimeDialogRequest(null);
		},
		[editor, runtimeDialogRequest]
	);

	const handleBubbleOpenTextColor = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			const rect = event.currentTarget.getBoundingClientRect();
			setPendingColorRange(getCurrentSelectionRange() ?? null);
			setColorPickerPosition({ x: rect.left, y: rect.bottom + 8 });
			setColorPickerOpen('text');
		},
		[getCurrentSelectionRange]
	);

	const handleBubbleOpenHighlightColor = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			const rect = event.currentTarget.getBoundingClientRect();
			setPendingColorRange(getCurrentSelectionRange() ?? null);
			setColorPickerPosition({ x: rect.left, y: rect.bottom + 8 });
			setColorPickerOpen('highlight');
		},
		[getCurrentSelectionRange]
	);

	const handleBubbleOpenLink = useCallback(() => {
		if (!editor) {
			return;
		}
		const range = getCurrentSelectionRange();
		const selectedText = getSelectedTextForRange(range);
		openRuntimeDialog({
			type: 'link',
			range,
			initialUrl: editor.getAttributes('link').href || '',
			initialText: selectedText,
			selectedText,
		});
	}, [
		editor,
		getCurrentSelectionRange,
		getSelectedTextForRange,
		openRuntimeDialog,
	]);

	return {
		colorPickerOpen,
		colorPickerPosition,
		runtimeDialogRequest,
		closeColorPicker,
		applyPendingTextColor,
		applyPendingHighlightColor,
		handleRuntimeLinkSubmit,
		handleRuntimeImageSubmit,
		handleRuntimeFormulaSubmit,
		closeRuntimeDialog,
		handleBubbleOpenTextColor,
		handleBubbleOpenHighlightColor,
		handleBubbleOpenLink,
	};
}
