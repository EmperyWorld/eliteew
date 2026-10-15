/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Zod runtime validation of companion chat SSE `data:` payloads
 * (`delta`, `final`, `actions`, `error`) before stream handlers dispatch.
 *
 * Invariants:
 * - No network — pure parse helpers only.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - openapi/pilot/ewa-companion-chat.openapi.json
 */
import {
	parseCompanionChatStreamActionsPayload,
	parseCompanionChatStreamDeltaPayload,
	parseCompanionChatStreamErrorPayload,
	parseCompanionChatStreamFinalPayload,
} from '@/services/ewa/ewaCompanionChatApi';
import { describe, expect, it } from 'vitest';

describe('parseCompanionChatStreamDeltaPayload', () => {
	it('accepts a valid delta payload', () => {
		expect(
			parseCompanionChatStreamDeltaPayload(JSON.stringify({ chunk: 'Hello' }))
		).toEqual({ chunk: 'Hello' });
	});

	it('returns null for malformed JSON', () => {
		expect(parseCompanionChatStreamDeltaPayload('{chunk:')).toBeNull();
	});

	it('rejects payloads missing chunk', () => {
		expect(parseCompanionChatStreamDeltaPayload('{}')).toBeNull();
	});
});

describe('parseCompanionChatStreamFinalPayload', () => {
	it('accepts a valid final payload with required fields', () => {
		expect(
			parseCompanionChatStreamFinalPayload(
				JSON.stringify({
					reply: 'Done',
					companion_revision: 2,
					turn_plan_hint: ' next ',
				})
			)
		).toMatchObject({
			reply: 'Done',
			companion_revision: 2,
			turn_plan_hint: ' next ',
		});
	});

	it('rejects final payloads missing companion_revision', () => {
		expect(
			parseCompanionChatStreamFinalPayload(
				JSON.stringify({ reply: 'Missing revision' })
			)
		).toBeNull();
	});

	it('rejects final payloads with companion_revision below minimum', () => {
		expect(
			parseCompanionChatStreamFinalPayload(
				JSON.stringify({ reply: 'Bad revision', companion_revision: 0 })
			)
		).toBeNull();
	});

	it('returns null for malformed JSON', () => {
		expect(parseCompanionChatStreamFinalPayload('not-json')).toBeNull();
	});
});

describe('parseCompanionChatStreamActionsPayload', () => {
	it('accepts a valid actions envelope', () => {
		expect(
			parseCompanionChatStreamActionsPayload(
				JSON.stringify({ actions: [{ type: 'open_app', app_id: 'notes' }] })
			)
		).toEqual({
			actions: [{ type: 'open_app', app_id: 'notes' }],
		});
	});

	it('returns null for malformed JSON', () => {
		expect(parseCompanionChatStreamActionsPayload('{')).toBeNull();
	});
});

describe('parseCompanionChatStreamErrorPayload', () => {
	it('accepts a valid error payload', () => {
		expect(
			parseCompanionChatStreamErrorPayload(
				JSON.stringify({ code: 'companion_chat_llm_disabled' })
			)
		).toEqual({ code: 'companion_chat_llm_disabled' });
	});

	it('rejects empty code strings', () => {
		expect(
			parseCompanionChatStreamErrorPayload(JSON.stringify({ code: '' }))
		).toBeNull();
	});

	it('returns null for malformed JSON', () => {
		expect(parseCompanionChatStreamErrorPayload('[]')).toBeNull();
	});
});
