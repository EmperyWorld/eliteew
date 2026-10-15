/**
 * Overlay / side panel orchestration for Ultimate Doc Editor
 * (Zustand-backed panels + local dialog-style panels + export menu coordination).
 */

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { PANEL_KEYS, type OverlayKey } from './docEditorPanelKeys';

export interface DocEditorPanelsStoreSlice {
	aiPanelOpen: boolean;
	openAIPanel: () => void;
	closeAIPanel: () => void;
	imageGenPanelOpen: boolean;
	openImageGenPanel: () => void;
	closeImageGenPanel: () => void;
	collabPanelOpen: boolean;
	openCollabPanel: () => void;
	closeCollabPanel: () => void;
	searchPanelOpen: boolean;
	openSearchPanel: () => void;
	closeSearchPanel: () => void;
	versionsPanelOpen: boolean;
	openVersionsPanel: () => void;
	closeVersionsPanel: () => void;
}

export interface UseDocEditorPanelsParams {
	store: DocEditorPanelsStoreSlice;
	exportMenuOpen: boolean;
	setExportMenuOpen: Dispatch<SetStateAction<boolean>>;
	setToolbarCloseTick: Dispatch<SetStateAction<number>>;
}

export interface UseDocEditorPanelsResult {
	fileManagerOpen: boolean;
	setFileManagerOpen: Dispatch<SetStateAction<boolean>>;
	importPanelOpen: boolean;
	setImportPanelOpen: Dispatch<SetStateAction<boolean>>;
	ocrPanelOpen: boolean;
	setOcrPanelOpen: Dispatch<SetStateAction<boolean>>;
	tableEditorOpen: boolean;
	setTableEditorOpen: Dispatch<SetStateAction<boolean>>;
	mathEditorOpen: boolean;
	setMathEditorOpen: Dispatch<SetStateAction<boolean>>;
	commentsPanelOpen: boolean;
	setCommentsPanelOpen: Dispatch<SetStateAction<boolean>>;
	templatesPanelOpen: boolean;
	setTemplatesPanelOpen: Dispatch<SetStateAction<boolean>>;
	chartsPanelOpen: boolean;
	setChartsPanelOpen: Dispatch<SetStateAction<boolean>>;
	pdfPanelOpen: boolean;
	setPdfPanelOpen: Dispatch<SetStateAction<boolean>>;
	getPanelOpenState: (panel: OverlayKey) => boolean;
	closePanel: (panel: OverlayKey) => void;
	openPanel: (panel: OverlayKey) => void;
	closeAllOverlays: (options?: { skipToolbar?: boolean }) => void;
	showPanel: (panel: OverlayKey) => void;
	togglePanel: (panel: OverlayKey) => void;
	panelOpenForSidebar: Record<OverlayKey, boolean>;
	anyDocOverlayOpen: boolean;
}

export function useDocEditorPanels(
	params: UseDocEditorPanelsParams
): UseDocEditorPanelsResult {
	const { store, exportMenuOpen, setExportMenuOpen, setToolbarCloseTick } =
		params;
	const {
		aiPanelOpen,
		openAIPanel,
		closeAIPanel,
		imageGenPanelOpen,
		openImageGenPanel,
		closeImageGenPanel,
		collabPanelOpen,
		openCollabPanel,
		closeCollabPanel,
		searchPanelOpen,
		openSearchPanel,
		closeSearchPanel,
		versionsPanelOpen,
		openVersionsPanel,
		closeVersionsPanel,
	} = store;

	const [fileManagerOpen, setFileManagerOpen] = useState(false);
	const [importPanelOpen, setImportPanelOpen] = useState(false);
	const [ocrPanelOpen, setOcrPanelOpen] = useState(false);
	const [tableEditorOpen, setTableEditorOpen] = useState(false);
	const [mathEditorOpen, setMathEditorOpen] = useState(false);
	const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
	const [templatesPanelOpen, setTemplatesPanelOpen] = useState(false);
	const [chartsPanelOpen, setChartsPanelOpen] = useState(false);
	const [pdfPanelOpen, setPdfPanelOpen] = useState(false);

	const getPanelOpenState = useCallback(
		(panel: OverlayKey): boolean => {
			switch (panel) {
				case 'ai':
					return aiPanelOpen;
				case 'image':
					return imageGenPanelOpen;
				case 'collab':
					return collabPanelOpen;
				case 'search':
					return searchPanelOpen;
				case 'versions':
					return versionsPanelOpen;
				case 'fileManager':
					return fileManagerOpen;
				case 'ocr':
					return ocrPanelOpen;
				case 'import':
					return importPanelOpen;
				case 'pdf':
					return pdfPanelOpen;
				case 'table':
					return tableEditorOpen;
				case 'math':
					return mathEditorOpen;
				case 'comments':
					return commentsPanelOpen;
				case 'templates':
					return templatesPanelOpen;
				case 'charts':
					return chartsPanelOpen;
				default:
					return false;
			}
		},
		[
			aiPanelOpen,
			imageGenPanelOpen,
			collabPanelOpen,
			searchPanelOpen,
			versionsPanelOpen,
			fileManagerOpen,
			ocrPanelOpen,
			importPanelOpen,
			pdfPanelOpen,
			tableEditorOpen,
			mathEditorOpen,
			commentsPanelOpen,
			templatesPanelOpen,
			chartsPanelOpen,
		]
	);

	const closePanel = useCallback(
		(panel: OverlayKey) => {
			switch (panel) {
				case 'ai':
					closeAIPanel();
					break;
				case 'image':
					closeImageGenPanel();
					break;
				case 'collab':
					closeCollabPanel();
					break;
				case 'search':
					closeSearchPanel();
					break;
				case 'versions':
					closeVersionsPanel();
					break;
				case 'fileManager':
					setFileManagerOpen(false);
					break;
				case 'ocr':
					setOcrPanelOpen(false);
					break;
				case 'import':
					setImportPanelOpen(false);
					break;
				case 'pdf':
					setPdfPanelOpen(false);
					break;
				case 'table':
					setTableEditorOpen(false);
					break;
				case 'math':
					setMathEditorOpen(false);
					break;
				case 'comments':
					setCommentsPanelOpen(false);
					break;
				case 'templates':
					setTemplatesPanelOpen(false);
					break;
				case 'charts':
					setChartsPanelOpen(false);
					break;
				default:
					break;
			}
		},
		[
			closeAIPanel,
			closeImageGenPanel,
			closeCollabPanel,
			closeSearchPanel,
			closeVersionsPanel,
		]
	);

	const openPanel = useCallback(
		(panel: OverlayKey) => {
			switch (panel) {
				case 'ai':
					openAIPanel();
					break;
				case 'image':
					openImageGenPanel();
					break;
				case 'collab':
					openCollabPanel();
					break;
				case 'search':
					openSearchPanel();
					break;
				case 'versions':
					openVersionsPanel();
					break;
				case 'fileManager':
					setFileManagerOpen(true);
					break;
				case 'ocr':
					setOcrPanelOpen(true);
					break;
				case 'import':
					setImportPanelOpen(true);
					break;
				case 'pdf':
					setPdfPanelOpen(true);
					break;
				case 'table':
					setTableEditorOpen(true);
					break;
				case 'math':
					setMathEditorOpen(true);
					break;
				case 'comments':
					setCommentsPanelOpen(true);
					break;
				case 'templates':
					setTemplatesPanelOpen(true);
					break;
				case 'charts':
					setChartsPanelOpen(true);
					break;
				default:
					break;
			}
		},
		[
			openAIPanel,
			openImageGenPanel,
			openCollabPanel,
			openSearchPanel,
			openVersionsPanel,
		]
	);

	const closeAllOverlays = useCallback(
		(options?: { skipToolbar?: boolean }) => {
			setExportMenuOpen(false);
			for (const panelKey of PANEL_KEYS) {
				closePanel(panelKey);
			}
			if (!options?.skipToolbar) {
				setToolbarCloseTick((prev) => prev + 1);
			}
		},
		[closePanel, setExportMenuOpen, setToolbarCloseTick]
	);

	const showPanel = useCallback(
		(panel: OverlayKey) => {
			closeAllOverlays();
			openPanel(panel);
		},
		[closeAllOverlays, openPanel]
	);

	const togglePanel = useCallback(
		(panel: OverlayKey) => {
			if (getPanelOpenState(panel)) {
				closePanel(panel);
			} else {
				closeAllOverlays();
				openPanel(panel);
			}
		},
		[getPanelOpenState, closePanel, closeAllOverlays, openPanel]
	);

	const panelOpenForSidebar = useMemo(
		() => ({
			ai: aiPanelOpen,
			image: imageGenPanelOpen,
			collab: collabPanelOpen,
			table: tableEditorOpen,
			math: mathEditorOpen,
			charts: chartsPanelOpen,
			import: importPanelOpen,
			pdf: pdfPanelOpen,
			ocr: ocrPanelOpen,
			fileManager: fileManagerOpen,
			search: searchPanelOpen,
			versions: versionsPanelOpen,
			comments: commentsPanelOpen,
			templates: templatesPanelOpen,
		}),
		[
			aiPanelOpen,
			imageGenPanelOpen,
			collabPanelOpen,
			tableEditorOpen,
			mathEditorOpen,
			chartsPanelOpen,
			importPanelOpen,
			pdfPanelOpen,
			ocrPanelOpen,
			fileManagerOpen,
			searchPanelOpen,
			versionsPanelOpen,
			commentsPanelOpen,
			templatesPanelOpen,
		]
	);

	const anyDocOverlayOpen = useMemo(
		() => exportMenuOpen || Object.values(panelOpenForSidebar).some(Boolean),
		[exportMenuOpen, panelOpenForSidebar]
	);

	return {
		fileManagerOpen,
		setFileManagerOpen,
		importPanelOpen,
		setImportPanelOpen,
		ocrPanelOpen,
		setOcrPanelOpen,
		tableEditorOpen,
		setTableEditorOpen,
		mathEditorOpen,
		setMathEditorOpen,
		commentsPanelOpen,
		setCommentsPanelOpen,
		templatesPanelOpen,
		setTemplatesPanelOpen,
		chartsPanelOpen,
		setChartsPanelOpen,
		pdfPanelOpen,
		setPdfPanelOpen,
		getPanelOpenState,
		closePanel,
		openPanel,
		closeAllOverlays,
		showPanel,
		togglePanel,
		panelOpenForSidebar,
		anyDocOverlayOpen,
	};
}
