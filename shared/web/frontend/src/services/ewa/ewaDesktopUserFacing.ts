/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map EWA desktop orchestration wire shapes (observations, session snapshots, journal events, SSE JSON lines)
 * to **i18n message keys** for the consumer-facing EWA desktop window — without exposing internal identifiers in UI copy.
 *
 * Invariants:
 * - Catalog alignment: observation kinds per `OBSERVATION-CATALOG.md`, intents per `INTENT-CATALOG.md`, journal kinds from `core/orchestrator.py`.
 * - Unknown kinds fall back to neutral generic keys (`ewaDesktop.*.generic`) — never throw from mappers.
 *
 * Related:
 * - src/features/ewa/EwaDesktopView.tsx
 * - shared/api/ewa_platform/docs/OBSERVATION-CATALOG.md
 * - shared/api/ewa_platform/docs/INTENT-CATALOG.md
 */

import type { EwaDesktopOrchTurnResponseEnvelope } from '@/services/ewa/ewaDesktopOrchApi';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

/** Resolved copy is applied via `t(messageKey, params)` in React. */
export type UserFacingMessageRef = {
	messageKey: string;
	params?: Record<string, string | number>;
};

export type UserFacingTimelineRow = UserFacingMessageRef & {
	id: string;
};

const INTENT_SUMMARY_KEYS: Record<string, string> = {
	open_app: 'ewaDesktop.intentSummary.open_app',
	focus_window: 'ewaDesktop.intentSummary.focus_window',
	close_window: 'ewaDesktop.intentSummary.close_window',
	patch_shell_state: 'ewaDesktop.intentSummary.patch_shell_state',
	navigate_deep_link: 'ewaDesktop.intentSummary.navigate_deep_link',
	noop: 'ewaDesktop.intentSummary.noop',
};

function safeRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

/** Maps the observation payload sent on a turn to a short user-facing line (translation key). */
export function summarizeObservationForUser(
	obs: Record<string, unknown>
): UserFacingMessageRef {
	const kind = obs.observation_kind;
	if (kind === 'window_list_snapshot') {
		const wins = obs.windows;
		const count = Array.isArray(wins) ? wins.length : 0;
		return {
			messageKey: 'ewaDesktop.obsSummary.windowList',
			params: { count },
		};
	}
	if (kind === 'active_app_changed') {
		return { messageKey: 'ewaDesktop.obsSummary.activeApp' };
	}
	if (kind === 'user_cancelled') {
		return { messageKey: 'ewaDesktop.obsSummary.userCancelled' };
	}
	if (kind === 'intent_execution_failed') {
		return { messageKey: 'ewaDesktop.obsSummary.actionDidNotWork' };
	}
	return { messageKey: 'ewaDesktop.obsSummary.generic' };
}

function intentKindToSummaryKey(intentKind: string): string {
	const trimmed = intentKind.trim();
	return INTENT_SUMMARY_KEYS[trimmed] ?? 'ewaDesktop.intentSummary.generic';
}

export type TurnOutcomeUserFacing = {
	headline: UserFacingMessageRef;
	/** Optional second line when branch is intent_executed. */
	intentLine?: UserFacingMessageRef;
};

/**
 * Summarize `payload.session` after a turn (`last_branch`, `last_intent_kind`).
 */
export function summarizeTurnOutcomeFromSession(
	session: Record<string, unknown> | undefined
): TurnOutcomeUserFacing | null {
	if (!session) {
		return null;
	}
	const branch = session.last_branch;
	const rawIntent = session.last_intent_kind;
	const intentKind =
		typeof rawIntent === 'string' && rawIntent.trim() ? rawIntent.trim() : null;

	if (branch === 'no_intent') {
		return { headline: { messageKey: 'ewaDesktop.turnOutcome.noAction' } };
	}
	if (branch === 'policy_denied') {
		return { headline: { messageKey: 'ewaDesktop.turnOutcome.notAllowed' } };
	}
	if (branch === 'intent_executed') {
		return {
			headline: { messageKey: 'ewaDesktop.turnOutcome.done' },
			intentLine: {
				messageKey: intentKindToSummaryKey(intentKind ?? 'generic'),
			},
		};
	}
	return { headline: { messageKey: 'ewaDesktop.turnOutcome.unknown' } };
}

function readIntentKindFromProposedIntent(intent: unknown): string | null {
	const rec = safeRecord(intent);
	if (!rec) {
		return null;
	}
	const ik = rec.intent_kind;
	return typeof ik === 'string' && ik.trim() ? ik.trim() : null;
}

/** Map one persisted orchestration journal row to a timeline line. */
export function mapOrchestrationEventToTimelineRow(
	event: Record<string, unknown>,
	index: number
): UserFacingTimelineRow {
	const kind = event.kind;
	const id = String(index);

	if (kind === 'observation') {
		const payload = safeRecord(event.payload);
		if (payload) {
			const sub = summarizeObservationForUser(payload);
			return { id, messageKey: sub.messageKey, params: sub.params };
		}
		return { id, messageKey: 'ewaDesktop.timeline.observationGeneric' };
	}

	if (kind === 'domain_hints') {
		return { id, messageKey: 'ewaDesktop.timeline.contextEnriched' };
	}

	if (kind === 'policy_denied') {
		return { id, messageKey: 'ewaDesktop.timeline.stepBlocked' };
	}

	if (kind === 'intent_result') {
		const ik = readIntentKindFromProposedIntent(event.intent) ?? 'generic';
		return {
			id,
			messageKey: 'ewaDesktop.timeline.actionApplied',
			params: { intentSummaryKey: intentKindToSummaryKey(ik) },
		};
	}

	if (kind === 'companion_context') {
		return { id, messageKey: 'ewaDesktop.timeline.companionSynced' };
	}

	return { id, messageKey: 'ewaDesktop.timeline.genericStep' };
}

/** Build timeline rows from the synchronous turn envelope. */
export function extractTimelineFromEnvelope(
	env: EwaDesktopOrchTurnResponseEnvelope | null
): UserFacingTimelineRow[] {
	if (!env) {
		return [];
	}
	const payload = safeRecord(env.payload);
	if (!payload) {
		return [];
	}
	const events = payload.events;
	if (!Array.isArray(events)) {
		return [];
	}
	return events.map((e, i) => {
		const rec = safeRecord(e);
		if (rec) {
			return mapOrchestrationEventToTimelineRow(rec, i);
		}
		return {
			id: String(i),
			messageKey: 'ewaDesktop.timeline.genericStep',
		};
	});
}

/** True when session history is not kept across requests (dev / missing DB). */
export function persistenceNeedsFriendlyWarning(persistence: unknown): boolean {
	const rec = safeRecord(persistence);
	if (!rec) {
		return false;
	}
	return rec.persisted_across_requests === false;
}

/**
 * Parse newline-separated JSON bodies as emitted by EWA orchestration SSE (`data:` payload lines only —
 * the HTTP client already strips the `data:` prefix).
 */
export function timelineRowsFromSseLogText(
	log: string
): UserFacingTimelineRow[] {
	const lines = log
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);
	const rows: UserFacingTimelineRow[] = [];
	let idx = 0;
	for (const line of lines) {
		try {
			const parsed: unknown = JSON.parse(line);
			const rec = safeRecord(parsed);
			if (rec) {
				rows.push(mapOrchestrationEventToTimelineRow(rec, idx));
				idx += 1;
			}
		} catch (err) {
			ewaCompanionDegradeDebug(
				'ewa_desktop_timeline_sse_line',
				'orchestration SSE log line JSON parse skipped',
				err
			);
		}
	}
	return rows;
}
