/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Zod validation inside **`coerceCompanionActions`** — notice rows must match the OpenAPI
 * pilot; invalid notice outcomes are dropped; legacy JSON-string action arrays remain supported.
 *
 * Invariants:
 * - No network — pure coercion only.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - src/generated/ewa-companion-chat-openapi.ts
 */
import { coerceCompanionActions } from '@/services/ewa/ewaCompanionChatApi';
import { describe, expect, it } from 'vitest';

describe('coerceCompanionActions Zod notice boundary', () => {
	it('accepts a valid companion_action_notice row', () => {
		expect(
			coerceCompanionActions([
				{
					type: 'companion_action_notice',
					outcome: 'blocked',
					rationale: 'Tool pool busy',
				},
			])
		).toEqual([
			{
				type: 'companion_action_notice',
				outcome: 'blocked',
				rationale: 'Tool pool busy',
			},
		]);
	});

	it('defaults missing notice outcome to failed after Zod pass', () => {
		expect(
			coerceCompanionActions([
				{
					type: 'companion_action_notice',
					rationale: 'No desktop action emitted',
				},
			])
		).toEqual([
			{
				type: 'companion_action_notice',
				outcome: 'failed',
				rationale: 'No desktop action emitted',
			},
		]);
	});

	it('rejects notice rows with invalid outcome enum', () => {
		expect(
			coerceCompanionActions([
				{
					type: 'companion_action_notice',
					outcome: 'unknown_outcome',
					rationale: 'Should be dropped',
				},
			])
		).toEqual([]);
	});

	it('rejects notice rows with rationale over OpenAPI maxLength', () => {
		expect(
			coerceCompanionActions([
				{
					type: 'companion_action_notice',
					outcome: 'failed',
					rationale: 'x'.repeat(501),
				},
			])
		).toEqual([]);
	});

	it('still parses legacy JSON-encoded actions array string', () => {
		const payload = JSON.stringify([
			{ type: 'open_app', app_component: 'ClipboardManager' },
			{
				type: 'companion_action_notice',
				outcome: 'failed',
				rationale: 'From string payload',
			},
		]);
		expect(coerceCompanionActions(payload)).toEqual([
			{ type: 'open_app', app_component: 'ClipboardManager' },
			{
				type: 'companion_action_notice',
				outcome: 'failed',
				rationale: 'From string payload',
			},
		]);
	});
});
