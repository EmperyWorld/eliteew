/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion chat draft persistence, synchronous POST /message, and proactive observation POST.
 *
 * Invariants:
 * - Draft stored in localStorage keyed by principal; capped at EWA_COMPANION_CHAT_DRAFT_MAX_LEN.
 * - Companion profile must exist (404 companion_profile_not_initialized); Bearer auth matches companion routers.
 * - Optional shell_context attached at send time — never invented client-side.
 *
 * Related:
 * - ewaCompanionChatCoerce.ts — response coercion for POST /message
 * - ewaCompanionChatStreamApi.ts — streaming alternative to POST /message
 * - api/ewa_platform/gateways/routers/companion_chat.py
 */
import type { EwaCompanionShellContextV1 } from '@/pages/Desktop/utils/buildEwaCompanionShellContext';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient } from '@/services/api/client';
import {
	EWA_COMPANION_TURN_PLAN_NS,
	EWA_DESKTOP_FRIEND_CHAT_NS,
	type CompanionChatMessageResponse,
	coerceCompanionActions,
	coerceCompanionSurfaceBlocks,
	coerceCompanionWebSearchResult,
	coerceExecutionReports,
	coerceProactiveSuggestion,
	coerceToolTrace,
} from './ewaCompanionChatCoerce';

export { EWA_COMPANION_TURN_PLAN_NS, EWA_DESKTOP_FRIEND_CHAT_NS };

const EWA_COMPANION_CHAT_DRAFT_PREFIX =
	'eliteew.ewaCompanion.chatDraft.v1::' as const;
/** Matches server-side ``_MAX_MESSAGE_CHARS`` budget for a single companion chat line. */
export const EWA_COMPANION_CHAT_DRAFT_MAX_LEN = 8000;

export const COMPANION_OBSERVATION_PATH = '/ewa/companion-observation' as const;

function companionDraftKey(principalId: string): string {
	return `${EWA_COMPANION_CHAT_DRAFT_PREFIX}${principalId}`;
}

export function loadEwaCompanionChatDraft(principalId: string): string {
	const uid = principalId.trim();
	if (!uid || typeof window === 'undefined') return '';
	try {
		const raw = window.localStorage.getItem(companionDraftKey(uid));
		return typeof raw === 'string'
			? raw.slice(0, EWA_COMPANION_CHAT_DRAFT_MAX_LEN)
			: '';
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_chat_draft_read',
			'localStorage companion draft read failed',
			err
		);
		return '';
	}
}

export function saveEwaCompanionChatDraft(
	principalId: string,
	text: string
): void {
	const uid = principalId.trim();
	if (!uid || typeof window === 'undefined') return;
	try {
		const value = text.slice(0, EWA_COMPANION_CHAT_DRAFT_MAX_LEN);
		if (!value.trim()) {
			window.localStorage.removeItem(companionDraftKey(uid));
			return;
		}
		window.localStorage.setItem(companionDraftKey(uid), value);
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_chat_draft_write',
			'localStorage companion draft write failed',
			err
		);
	}
}

export function clearEwaCompanionChatDraft(principalId: string): void {
	const uid = principalId.trim();
	if (!uid || typeof window === 'undefined') return;
	try {
		window.localStorage.removeItem(companionDraftKey(uid));
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_chat_draft_clear',
			'localStorage companion draft clear failed',
			err
		);
	}
}

export type CompanionChatImageAttachment = {
	mime_type: string;
	data_base64: string;
};

export type CompanionChatRequestBody = {
	message: string;
	image_attachment?: CompanionChatImageAttachment | null;
	shell_context?: EwaCompanionShellContextV1 | null;
	use_web_search?: boolean;
	client_turn_id?: string;
};

export function newCompanionClientTurnId(): string {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.randomUUID === 'function'
	) {
		return crypto.randomUUID();
	}
	return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function postEwaCompanionChatMessage(
	body: CompanionChatRequestBody
): Promise<CompanionChatMessageResponse> {
	const res = await apiClient.post<
		CompanionChatMessageResponse & { actions?: unknown }
	>('/ewa/companion-chat/message', body, API_OPTIONS);
	const data = res.data;
	const tek = data.transform_event_kind;
	const turnPlanHint =
		typeof data.turn_plan_hint === 'string' && data.turn_plan_hint.trim()
			? data.turn_plan_hint.trim()
			: null;
	const turnPlanNextTool =
		typeof data.turn_plan_next_tool === 'string' &&
		data.turn_plan_next_tool.trim()
			? data.turn_plan_next_tool.trim()
			: null;
	const turnPlanSource =
		typeof data.turn_plan_source === 'string' && data.turn_plan_source.trim()
			? data.turn_plan_source.trim()
			: null;
	return {
		reply: data.reply,
		companion_revision: data.companion_revision,
		actions: coerceCompanionActions(data.actions),
		task_run: data.task_run ?? null,
		surface_blocks: coerceCompanionSurfaceBlocks(data.surface_blocks),
		output_surface:
			data.output_surface && typeof data.output_surface === 'object'
				? {
						mode:
							typeof data.output_surface.mode === 'string'
								? data.output_surface.mode
								: '',
						payload:
							data.output_surface.payload &&
							typeof data.output_surface.payload === 'object' &&
							!Array.isArray(data.output_surface.payload)
								? (data.output_surface.payload as Record<string, unknown>)
								: undefined,
					}
				: null,
		turn_plan_hint: turnPlanHint,
		turn_plan_next_tool: turnPlanNextTool,
		turn_plan_source: turnPlanSource,
		transformed_this_turn: Boolean(data.transformed_this_turn),
		transform_event_kind:
			typeof tek === 'string' && tek.trim() ? tek.trim() : null,
		desktop_config_patch_applied: Boolean(data.desktop_config_patch_applied),
		execution_reports: coerceExecutionReports(data.execution_reports),
		tool_trace: coerceToolTrace(data.tool_trace),
		web_search_result: coerceCompanionWebSearchResult(data.web_search_result),
		orchestration_outcome:
			typeof data.orchestration_outcome === 'string'
				? data.orchestration_outcome
				: null,
		proactive_suggestion: coerceProactiveSuggestion(data.proactive_suggestion),
	};
}

/**
 * Proactive observation hint payload (HCM Module B, project "Mela's Ascension").
 * Server returns a small templated hint without invoking the HTTP LLM. SPA may render it as a
 * pre-message bubble in the companion chat panel; nothing is appended to the persisted transcript.
 */
export type CompanionAnticipationHint = {
	kind: string;
	hint_text: string;
	related_episodes: string[];
	suggested_action: Record<string, unknown> | null;
};

export type CompanionObservationResponse = {
	ok: boolean;
	accepted: boolean;
	episode_recorded: boolean;
	hint: CompanionAnticipationHint | null;
};

export type CompanionObservationRequest = {
	trigger:
		| 'focus_change'
		| 'window_opened'
		| 'window_closed'
		| 'workspace_switched'
		| 'active_app_changed'
		| 'idle'
		| 'manual_tick';
	observation: Record<string, unknown>;
	shell_context?: EwaCompanionShellContextV1 | null;
};

export async function postEwaCompanionObservation(
	body: CompanionObservationRequest
): Promise<CompanionObservationResponse> {
	const res = await apiClient.post<CompanionObservationResponse>(
		COMPANION_OBSERVATION_PATH,
		body,
		API_OPTIONS
	);
	const data = res.data;
	return {
		ok: Boolean(data?.ok ?? true),
		accepted: Boolean(data?.accepted ?? false),
		episode_recorded: Boolean(data?.episode_recorded ?? false),
		hint:
			data?.hint && typeof data.hint === 'object'
				? {
						kind: String(data.hint.kind ?? 'anticipation'),
						hint_text: String(data.hint.hint_text ?? ''),
						related_episodes: Array.isArray(data.hint.related_episodes)
							? data.hint.related_episodes
									.map((line) => String(line ?? '').trim())
									.filter((line) => line.length > 0)
							: [],
						suggested_action:
							data.hint.suggested_action &&
							typeof data.hint.suggested_action === 'object'
								? (data.hint.suggested_action as Record<string, unknown>)
								: null,
					}
				: null,
	};
}
