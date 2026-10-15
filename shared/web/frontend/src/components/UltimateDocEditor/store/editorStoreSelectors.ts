/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Узкие селекторы Zustand для Ultimate Doc Editor — меньше лишних ререндеров оркестратора и панелей.
 *
 * Invariants:
 * - Селекторы — чистые функции `(state) => slice`; shallow-сравнение — на стороне вызова (`useShallow`).
 *
 * Related:
 * - `store/editorStoreContext.tsx`, `UltimateDocEditorInner.tsx`, `Panels/FileManagerPanel.tsx`
 */

import type { EditorStore } from './editorStore';

/** Документ, dirty/save/load и вкладки — для оркестратора inner. */
export function selectDocEditorInnerDocumentSlice(state: EditorStore) {
	return {
		currentDocument: state.currentDocument,
		isDirty: state.isDirty,
		isSaving: state.isSaving,
		isLoadingDocument: state.isLoadingDocument,
		error: state.error,
		lastSaved: state.lastSaved,
		selectedText: state.selectedText,
		documentSource: state.documentSource,
		docTabOrder: state.docTabOrder,
		docTabTitles: state.docTabTitles,
		docTabSessions: state.docTabSessions,
	};
}

/** Флаги открытых панелей и коллаб-участники. */
export function selectDocEditorInnerPanelSlice(state: EditorStore) {
	return {
		aiPanelOpen: state.aiPanelOpen,
		aiFileManagerContext: state.aiFileManagerContext,
		imageGenPanelOpen: state.imageGenPanelOpen,
		collabPanelOpen: state.collabPanelOpen,
		activeCollaborators: state.activeCollaborators,
		searchPanelOpen: state.searchPanelOpen,
		versionsPanelOpen: state.versionsPanelOpen,
	};
}

/** Стабильные action-ссылки store для inner (не меняются между рендерами). */
export function selectDocEditorInnerActionsSlice(state: EditorStore) {
	return {
		openAIPanel: state.openAIPanel,
		closeAIPanel: state.closeAIPanel,
		clearAiFileManagerContext: state.clearAiFileManagerContext,
		openImageGenPanel: state.openImageGenPanel,
		closeImageGenPanel: state.closeImageGenPanel,
		openCollabPanel: state.openCollabPanel,
		closeCollabPanel: state.closeCollabPanel,
		openSearchPanel: state.openSearchPanel,
		closeSearchPanel: state.closeSearchPanel,
		openVersionsPanel: state.openVersionsPanel,
		closeVersionsPanel: state.closeVersionsPanel,
		setContent: state.setContent,
		setSelectedText: state.setSelectedText,
		updateDocument: state.updateDocument,
		switchDocTab: state.switchDocTab,
		removeDocTab: state.removeDocTab,
		initDocTabsFromWindowPayload: state.initDocTabsFromWindowPayload,
	};
}

/** File Manager panel — список и CRUD без подписки на editor/AI state. */
export function selectFileManagerPanelSlice(state: EditorStore) {
	return {
		documents: state.documents,
		documentsTotal: state.documentsTotal,
		currentDocument: state.currentDocument,
		isLoading: state.isLoading,
		isLoadingMoreDocuments: state.isLoadingMoreDocuments,
		error: state.error,
		listDocuments: state.listDocuments,
		createDocument: state.createDocument,
		deleteDocument: state.deleteDocument,
		fileManagerListCompact: state.fileManagerListCompact,
		setFileManagerListCompact: state.setFileManagerListCompact,
		openAIPanelWithFileFromList: state.openAIPanelWithFileFromList,
	};
}

/** useDocument hook — CRUD без подписки на панели/AI. */
export function selectUseDocumentSlice(state: EditorStore) {
	return {
		currentDocument: state.currentDocument,
		isLoading: state.isLoading,
		error: state.error,
		createDocument: state.createDocument,
		loadDocument: state.loadDocument,
		updateDocument: state.updateDocument,
		deleteDocument: state.deleteDocument,
		listDocuments: state.listDocuments,
	};
}

/** useCollaboration — только список участников из store. */
export function selectCollaborationSlice(state: EditorStore) {
	return {
		activeCollaborators: state.activeCollaborators,
	};
}

/** useComfyUI — генерация изображений. */
export function selectComfyUISlice(state: EditorStore) {
	return {
		isGeneratingImage: state.isGeneratingImage,
		generatedImages: state.generatedImages,
		error: state.error,
		generateImage: state.generateImage,
	};
}

/** useLlamaAI — streaming completion из store. */
export function selectLlamaAISlice(state: EditorStore) {
	return {
		aiStreaming: state.aiStreaming,
		aiStreamingText: state.aiStreamingText,
		error: state.error,
		completeText: state.completeText,
	};
}

/** useDocumentSearch — полнотекстовый/семантический поиск. */
export function selectDocumentSearchSlice(state: EditorStore) {
	return {
		searchResults: state.searchResults,
		isLoading: state.isLoading,
		error: state.error,
		search: state.search,
	};
}

/** OCR panel — распознавание текста. */
export function selectOCRPanelSlice(state: EditorStore) {
	return {
		performOCR: state.performOCR,
		isLoading: state.isLoading,
	};
}

/** Document templates — создание из шаблона. */
export function selectDocumentTemplatesPanelSlice(state: EditorStore) {
	return {
		createDocument: state.createDocument,
	};
}

/** AI assistant — сохранённые промпты. */
export function selectAIAssistantPromptsSlice(state: EditorStore) {
	return {
		savedPrompts: state.savedPrompts,
		loadPrompts: state.loadPrompts,
		savePrompt: state.savePrompt,
	};
}

/** Document import panel — загрузка и парсинг файлов. */
export function selectDocumentImportPanelSlice(state: EditorStore) {
	return {
		importDocument: state.importDocument,
		isLoading: state.isLoading,
	};
}
