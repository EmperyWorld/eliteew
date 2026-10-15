/**
 * File-exchange / unified content → store и жизненный цикл контента документа (волна 6.1).
 * Разделено: гидратация unified раньше коллаб-auto-join, остальное — после (порядок как в оркестраторе).
 */

import { useEffect, type MutableRefObject, type RefObject } from 'react';

import type { StoreApi } from 'zustand';

import type { FileId } from '@/types/fileExchange';

import type { EditorStore } from '../store/editorStore';
import type { DocEditorSelectionRange } from '../utils/runtimeDialogEvents';
import { calculateStats } from '../utils/ultimateDocEditorBootstrap';

/** Минимальная форма контента из file-exchange для эффекта гидратации store. */
export type DocEditorBootstrapUnifiedContent = {
	html: string;
	title?: string;
	/** Content owner from GET /content/{id}; required for honest collab invite gating. */
	ownerUserId?: string;
};

export interface UseDocEditorUnifiedContentStoreSyncParams {
	currentContent: DocEditorBootstrapUnifiedContent | null;
	currentFileId: FileId | null;
	userId: string | undefined;
	editorStoreApi: StoreApi<EditorStore>;
	updateStats: (html: string) => void;
}

/** Синхронизация `currentContent` из file-exchange в Zustand (раньше auto-join коллаба). */
export function useDocEditorUnifiedContentStoreSync(
	params: UseDocEditorUnifiedContentStoreSyncParams
): void {
	const { currentContent, currentFileId, userId, editorStoreApi, updateStats } =
		params;

	useEffect(() => {
		if (currentContent?.html) {
			const stats = calculateStats(currentContent.html);
			updateStats(currentContent.html);
			const doc = {
				id: currentFileId || 'temp',
				// Prefer content owner over session user — collaborators must not look like owners.
				user_id: currentContent.ownerUserId ?? userId ?? 'anonymous',
				title: currentContent.title || 'Без названия',
				content: currentContent.html,
				content_type: 'html' as const,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				word_count: stats.words,
				character_count: stats.characters,
				metadata: {},
				tags: [],
				is_public: false,
				access_level: 'private' as const,
				version_number: 1,
				last_accessed_at: new Date().toISOString(),
			};
			editorStoreApi.setState({
				currentDocument: doc,
				documentSource: 'unified_content',
				isDirty: false,
			});
		}
	}, [
		currentContent,
		currentFileId,
		userId,
		editorStoreApi.setState,
		updateStats,
	]);
}

export interface UseDocEditorEditorDocumentLifecycleEffectsParams {
	editorInitialContent: string;
	updateStats: (html: string) => void;

	resetMarkdownForDocumentSwitch: () => void;
	resetCommentsSession: () => void;
	setSelectedText: (text: string) => void;
	setEditorSelectionRange: (range: DocEditorSelectionRange | null) => void;
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
	latestEditorHtmlRef: MutableRefObject<string | null>;

	editorScrollContainerRef: RefObject<HTMLDivElement | null>;
}

/** Статистика по initial HTML, сброс markdown/comments/selection при смене документа, начальный scroll. */
export function useDocEditorEditorDocumentLifecycleEffects(
	params: UseDocEditorEditorDocumentLifecycleEffectsParams
): void {
	const {
		editorInitialContent,
		updateStats,
		resetMarkdownForDocumentSwitch,
		resetCommentsSession,
		setSelectedText,
		setEditorSelectionRange,
		lastSelectionRef,
		lastCollabCursorRef,
		latestEditorHtmlRef,
		editorScrollContainerRef,
	} = params;

	useEffect(() => {
		updateStats(editorInitialContent);
	}, [editorInitialContent, updateStats]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: тот же контракт, что в оркестраторе — три зависимости
	useEffect(() => {
		resetMarkdownForDocumentSwitch();
		resetCommentsSession();
		setSelectedText('');
		setEditorSelectionRange(null);
		lastSelectionRef.current = { text: '', from: null, to: null };
		lastCollabCursorRef.current = null;
		latestEditorHtmlRef.current = null;
	}, [resetMarkdownForDocumentSwitch, resetCommentsSession, setSelectedText]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: только маунт; контейнер через ref
	useEffect(() => {
		editorScrollContainerRef.current?.scrollTo({
			top: 0,
			left: 0,
			behavior: 'instant',
		});
	}, []);
}
