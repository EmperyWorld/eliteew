/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FE-only overlays and stream/error types for Desktop AI Chat client (not OpenAPI SSOT).
 *
 * Invariants:
 * - Message metadata mirrors backend persisted metadata without trusted execution semantics.
 * - DesktopAiSseTerminalError constructor identity is stable for instanceof checks.
 *
 * Related:
 * - ../desktopAiChatOpenApi.ts
 * - ./streamErrors.ts
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 */
import type {
	DesktopAiMessageOut,
	DesktopChatCapabilities,
} from '../desktopAiChatOpenApi';
import type { DesktopCouncilTranscript } from '../../ensemble/types';

export type DesktopChatViewerRole = 'owner' | 'guest';

export type DesktopChatCapabilityKey = keyof DesktopChatCapabilities;

export type DesktopAiContextSourceKind =
	| 'chat_attachment'
	| 'project_document'
	| 'derived_ai_artifact'
	| 'web';

export type DesktopAiContextSource = {
	citation_id: string;
	kind: DesktopAiContextSourceKind;
	authority: 'user_material' | 'project_material' | 'derived' | 'external';
	title: string;
	url?: string;
};

export type DesktopAiStreamContextSummary = {
	chat_rag_chunks?: number;
	/** Honesty alias for attachment RAG hits (same count as chat_rag_chunks). */
	chat_attachment_chunks?: number;
	chat_rag_requested?: number;
	chat_rag_cap?: number;
	project_vault_chunks?: number;
	project_vault_requested?: boolean;
	project_vault_cap?: number;
	context_policy_applied?: boolean;
	/** Episodic chat-memory search hits (not citeable attachments). */
	chat_memory_hits?: number;
	/** History rows included for the turn (capped). */
	history_messages_used?: number;
	chat_rag_quality?: {
		chunks?: number;
		scored?: number;
		unique_content_ids?: number;
		score_min?: number;
		score_max?: number;
		score_avg?: number;
	};
	project_vault_quality?: {
		chunks?: number;
		scored?: number;
		unique_content_ids?: number;
		score_min?: number;
		score_max?: number;
		score_avg?: number;
	};
	web_search_used?: boolean;
	web_search_sources?: Array<{
		url: string;
		title?: string;
		snippet?: string;
	}>;
	context_sources?: DesktopAiContextSource[];
	/** Knowledge-base prefetch metadata (no chunk bodies). */
	kbsew_prefetch_applied?: boolean;
	kbsew_prefetch_status?:
		| 'disabled'
		| 'empty'
		| 'ok'
		| 'stale'
		| 'error'
		| 'partial_stale';
	kbsew_prefetch_barrels_ok?: number;
	kbsew_prefetch_barrels_stale?: number;
	kbsew_prefetch_barrels_failed?: number;
	kbsew_prefetch_barrels_empty?: number;
	memory_cell_chunks?: number;
	memory_cell_requested?: boolean;
	memory_cell_cap?: number;
	memory_cell_id?: string | null;
	memory_cell_quality?: {
		chunks?: number;
		scored?: number;
		unique_content_ids?: number;
		score_min?: number;
		score_max?: number;
		score_avg?: number;
	};
};

export type DesktopAiArtifactQualityStatus = {
	/** Artifact finalization state. Historical messages may contain a grounding state here. */
	status?: string;
	label?: string;
	grounding_status?: string;
	chat_chunks?: number;
	project_vault_chunks?: number;
	required_context?: string[];
	artifact_type?: string;
	repair_attempted?: boolean;
	repair_applied?: boolean;
	violations?: string[];
	source_count?: number;
};

export type DesktopAiMessageMetadata = {
	desktop_hero_id?: string;
	turn_kind?: string;
	/** Adaptive professional-answer contract applied by the Desktop AI prompt. */
	desktop_expert_reply_contract?: string;
	desktop_structured_reply_prompt?: boolean;
	ensemble_doc_confirm?: string;
	/** Текст причины подтверждения документа (semi), сохраняется вместе с asked. */
	ensemble_doc_confirm_reason?: string;
	ensemble_doc_confirm_asked_at?: string;
	ensemble_doc_confirm_expired?: boolean;
	/** Совместный ответ панели (joint) — см. backend persist. */
	desktop_ensemble_joint?: boolean;
	desktop_ensemble_contributors?: string[];
	desktop_ensemble_blueprint?: boolean;
	plan_template_id?: string;
	/** Если бэкенд положит заголовок шаблона — для подписи при сохранении в контент-менеджер. */
	plan_template_title?: string;
	artifact_type?: string;
	interview_handoff?: {
		topic?: string;
		goal?: string;
		preset_id?: string;
	};
	quality_status?: DesktopAiArtifactQualityStatus;
	/** Shared chat: human author display name persisted by backend. */
	author_display_name?: string;
	author_is_owner?: boolean;
	/** Ephemeral SPA-only: live bubble keeps streaming chrome until replace commit. */
	desktop_stream_finalizing?: boolean;
	document_outline?: Array<{
		id?: string;
		heading?: string;
		step_ids?: string[];
		subsections?: Array<{ heading?: string; step_id?: string }>;
	}>;
	steps_preview?: Array<{
		step_id?: string;
		title?: string;
		hero_id?: string;
		fallback?: boolean;
		slot_distance?: number;
	}>;
	/** Other matching blueprint templates deferred from a compound user request. */
	deferred_plan_templates?: Array<{
		plan_template_id?: string;
		title?: string;
		reason?: string;
		score?: string;
	}>;
	context_summary?: DesktopAiStreamContextSummary;
	context_sources?: DesktopAiContextSource[];
	/** Wave F1: persisted council mini-chat for Process tab (Wave F2). */
	council_transcript?: DesktopCouncilTranscript;
	/** Discussion mode: empty assistant anchor for DiscussionBubble (hidden in thread). */
	desktop_discussion?: boolean;
	discussion_session_id?: string;
	discussion_preset_id?: string;
	discussion_topic?: string;
	desktop_web_search_sources?: Array<{
		url: string;
		title?: string;
		snippet?: string;
	}>;
	[key: string]: unknown;
};

export type DesktopAiMessage = Omit<DesktopAiMessageOut, 'metadata'> & {
	metadata?: DesktopAiMessageMetadata | null;
};

export type SoloSlotDurationHours = 1 | 2 | 12;

export type ListDesktopAiMessagesResult = {
	items: DesktopAiMessage[];
	total: number;
	/** Present when `tail` was used and the chat has more messages than returned. */
	truncated?: boolean;
};

export type VoiceGatewaySynthesizeOptions = {
	/** Silero speaker id (`aidar`, `baya`, `eugene`, `xenia`). */
	voice?: string;
	speed?: number;
	/** Default 1200; API allows up to 5000. */
	maxChars?: number;
};

export type DesktopAiProjectRow = {
	id: string;
	name: string;
	company_id: string;
};

export type StreamErrorKind =
	| 'network'
	| 'http'
	| 'auth'
	| 'abort'
	| 'sse'
	| 'unknown';

/** Server ended the stream with `event: error` (terminal). */
export class DesktopAiSseTerminalError extends Error {
	readonly kind = 'sse_terminal' as const;
	constructor(
		message: string,
		readonly payload?: unknown
	) {
		super(message.startsWith('SSE:') ? message : `SSE: ${message}`);
		this.name = 'DesktopAiSseTerminalError';
	}
}

export type DesktopStreamErrorClassification = {
	kind: StreamErrorKind;
	message: string;
	retryable: boolean;
	/** Stale lock after crash — UI may offer releaseDesktopAiChatStreamLock (owner only). */
	canClearStreamLock?: boolean;
	/** Concurrent / in-progress turn — restore draft; do not wipe composer. */
	turnBusy?: boolean;
	/** Solo chat needs energy session — show share-energy UI */
	soloSlotBlocked?: boolean;
};

export type DesktopAiStreamOptions = {
	regenerate?: boolean;
	ensembleDocumentConfirm?: 'accept' | 'decline';
	refUserMessageId?: string;
	clientRequestId?: string;
};
