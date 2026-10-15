/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content-stage compose for UltimateDocEditorInner — markdown mode, companion set-body
 * consumer, pending inserts, insertion handlers, and HTML resolve for save.
 *
 * Invariants:
 * - Companion set-body fanout and save HTML resolution contracts unchanged.
 *
 * Related:
 * - useUltimateDocEditorInnerBootstrapCompose.ts, useUltimateDocEditorInnerCompose.ts
 */

import type { useUltimateDocEditorInnerBootstrapCompose } from './useUltimateDocEditorInnerBootstrapCompose';
import { useCallback, useEffect } from 'react';
import { useDocEditorInsertionHandlers } from './useDocEditorInsertionHandlers';
import { useDocEditorMarkdownMode } from './useDocEditorMarkdownMode';
import { useDocEditorPendingInserts } from './useDocEditorPendingInserts';
import { useDocEditorResolveHtmlForSave } from './useDocEditorResolveHtmlForSave';
import { normalizeDocumentContentForEditor } from '../utils/ultimateDocEditorBootstrap';
import {
	registerDesktopDocEditorCompanionSetBodyConsumer,
	type DesktopDocEditorCompanionSetBodyDetail,
} from '@/pages/Desktop/utils/desktopDeepLink';

export function useUltimateDocEditorInnerContentCompose(
	bootstrap: ReturnType<typeof useUltimateDocEditorInnerBootstrapCompose>
) {
	const {
		t,
		currentDocument,
		isLoadingDocument,
		notifyError,
		currentContent,
		collaborationEnabledByUser,
		collaborationEnabledForEditor,
		collabYjsBootstrapRef,
		pendingDocInsertRef,
		updateStats,
		editorInitialContent,
		markSkipNextEditorInitialSync,
		tiptapEditor,
		setTiptapEditor,
		unifiedContentId,
		activeDocEditorTab,
	} = bootstrap;

	const {
		markdownMode,
		markdownModeRef,
		markdownSource,
		markdownEdited,
		renderedMarkdownPreview,
		markdownOriginalHtmlRef,
		markdownBaselineRef,
		setMarkdownMode,
		setMarkdownSource,
		setMarkdownEdited,
		setRenderedMarkdownPreview,
		convertMarkdownToHtml,
		handleMarkdownSourceChange,
		handleToggleMarkdownMode,
		resetMarkdownForDocumentSwitch,
	} = useDocEditorMarkdownMode({
		tiptapEditor,
		setTiptapEditor,
		editorInitialContent,
		currentDocumentContent: currentDocument?.content,
		currentContentHtml: currentContent?.html,
		loadedMarkdownSource: currentContent?.markdownSource,
		currentDocumentId: currentDocument?.id,
		storageFileName: currentContent?.storageFileName,
		isLoadingDocument,
		collaborationEnabledByUser,
		updateStats,
		onClearPendingDocInsert: () => {
			pendingDocInsertRef.current = null;
		},
	});

	const applyCompanionSetBody = useCallback(
		(raw: DesktopDocEditorCompanionSetBodyDetail) => {
			if (!raw || typeof raw.bodyHtml !== 'string') return;
			const trimmedHtml = raw.bodyHtml.trim();
			if (!trimmedHtml) return;

			const targetUc = (raw.unifiedContentId ?? '').trim();
			const windowUc =
				typeof unifiedContentId === 'string' ? unifiedContentId.trim() : '';
			const tabUc =
				activeDocEditorTab?.source === 'unifiedContent'
					? activeDocEditorTab.id.trim()
					: '';
			const effectiveUc = windowUc || tabUc;

			if (targetUc) {
				if (!effectiveUc || targetUc !== effectiveUc) {
					return;
				}
			}

			if (collaborationEnabledForEditor) {
				notifyError(
					t('header.companionSetBodyCollabBlockedTitle'),
					t('header.companionSetBodyCollabBlockedBody')
				);
				return;
			}

			resetMarkdownForDocumentSwitch();
			const normalized = normalizeDocumentContentForEditor(
				trimmedHtml,
				currentDocument?.content_type
			);
			updateStats(normalized);
		},
		[
			unifiedContentId,
			activeDocEditorTab,
			collaborationEnabledForEditor,
			currentDocument?.content_type,
			resetMarkdownForDocumentSwitch,
			updateStats,
			notifyError,
			t,
		]
	);

	useEffect(() => {
		return registerDesktopDocEditorCompanionSetBodyConsumer(
			applyCompanionSetBody
		);
	}, [applyCompanionSetBody]);

	const { applyPendingInsertToEditorRef } = useDocEditorPendingInserts({
		pendingDocInsertRef,
		tiptapEditor,
		markdownModeRef,
		markSkipNextEditorInitialSync,
	});

	const {
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
	} = useDocEditorInsertionHandlers({
		tiptapEditor,
		markdownMode,
		setMarkdownMode,
		pendingDocInsertRef,
		markSkipNextEditorInitialSync,
	});

	const { resolveHtmlForSave, resolveHtmlForSaveRef } =
		useDocEditorResolveHtmlForSave({
			markdownMode,
			markdownEdited,
			markdownSource,
			convertMarkdownToHtml,
			markdownOriginalHtmlRef,
			currentDocumentContent: currentDocument?.content,
			editorInitialContent,
			tiptapEditor,
			collabYjsBootstrapRef,
		});

	return {
		...bootstrap,
		markdownMode,
		markdownModeRef,
		markdownSource,
		markdownEdited,
		renderedMarkdownPreview,
		markdownOriginalHtmlRef,
		markdownBaselineRef,
		setMarkdownMode,
		setMarkdownSource,
		setMarkdownEdited,
		setRenderedMarkdownPreview,
		convertMarkdownToHtml,
		handleMarkdownSourceChange,
		handleToggleMarkdownMode,
		resetMarkdownForDocumentSwitch,
		applyCompanionSetBody,
		applyPendingInsertToEditorRef,
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
		resolveHtmlForSave,
		resolveHtmlForSaveRef,
	};
}
