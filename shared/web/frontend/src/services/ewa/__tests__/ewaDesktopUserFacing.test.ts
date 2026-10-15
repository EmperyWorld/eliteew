/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract-style tests for **EWA desktop user-facing mappers** (`ewaDesktopUserFacing.ts`): observation summaries,
 * turn outcomes, timeline rows, SSE log parsing.
 *
 * Invariants:
 * - Assertions target stable **i18n key paths** and structural outputs — not translated prose.
 *
 * Related:
 * - src/services/ewa/ewaDesktopUserFacing.ts
 */
import type { EwaDesktopOrchTurnResponseEnvelope } from '@/services/ewa/ewaDesktopOrchApi';
import {
	extractTimelineFromEnvelope,
	mapOrchestrationEventToTimelineRow,
	persistenceNeedsFriendlyWarning,
	summarizeObservationForUser,
	summarizeTurnOutcomeFromSession,
	timelineRowsFromSseLogText,
} from '@/services/ewa/ewaDesktopUserFacing';
import { describe, expect, it } from 'vitest';

describe('ewaDesktopUserFacing', () => {
	it('summarizes window_list_snapshot with window count', () => {
		expect(
			summarizeObservationForUser({
				observation_kind: 'window_list_snapshot',
				windows: [{ window_id: 'a' }, { window_id: 'b' }],
			})
		).toEqual({
			messageKey: 'ewaDesktop.obsSummary.windowList',
			params: { count: 2 },
		});
	});

	it('summarizes active_app_changed without exposing wire ids in key', () => {
		expect(
			summarizeObservationForUser({
				observation_kind: 'active_app_changed',
				app_component: 'EwaApp',
				window_id: 'app:EwaApp:0',
			}).messageKey
		).toBe('ewaDesktop.obsSummary.activeApp');
	});

	it('maps intent_executed session snapshot to headline + intent line keys', () => {
		const out = summarizeTurnOutcomeFromSession({
			last_branch: 'intent_executed',
			last_intent_kind: 'open_app',
		});
		expect(out?.headline.messageKey).toBe('ewaDesktop.turnOutcome.done');
		expect(out?.intentLine?.messageKey).toBe(
			'ewaDesktop.intentSummary.open_app'
		);
	});

	it('maps orchestration intent_result event to actionApplied row', () => {
		const row = mapOrchestrationEventToTimelineRow(
			{
				kind: 'intent_result',
				intent: { intent_kind: 'focus_window' },
				result: {},
			},
			0
		);
		expect(row.messageKey).toBe('ewaDesktop.timeline.actionApplied');
		expect(row.params?.intentSummaryKey).toBe(
			'ewaDesktop.intentSummary.focus_window'
		);
	});

	it('extracts timeline rows from turn envelope payload.events', () => {
		const env = {
			api_version: '1',
			message_type: 'result',
			correlation_id: 'corr',
			payload: {
				events: [{ kind: 'policy_denied', intent: { intent_kind: 'noop' } }],
			},
		} as unknown as EwaDesktopOrchTurnResponseEnvelope;
		const rows = extractTimelineFromEnvelope(env);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.messageKey).toBe('ewaDesktop.timeline.stepBlocked');
	});

	it('parses newline-separated JSON bodies from SSE client lines', () => {
		const log = [
			JSON.stringify({
				kind: 'observation',
				payload: { observation_kind: 'window_list_snapshot', windows: [] },
			}),
			JSON.stringify({
				kind: 'companion_context',
				client: {},
			}),
		].join('\n');
		const rows = timelineRowsFromSseLogText(log);
		expect(rows).toHaveLength(2);
		expect(rows[1]?.messageKey).toBe('ewaDesktop.timeline.companionSynced');
	});

	it('detects ephemeral persistence warning flag', () => {
		expect(
			persistenceNeedsFriendlyWarning({ persisted_across_requests: false })
		).toBe(true);
		expect(
			persistenceNeedsFriendlyWarning({ persisted_across_requests: true })
		).toBe(false);
	});
});
