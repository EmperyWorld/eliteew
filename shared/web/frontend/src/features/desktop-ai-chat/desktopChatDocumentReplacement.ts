/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Apply the finalized assistant_document_replace SSE payload to the active streamed message.
 *
 * Invariants:
 * - Replacement is whole-document, never an append.
 * - Stage mode paints content without flipping blueprint chrome; commit promotes metadata once.
 * - Only additive public metadata is merged; malformed payloads leave state unchanged.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts
 * - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
 */
import type {
	DesktopAiArtifactQualityStatus,
	DesktopAiMessage,
	DesktopAiMessageMetadata,
} from './api/desktopChatClient';
import { normalizeDesktopAiContextSources } from './desktopAiEvidence';
import type {
	DesktopCouncilTranscript,
	DesktopCouncilTurn,
} from './ensemble/types';

/** Ephemeral SPA flag: live bubble stays on streaming chrome until commit. */
export const DESKTOP_STREAM_FINALIZING_KEY =
	'desktop_stream_finalizing' as const;

export type DesktopAiDocumentReplacementPayload = {
	content?: unknown;
	quality_status?: unknown;
	artifact_type?: unknown;
	plan_template_id?: unknown;
	context_sources?: unknown;
	message_id?: unknown;
	council_transcript?: unknown;
};

export type DesktopAiDocumentReplacementMode = 'stage' | 'commit';

export type ApplyDesktopAiDocumentReplacementOptions = {
	mode?: DesktopAiDocumentReplacementMode;
	/** When committing, rewrite the local bubble id to the server message id. */
	rewriteIdTo?: string;
};

function nonEmptyString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function qualityStatus(
	value: unknown
): DesktopAiArtifactQualityStatus | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	return value as DesktopAiArtifactQualityStatus;
}

export function normalizeDesktopCouncilTranscript(
	value: unknown
): DesktopCouncilTranscript | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const raw = value as Record<string, unknown>;
	const turns = Array.isArray(raw.turns) ? raw.turns : [];
	const mode =
		raw.mode === 'discussion' || raw.mode === 'joint_document'
			? raw.mode
			: 'joint_document';
	const roster = Array.isArray(raw.roster)
		? raw.roster.filter((x): x is string => typeof x === 'string')
		: [];
	const normalizedTurns = turns
		.filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
		.map(
			(t): DesktopCouncilTurn => ({
				kind:
					t.kind === 'speaker_reply' ||
					t.kind === 'closing' ||
					t.kind === 'orchestrator_brief'
						? t.kind
						: 'orchestrator_brief',
				text: typeof t.text === 'string' ? t.text : '',
				at_ms: typeof t.at_ms === 'number' ? t.at_ms : 0,
				...(typeof t.hero_id === 'string' ? { hero_id: t.hero_id } : {}),
				...(typeof t.label === 'string' ? { label: t.label } : {}),
				...(typeof t.index === 'number' ? { index: t.index } : {}),
			})
		)
		.filter((t) => t.text.trim().length > 0);
	if (normalizedTurns.length === 0 && roster.length === 0) {
		return undefined;
	}
	return {
		version: typeof raw.version === 'number' ? raw.version : 1,
		mode,
		roster,
		turns: normalizedTurns,
		closing:
			raw.closing && typeof raw.closing === 'object'
				? (raw.closing as DesktopCouncilTranscript['closing'])
				: null,
	};
}

/** Loose UUID check for SSE message_id promotion (avoids rewriting to garbage). */
export function isDesktopAiPersistedMessageIdCandidate(
	value: unknown
): value is string {
	if (typeof value !== 'string') return false;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		value.trim()
	);
}

export function rewriteDesktopAiMessageId(
	messages: DesktopAiMessage[],
	fromId: string,
	toId: string
): DesktopAiMessage[] {
	if (!fromId || !toId || fromId === toId) {
		return messages;
	}
	return messages.map((message) =>
		message.id === fromId ? { ...message, id: toId } : message
	);
}

export function applyDesktopAiDocumentReplacement(
	messages: DesktopAiMessage[],
	targetMessageId: string | null,
	payload: DesktopAiDocumentReplacementPayload,
	options: ApplyDesktopAiDocumentReplacementOptions = {}
): {
	messages: DesktopAiMessage[];
	content: string | null;
	applied: boolean;
	messageId: string | null;
} {
	const mode: DesktopAiDocumentReplacementMode = options.mode ?? 'commit';
	const content =
		typeof payload.content === 'string' && payload.content.trim()
			? payload.content
			: undefined;
	if (!targetMessageId || !content) {
		return { messages, content: null, applied: false, messageId: null };
	}
	const quality = qualityStatus(payload.quality_status);
	const artifactType = nonEmptyString(payload.artifact_type);
	const planTemplateId = nonEmptyString(payload.plan_template_id);
	const sources = normalizeDesktopAiContextSources(payload.context_sources);
	const council = normalizeDesktopCouncilTranscript(payload.council_transcript);
	const rewriteTo =
		options.rewriteIdTo &&
		isDesktopAiPersistedMessageIdCandidate(options.rewriteIdTo)
			? options.rewriteIdTo.trim()
			: undefined;
	let applied = false;
	let nextId: string | null = null;
	const next = messages.map((message) => {
		if (message.id !== targetMessageId) return message;
		applied = true;
		const previousSummary = message.metadata?.context_summary;
		const id = rewriteTo ?? message.id;
		nextId = id;
		if (mode === 'stage') {
			return {
				...message,
				id,
				content,
				metadata: {
					...message.metadata,
					...(quality ? { quality_status: quality } : {}),
					...(council ? { council_transcript: council } : {}),
					[DESKTOP_STREAM_FINALIZING_KEY]: true,
				},
			};
		}
		const restMeta: DesktopAiMessageMetadata = { ...(message.metadata ?? {}) };
		delete restMeta[DESKTOP_STREAM_FINALIZING_KEY];
		return {
			...message,
			id,
			content,
			metadata: {
				...restMeta,
				...(quality ? { quality_status: quality } : {}),
				...(artifactType ? { artifact_type: artifactType } : {}),
				...(planTemplateId
					? {
							plan_template_id: planTemplateId,
							desktop_ensemble_blueprint: true,
						}
					: {}),
				...(sources.length > 0
					? {
							context_sources: sources,
							context_summary: {
								...previousSummary,
								context_sources: sources,
							},
						}
					: {}),
				...(council ? { council_transcript: council } : {}),
			},
		};
	});
	return {
		messages: applied ? next : messages,
		content: applied ? content : null,
		applied,
		messageId: applied ? nextId : null,
	};
}
