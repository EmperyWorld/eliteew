/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for the hand-written EWA desktop orchestration client and its OpenAPI pilot paths.
 *
 * Invariants:
 * - Payload kinds and `/api/v1/ewa/desktop-orchestration/*` paths stay aligned with backend routers.
 * - No network: tests inspect pure client helpers and pilot JSON only.
 *
 * Related:
 * - src/services/ewa/ewaDesktopOrchApi.ts
 * - shared/api/ewa_platform/gateways/routers/desktop.py
 * - openapi/pilot/ewa-desktop-orchestration.openapi.json
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_ORCHESTRATION_RESULT_V1_PAYLOAD_KIND,
	DESKTOP_ORCHESTRATION_V1_PAYLOAD_KIND,
	EWA_PLATFORM_IO_API_VERSION,
	buildDesktopOrchestrationSignalEnvelope,
	desktopOrchestrationSessionEventsPath,
	extractLastIntentKindFromTurnEnvelope,
	type EwaDesktopOrchTurnResponseEnvelope,
} from '../ewaDesktopOrchApi';

const PILOT = join(
	__dirname,
	'../../../../openapi/pilot/ewa-desktop-orchestration.openapi.json'
);

describe('EWA desktop orchestration client contract', () => {
	it('builds the envelope expected by routers/ewa_desktop.py', () => {
		const env = buildDesktopOrchestrationSignalEnvelope({
			correlationId: 'corr-1',
			sessionId: 'sess-1',
			observation: { observation_kind: 'user_cancelled', reason: 'test' },
		});

		expect(env.api_version).toBe(EWA_PLATFORM_IO_API_VERSION);
		expect(env.message_type).toBe('signal');
		expect(env.correlation_id).toBe('corr-1');
		expect(env.payload).toEqual({
			kind: DESKTOP_ORCHESTRATION_V1_PAYLOAD_KIND,
			session_id: 'sess-1',
			observation: { observation_kind: 'user_cancelled', reason: 'test' },
		});
	});

	it('optional metadata.companion is attached when provided', () => {
		const env = buildDesktopOrchestrationSignalEnvelope({
			correlationId: 'c2',
			sessionId: 's2',
			observation: { observation_kind: 'user_cancelled', reason: 'r' },
			metadata: {
				companion: { seed_persona_id: 'mela', expect_companion_revision: 4 },
			},
		});
		expect(env.payload).toMatchObject({
			kind: DESKTOP_ORCHESTRATION_V1_PAYLOAD_KIND,
			session_id: 's2',
			metadata: {
				companion: { seed_persona_id: 'mela', expect_companion_revision: 4 },
			},
		});
	});

	it('resolves the SSE path under the canonical EWA prefix and encodes session ids', () => {
		expect(desktopOrchestrationSessionEventsPath('sess 1/2', false)).toBe(
			'/ewa/desktop-orchestration/sessions/sess%201%2F2/events'
		);
		expect(desktopOrchestrationSessionEventsPath('sess', true)).toBe(
			'/ewa/desktop-orchestration/sessions/sess/events?follow=true'
		);
	});

	it('extracts the last executed intent kind from a result envelope', () => {
		const env: EwaDesktopOrchTurnResponseEnvelope = {
			api_version: EWA_PLATFORM_IO_API_VERSION,
			message_type: 'result',
			correlation_id: 'corr',
			payload: {
				kind: DESKTOP_ORCHESTRATION_RESULT_V1_PAYLOAD_KIND,
				events: [
					{ kind: 'intent_result', intent: { intent_kind: 'open_app' } },
					{ kind: 'intent_result', intent: { intent_kind: 'focus_window' } },
				],
			},
		};

		expect(extractLastIntentKindFromTurnEnvelope(env)).toBe('focus_window');
	});

	it('OpenAPI pilot documents turn and SSE operation ids', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<
				string,
				{
					get?: { operationId?: string };
					post?: {
						operationId?: string;
						requestBody?: {
							content?: {
								'application/json'?: { schema?: { $ref?: string } };
							};
						};
					};
				}
			>;
			components?: { schemas?: Record<string, { properties?: object }> };
		};

		expect(
			spec.paths['/api/v1/ewa/desktop-orchestration/turn']?.post?.operationId
		).toBe('ewa_desktop_orchestration_turn');
		expect(
			spec.paths[
				'/api/v1/ewa/desktop-orchestration/sessions/{session_id}/events'
			]?.get?.operationId
		).toBe('ewa_desktop_orchestration_session_events_sse');

		const turnSchemaRef =
			spec.paths['/api/v1/ewa/desktop-orchestration/turn']?.post?.requestBody
				?.content?.['application/json']?.schema?.$ref;
		expect(turnSchemaRef).toBe(
			'#/components/schemas/EwaDesktopOrchestrationTurnRequestEnvelope'
		);

		const schemas = spec.components?.schemas;
		type SchemaEntry = { enum?: unknown; properties?: Record<string, unknown> };
		const personaIdSchema = schemas?.EwaCatalogSeedPersonaId as
			| SchemaEntry
			| undefined;
		expect(personaIdSchema?.enum).toEqual(
			expect.arrayContaining(['mela', 'parent'])
		);
		const hintsSchema = schemas?.EwaDesktopOrchestrationCompanionHints as
			| SchemaEntry
			| undefined;
		expect(hintsSchema?.properties).toMatchObject({
			seed_persona_id: { $ref: '#/components/schemas/EwaCatalogSeedPersonaId' },
			client_seed_persona_id: {
				$ref: '#/components/schemas/EwaCatalogSeedPersonaId',
			},
			expect_companion_revision: expect.objectContaining({
				type: 'integer',
				minimum: 1,
			}),
		});
		const payloadMeta = schemas?.EwaDesktopOrchestrationPayloadMetadata as
			| SchemaEntry
			| undefined;
		expect(payloadMeta?.properties?.companion).toEqual({
			$ref: '#/components/schemas/EwaDesktopOrchestrationCompanionHints',
		});
	});
});
