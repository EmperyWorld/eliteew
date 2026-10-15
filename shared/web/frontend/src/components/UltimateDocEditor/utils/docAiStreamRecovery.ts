/**
 * Persist partial AI assistant stream to sessionStorage so the user can recover
 * after closing the panel, switching tabs, or losing the HTTP connection.
 */

import i18n from '../../../i18n/config';

const STORAGE_PREFIX = 'eliteew.docAi.stream.v1:';

/** Localized strings for recovery UI (`ultimateDocEditor` namespace). */
export function getDocAiRecoveryCopy(): {
	bannerTitle: string;
	bannerHint: string;
	restore: string;
	dismiss: string;
	staleHint: string;
} {
	const t = (key: string) => i18n.t(`ultimateDocEditor:docAiRecovery.${key}`);
	return {
		bannerTitle: t('bannerTitle'),
		bannerHint: t('bannerHint'),
		restore: t('restore'),
		dismiss: t('dismiss'),
		staleHint: t('staleHint'),
	};
}

export type DocAiActionMode =
	| 'rewrite'
	| 'expand'
	| 'summarize'
	| 'translate'
	| 'free';
export type DocAiContextScope = 'selection' | 'section' | 'document';

export interface DocAiStreamDraft {
	documentId: string | null;
	userMessage: string;
	context: string;
	actionMode: DocAiActionMode;
	contextScope: DocAiContextScope;
	partialResponse: string;
	updatedAt: number;
	/** True while the fetch reader is active in this tab */
	inProgress: boolean;
}

function storageKey(documentId: string | null | undefined): string {
	const id = documentId?.trim();
	return `${STORAGE_PREFIX}${id && id.length > 0 ? id : 'default'}`;
}

function parseDraft(raw: string): DocAiStreamDraft | null {
	try {
		const o = JSON.parse(raw) as Partial<DocAiStreamDraft>;
		if (typeof o.userMessage !== 'string') return null;
		return {
			documentId:
				typeof o.documentId === 'string' || o.documentId === null
					? o.documentId
					: null,
			userMessage: o.userMessage,
			context: typeof o.context === 'string' ? o.context : '',
			actionMode: (o.actionMode as DocAiActionMode) || 'free',
			contextScope: (o.contextScope as DocAiContextScope) || 'selection',
			partialResponse:
				typeof o.partialResponse === 'string' ? o.partialResponse : '',
			updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0,
			inProgress: Boolean(o.inProgress),
		};
	} catch {
		return null;
	}
}

export function readDocAiStreamDraft(
	documentId: string | null | undefined
): DocAiStreamDraft | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(storageKey(documentId));
		if (!raw) return null;
		return parseDraft(raw);
	} catch {
		return null;
	}
}

export function clearDocAiStreamDraft(
	documentId: string | null | undefined
): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(storageKey(documentId));
	} catch {
		/* ignore */
	}
}

const STALE_IN_PROGRESS_MS = 20_000;
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether to show “restore draft” in the panel.
 */
export function shouldOfferDocAiRecovery(
	draft: DocAiStreamDraft | null
): boolean {
	if (!draft) return false;
	if (Date.now() - draft.updatedAt > MAX_DRAFT_AGE_MS) return false;
	if (draft.partialResponse.trim().length > 0) return true;
	if (
		draft.inProgress &&
		Date.now() - draft.updatedAt > STALE_IN_PROGRESS_MS &&
		draft.userMessage.trim().length > 0
	) {
		return true;
	}
	return false;
}

export function mergeDocAiStreamDraft(
	documentId: string | null | undefined,
	patch: Partial<DocAiStreamDraft> & {
		userMessage: string;
		context: string;
		actionMode: DocAiActionMode;
		contextScope: DocAiContextScope;
	}
): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		const prev = readDocAiStreamDraft(documentId);
		const next: DocAiStreamDraft = {
			documentId: documentId?.trim() || null,
			userMessage: patch.userMessage,
			context: patch.context,
			actionMode: patch.actionMode,
			contextScope: patch.contextScope,
			partialResponse: patch.partialResponse ?? prev?.partialResponse ?? '',
			inProgress: patch.inProgress ?? prev?.inProgress ?? false,
			updatedAt: Date.now(),
		};
		sessionStorage.setItem(storageKey(documentId), JSON.stringify(next));
	} catch {
		/* quota / private mode */
	}
}
