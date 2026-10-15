/**
 * Режим редактирования Markdown: состояние, превью, переключение с TipTap, авто-вход по localStorage.
 */

import type { Editor } from '@tiptap/react';
import { useNotifications } from '@/notifications';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import { log } from '@/utils/logger';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import { htmlToMarkdown } from '../utils/htmlToMarkdown';
import {
	isUnifiedMarkdownStorage,
	isUnifiedOfficeDocumentFormat,
} from '../utils/unifiedContentLoadRouting';

export interface UseDocEditorMarkdownModeParams {
	tiptapEditor: Editor | null;
	setTiptapEditor: Dispatch<SetStateAction<Editor | null>>;
	editorInitialContent: string;
	currentDocumentContent: string | undefined;
	currentContentHtml: string | undefined;
	loadedMarkdownSource: string | undefined;
	currentDocumentId: string | undefined;
	storageFileName: string | undefined;
	isLoadingDocument: boolean;
	collaborationEnabledByUser: boolean;
	updateStats: (html: string) => void;
	onClearPendingDocInsert: () => void;
}

export interface UseDocEditorMarkdownModeResult {
	markdownMode: boolean;
	markdownModeRef: MutableRefObject<boolean>;
	markdownSource: string;
	markdownEdited: boolean;
	renderedMarkdownPreview: string;
	markdownOriginalHtmlRef: MutableRefObject<string>;
	markdownBaselineRef: MutableRefObject<string>;
	setMarkdownMode: Dispatch<SetStateAction<boolean>>;
	setMarkdownSource: Dispatch<SetStateAction<string>>;
	setMarkdownEdited: Dispatch<SetStateAction<boolean>>;
	setRenderedMarkdownPreview: Dispatch<SetStateAction<string>>;
	convertMarkdownToHtml: (value: string) => Promise<string>;
	handleMarkdownSourceChange: (value: string) => void;
	handleToggleMarkdownMode: () => Promise<void>;
	resetMarkdownForDocumentSwitch: () => void;
}

export function useDocEditorMarkdownMode(
	params: UseDocEditorMarkdownModeParams
): UseDocEditorMarkdownModeResult {
	const {
		tiptapEditor,
		setTiptapEditor,
		editorInitialContent,
		currentDocumentContent,
		currentContentHtml,
		loadedMarkdownSource,
		currentDocumentId,
		storageFileName,
		isLoadingDocument,
		collaborationEnabledByUser,
		updateStats,
		onClearPendingDocInsert,
	} = params;

	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const { error: notifyError } = useNotifications();

	const [markdownMode, setMarkdownMode] = useState(false);
	const markdownModeRef = useRef(markdownMode);
	markdownModeRef.current = markdownMode;

	const [markdownSource, setMarkdownSource] = useState('');
	const [markdownEdited, setMarkdownEdited] = useState(false);
	const [renderedMarkdownPreview, setRenderedMarkdownPreview] =
		useState('<p></p>');

	const markdownOriginalHtmlRef = useRef('');
	const markdownBaselineRef = useRef('');
	const markdownRenderRequestRef = useRef(0);
	const autoMarkdownOpenedForDocRef = useRef<string | null>(null);

	useEffect(() => {
		autoMarkdownOpenedForDocRef.current = null;
	}, []);

	const convertMarkdownToHtml = useCallback(
		async (value: string): Promise<string> => {
			const source = value.trim();
			if (!source) {
				return '<p></p>';
			}

			const { renderMarkdownToHTML } = await import(
				'../utils/renderMarkdownToHtml'
			);
			return renderMarkdownToHTML(source);
		},
		[]
	);

	useEffect(() => {
		if (!markdownMode) {
			markdownRenderRequestRef.current += 1;
			return;
		}

		const requestId = ++markdownRenderRequestRef.current;
		let isCancelled = false;

		void convertMarkdownToHtml(markdownSource || '')
			.then((html) => {
				if (isCancelled || markdownRenderRequestRef.current !== requestId) {
					return;
				}

				const nextHtml = html || '<p></p>';
				setRenderedMarkdownPreview(nextHtml);

				if (markdownEdited) {
					updateStats(nextHtml);
				}
			})
			.catch((error) => {
				if (isCancelled || markdownRenderRequestRef.current !== requestId) {
					return;
				}

				log.error(
					'UltimateDocEditor',
					'Failed to render markdown preview',
					error instanceof Error ? error : undefined,
					error
				);
			});

		return () => {
			isCancelled = true;
		};
	}, [
		convertMarkdownToHtml,
		markdownMode,
		markdownSource,
		markdownEdited,
		updateStats,
	]);

	const resetMarkdownForDocumentSwitch = useCallback(() => {
		setMarkdownMode(false);
		setMarkdownSource('');
		setMarkdownEdited(false);
		setRenderedMarkdownPreview('<p></p>');
		markdownOriginalHtmlRef.current = '';
		markdownBaselineRef.current = '';
		autoMarkdownOpenedForDocRef.current = null;
	}, []);

	const handleMarkdownSourceChange = useCallback(
		(value: string): void => {
			setMarkdownSource(value);

			const isEdited = value !== markdownBaselineRef.current;
			setMarkdownEdited(isEdited);

			if (!isEdited) {
				const originalHtml = markdownOriginalHtmlRef.current || '<p></p>';
				updateStats(originalHtml);
				return;
			}
		},
		[updateStats]
	);

	const openMarkdownEditorMode = useCallback(() => {
		const currentHtml =
			tiptapEditor?.getHTML() ||
			currentContentHtml ||
			currentDocumentContent ||
			editorInitialContent ||
			'<p></p>';
		const fromFile = loadedMarkdownSource?.trim();
		const markdownContent =
			fromFile && fromFile.length > 0 ? fromFile : htmlToMarkdown(currentHtml);
		markdownOriginalHtmlRef.current = currentHtml;
		markdownBaselineRef.current = markdownContent;
		setMarkdownSource(markdownContent);
		setMarkdownEdited(false);
		onClearPendingDocInsert();
		setMarkdownMode(true);
		setTiptapEditor(null);
	}, [
		tiptapEditor,
		currentContentHtml,
		loadedMarkdownSource,
		currentDocumentContent,
		editorInitialContent,
		onClearPendingDocInsert,
		setTiptapEditor,
	]);

	const handleToggleMarkdownMode = useCallback(async () => {
		if (markdownMode) {
			onClearPendingDocInsert();
			try {
				const html = markdownEdited
					? await convertMarkdownToHtml(markdownSource)
					: markdownOriginalHtmlRef.current ||
						currentContentHtml ||
						currentDocumentContent ||
						editorInitialContent ||
						'<p></p>';
				const safe =
					html && typeof html === 'string' && html.trim().length > 0
						? html
						: '<p></p>';
				updateStats(safe);
				setRenderedMarkdownPreview(safe);
			} catch (error) {
				log.error(
					'UltimateDocEditor',
					'Markdown → HTML при выходе из режима',
					error instanceof Error ? error : undefined,
					error
				);
				const fallback =
					markdownOriginalHtmlRef.current ||
					currentDocumentContent ||
					'<p></p>';
				updateStats(fallback);
			}
			try {
				localStorage.setItem('ultimateDocEditor.preferMarkdown', '0');
			} catch (e) {
				log.warn('UltimateDocEditor', 'localStorage preferMarkdown', e);
			}
			setMarkdownMode(false);
			setMarkdownEdited(false);
			setMarkdownSource('');
			setTiptapEditor(null);
			return;
		}

		if (collaborationEnabledByUser) {
			notifyError(
				t('header.markdownCollabBlockedTitle'),
				t('header.markdownCollabBlockedBody')
			);
			return;
		}

		openMarkdownEditorMode();
		try {
			localStorage.setItem('ultimateDocEditor.preferMarkdown', '1');
		} catch (e) {
			log.warn('UltimateDocEditor', 'localStorage preferMarkdown', e);
		}
	}, [
		markdownMode,
		markdownEdited,
		markdownSource,
		convertMarkdownToHtml,
		updateStats,
		collaborationEnabledByUser,
		notifyError,
		t,
		openMarkdownEditorMode,
		currentContentHtml,
		currentDocumentContent,
		editorInitialContent,
		onClearPendingDocInsert,
		setTiptapEditor,
	]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		if (markdownMode) {
			return;
		}
		if (!tiptapEditor) {
			return;
		}
		if (isLoadingDocument) {
			return;
		}
		if (!currentDocumentId || currentDocumentId === 'temp') {
			return;
		}
		if (collaborationEnabledByUser) {
			return;
		}
		if (
			storageFileName &&
			isUnifiedOfficeDocumentFormat({ original_filename: storageFileName })
		) {
			return;
		}
		// .md с HTML-телом (Tika/export): WYSIWYG, не markdown-исходник
		if (
			storageFileName &&
			isUnifiedMarkdownStorage({ original_filename: storageFileName }) &&
			!loadedMarkdownSource?.trim()
		) {
			return;
		}
		let prefer = false;
		try {
			prefer = localStorage.getItem('ultimateDocEditor.preferMarkdown') === '1';
		} catch {
			return;
		}
		if (!prefer) {
			return;
		}
		if (autoMarkdownOpenedForDocRef.current === currentDocumentId) {
			return;
		}
		autoMarkdownOpenedForDocRef.current = currentDocumentId;
		openMarkdownEditorMode();
	}, [
		currentDocumentId,
		collaborationEnabledByUser,
		isLoadingDocument,
		markdownMode,
		openMarkdownEditorMode,
		tiptapEditor,
		storageFileName,
		loadedMarkdownSource,
	]);

	return {
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
	};
}
