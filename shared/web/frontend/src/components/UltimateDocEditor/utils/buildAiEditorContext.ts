/**
 * Сбор контекста для AI-запросов из состояния редактора (без TipTap instance).
 */
export interface AiEditorContextSlice {
	/** Обрезанный plain/HTML агностик текст */
	documentPlain: string;
	/** Выделение пользователя */
	selectionPlain: string;
	documentTitle: string;
	documentId: string | null;
}

const clamp = (s: string, max: number): string => {
	const t = s.trim();
	if (t.length <= max) {
		return t;
	}
	return `${t.slice(0, max - 1)}…`;
};

export function buildAiEditorContext(input: {
	htmlOrPlain: string;
	selectedText?: string;
	title?: string;
	documentId?: string | null;
	maxDocumentChars?: number;
	maxSelectionChars?: number;
}): AiEditorContextSlice {
	const maxDoc = input.maxDocumentChars ?? 12_000;
	const maxSel = input.maxSelectionChars ?? 8000;
	const raw = input.htmlOrPlain ?? '';
	const stripped = raw
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return {
		documentPlain: clamp(stripped, maxDoc),
		selectionPlain: clamp(input.selectedText?.trim() ?? '', maxSel),
		documentTitle: (input.title ?? '').trim() || 'Без названия',
		documentId: input.documentId ?? null,
	};
}
