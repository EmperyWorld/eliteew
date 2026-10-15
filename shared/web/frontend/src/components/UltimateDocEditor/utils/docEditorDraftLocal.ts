import { htmlToComparableText } from './htmlComparableText';
import { countWordsFromHtml } from './htmlWordCount';

export const LOCAL_DRAFT_KEY_PREFIX = 'ultimate-doc-editor:draft';
const LOCAL_DRAFT_RETENTION_DAYS_FALLBACK = 7;
const LOCAL_DRAFT_RETENTION_DAYS_MIN = 1;
const LOCAL_DRAFT_RETENTION_DAYS_MAX = 30;

const resolveLocalDraftRetentionDays = (): number => {
	const raw = import.meta.env.VITE_ULTIMATE_DOC_DRAFT_RETENTION_DAYS;
	if (typeof raw !== 'string') {
		return LOCAL_DRAFT_RETENTION_DAYS_FALLBACK;
	}
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) {
		return LOCAL_DRAFT_RETENTION_DAYS_FALLBACK;
	}
	return Math.min(
		LOCAL_DRAFT_RETENTION_DAYS_MAX,
		Math.max(LOCAL_DRAFT_RETENTION_DAYS_MIN, parsed)
	);
};

export const LOCAL_DRAFT_RETENTION_DAYS = resolveLocalDraftRetentionDays();
export const LOCAL_DRAFT_MAX_AGE_MS =
	LOCAL_DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface LocalEditorDraft {
	content: string;
	updatedAt: string;
	title?: string;
	sourceSessionId?: string;
	revision?: number;
	provider?: 'local' | 'server';
	draftVersion?: number;
	baseDocumentVersion?: number;
}

export interface LocalDraftConflict {
	incomingUpdatedAt: string;
	incomingSessionId: string;
	incomingRevision: number;
	detectedAt: string;
}

export interface DraftDiffPreview {
	hasChanges: boolean;
	firstDiffIndex: number;
	serverPreview: string;
	localPreview: string;
	serverChars: number;
	localChars: number;
	serverWords: number;
	localWords: number;
}

export type DraftTelemetryEventName =
	| 'draft_saved_local'
	| 'draft_conflict_detected'
	| 'draft_recovery_opened'
	| 'draft_restored'
	| 'draft_recovery_skipped'
	| 'draft_discarded'
	| 'draft_cleanup_metrics';

export type DraftCleanupReason = 'startup' | 'interval';

export const ULTIMATE_DOC_TELEMETRY_EVENT = 'ultimate-doc-editor-telemetry';

export function isUltimateDocTelemetryEnabled(): boolean {
	return typeof import.meta.env.VITE_ULTIMATE_DOC_TELEMETRY === 'string'
		? import.meta.env.VITE_ULTIMATE_DOC_TELEMETRY !== 'false'
		: true;
}

export function parseLocalEditorDraft(
	raw: string | null
): LocalEditorDraft | null {
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as Partial<LocalEditorDraft>;
		if (
			!parsed ||
			typeof parsed.content !== 'string' ||
			typeof parsed.updatedAt !== 'string'
		) {
			return null;
		}
		return {
			content: parsed.content,
			updatedAt: parsed.updatedAt,
			title: typeof parsed.title === 'string' ? parsed.title : undefined,
			sourceSessionId:
				typeof parsed.sourceSessionId === 'string'
					? parsed.sourceSessionId
					: undefined,
			revision:
				typeof parsed.revision === 'number' && Number.isFinite(parsed.revision)
					? Math.max(0, Math.floor(parsed.revision))
					: undefined,
		};
	} catch {
		return null;
	}
}

export function buildDraftDiffPreview(
	serverHtml: string,
	localHtml: string
): DraftDiffPreview {
	const serverText = htmlToComparableText(serverHtml);
	const localText = htmlToComparableText(localHtml);

	const serverWords = countWordsFromHtml(serverHtml).words;
	const localWords = countWordsFromHtml(localHtml).words;

	if (serverText === localText) {
		return {
			hasChanges: false,
			firstDiffIndex: -1,
			serverPreview: serverText.slice(0, 320) || 'Пусто',
			localPreview: localText.slice(0, 320) || 'Пусто',
			serverChars: serverText.length,
			localChars: localText.length,
			serverWords,
			localWords,
		};
	}

	let start = 0;
	const minLength = Math.min(serverText.length, localText.length);
	while (start < minLength && serverText[start] === localText[start]) {
		start += 1;
	}

	let endServer = serverText.length - 1;
	let endLocal = localText.length - 1;
	while (
		endServer >= start &&
		endLocal >= start &&
		serverText[endServer] === localText[endLocal]
	) {
		endServer -= 1;
		endLocal -= 1;
	}

	const context = 140;
	const serverSliceStart = Math.max(0, start - context);
	const localSliceStart = Math.max(0, start - context);
	const serverSliceEnd = Math.min(serverText.length, endServer + context + 1);
	const localSliceEnd = Math.min(localText.length, endLocal + context + 1);

	const serverCore = serverText.slice(serverSliceStart, serverSliceEnd).trim();
	const localCore = localText.slice(localSliceStart, localSliceEnd).trim();

	return {
		hasChanges: true,
		firstDiffIndex: start,
		serverPreview: serverCore || serverText.slice(0, 320) || 'Пусто',
		localPreview: localCore || localText.slice(0, 320) || 'Пусто',
		serverChars: serverText.length,
		localChars: localText.length,
		serverWords,
		localWords,
	};
}
