/**
 * Единый резолвер HTML для сохранения и автосохранения (в т.ч. Markdown → HTML).
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useRef, type MutableRefObject } from 'react';
import { isEffectivelyEmptyDocHtml } from '../utils/htmlComparableText';
import { safeEditorGetHtml } from '../utils/safeEditorGetHtml';

export interface UseDocEditorResolveHtmlForSaveParams {
	markdownMode: boolean;
	markdownEdited: boolean;
	markdownSource: string;
	convertMarkdownToHtml: (md: string) => Promise<string>;
	markdownOriginalHtmlRef: MutableRefObject<string>;
	currentDocumentContent: string | undefined;
	editorInitialContent: string;
	tiptapEditor: Editor | null;
	collabYjsBootstrapRef: MutableRefObject<boolean>;
}

export interface UseDocEditorResolveHtmlForSaveResult {
	resolveHtmlForSave: () => Promise<string>;
	resolveHtmlForSaveRef: MutableRefObject<() => Promise<string>>;
}

export function useDocEditorResolveHtmlForSave(
	params: UseDocEditorResolveHtmlForSaveParams
): UseDocEditorResolveHtmlForSaveResult {
	const {
		markdownMode,
		markdownEdited,
		markdownSource,
		convertMarkdownToHtml,
		markdownOriginalHtmlRef,
		currentDocumentContent,
		editorInitialContent,
		tiptapEditor,
		collabYjsBootstrapRef,
	} = params;

	const resolveHtmlForSave = useCallback(async (): Promise<string> => {
		if (markdownMode) {
			if (markdownEdited) {
				return await convertMarkdownToHtml(markdownSource);
			}
			return (
				markdownOriginalHtmlRef.current ||
				currentDocumentContent ||
				editorInitialContent ||
				'<p></p>'
			);
		}
		if (tiptapEditor) {
			if (tiptapEditor.isDestroyed) {
				return (currentDocumentContent ?? editorInitialContent) || '<p></p>';
			}
			const fromEditor = safeEditorGetHtml(tiptapEditor);
			if (fromEditor == null) {
				return (currentDocumentContent ?? editorInitialContent) || '<p></p>';
			}
			if (
				collabYjsBootstrapRef.current &&
				isEffectivelyEmptyDocHtml(fromEditor)
			) {
				const saved = currentDocumentContent ?? '';
				if (!isEffectivelyEmptyDocHtml(saved)) {
					return saved;
				}
			}
			return fromEditor;
		}
		return currentDocumentContent ?? '<p></p>';
	}, [
		markdownMode,
		markdownEdited,
		markdownSource,
		convertMarkdownToHtml,
		tiptapEditor,
		currentDocumentContent,
		editorInitialContent,
		markdownOriginalHtmlRef,
		collabYjsBootstrapRef,
	]);

	const resolveHtmlForSaveRef = useRef<() => Promise<string>>(
		async () => '<p></p>'
	);
	resolveHtmlForSaveRef.current = resolveHtmlForSave;

	return { resolveHtmlForSave, resolveHtmlForSaveRef };
}
