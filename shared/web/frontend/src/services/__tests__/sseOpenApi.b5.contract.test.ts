/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Wave B5 SSE SoT: regenerable pilots document text/event-stream $ref
 * (B5a EWA/MF + B5b PW text/media/playbook + Marketing AI/chat/AMKA); hand
 * companion-chat overlay includes CompanionSurfaceBlockOut + stream event schemas.
 *
 * Related:
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(__dirname, '../../../');
const EWA_PILOT = join(FRONTEND_ROOT, 'openapi/pilot/ewa.openapi.json');
const MF_PILOT = join(FRONTEND_ROOT, 'openapi/pilot/music-forge.openapi.json');
const PW_PILOT = join(
	FRONTEND_ROOT,
	'openapi/pilot/professional-worlds.openapi.json'
);
const MARKETING_LITE_PILOT = join(
	FRONTEND_ROOT,
	'openapi/pilot/marketing-cabinet.openapi.json'
);
const MARKETING_FULL_PILOT = join(
	FRONTEND_ROOT,
	'openapi/pilot/marketing-cabinet-full.openapi.json'
);
const HAND_PILOT = join(
	FRONTEND_ROOT,
	'openapi/pilot/ewa-companion-chat.openapi.json'
);

type Pilot = {
	paths: Record<
		string,
		Record<
			string,
			{
				responses?: Record<
					string,
					{
						content?: {
							'text/event-stream'?: {
								schema?: {
									$ref?: string;
									oneOf?: Array<{ $ref?: string }>;
								};
							};
						};
					}
				>;
			}
		>
	>;
	components?: { schemas?: Record<string, unknown> };
};

function eventStreamSchema(pilot: Pilot, path: string, method: string) {
	const op = pilot.paths[path]?.[method];
	expect(op, path).toBeTruthy();
	const schema = op?.responses?.['200']?.content?.['text/event-stream']?.schema;
	expect(schema, `${method} ${path}`).toBeTruthy();
	return schema;
}

describe('SSE OpenAPI SoT (Wave B5)', () => {
	it('regenerable ewa pilot stream paths $ref named payload docs', () => {
		const pilot = JSON.parse(readFileSync(EWA_PILOT, 'utf8')) as Pilot;
		const chat = eventStreamSchema(
			pilot,
			'/api/v1/ewa/companion-chat/stream',
			'post'
		);
		expect(chat?.$ref).toBe(
			'#/components/schemas/CompanionChatStreamPayloadDoc'
		);
		const task = eventStreamSchema(
			pilot,
			'/api/v1/ewa/companion-chat/task-events/stream',
			'get'
		);
		expect(task?.$ref).toBe(
			'#/components/schemas/CompanionTaskLifecycleSsePayloadDoc'
		);
		const desk = eventStreamSchema(
			pilot,
			'/api/v1/ewa/desktop-orchestration/sessions/{session_id}/events',
			'get'
		);
		expect(desk?.$ref).toBe(
			'#/components/schemas/EwaDesktopOrchestrationSseEventOut'
		);
		expect(pilot.components?.schemas?.CompanionSurfaceBlockOut).toBeTruthy();
		expect(pilot.components?.schemas?.CompanionChatStreamDelta).toBeTruthy();
	});

	it('music-forge run events stream $ref MusicForgeRunEventsSsePayloadDoc', () => {
		const pilot = JSON.parse(readFileSync(MF_PILOT, 'utf8')) as Pilot;
		const schema = eventStreamSchema(
			pilot,
			'/api/v1/music-forge/runs/{run_id}/events',
			'get'
		);
		expect(schema?.$ref).toBe(
			'#/components/schemas/MusicForgeRunEventsSsePayloadDoc'
		);
	});

	it('professional-worlds text AI streams $ref ProfessionalWorldsAiTextStreamSsePayloadDoc (B5b)', () => {
		const pilot = JSON.parse(readFileSync(PW_PILOT, 'utf8')) as Pilot;
		const paths = [
			'/api/v1/professional-worlds/realtor/properties/{property_id}/generate-description/stream',
			'/api/v1/professional-worlds/realtor/properties/{property_id}/generate-content-pack/stream',
			'/api/v1/professional-worlds/coach/simulate/stream',
		] as const;
		for (const path of paths) {
			const schema = eventStreamSchema(pilot, path, 'post');
			expect(schema?.$ref).toBe(
				'#/components/schemas/ProfessionalWorldsAiTextStreamSsePayloadDoc'
			);
		}
		expect(
			pilot.components?.schemas?.ProfessionalWorldsAiTextStreamSsePayloadDoc
		).toBeTruthy();
		expect(
			pilot.components?.schemas?.ProfessionalWorldsAiSseResultOut
		).toBeTruthy();
		expect(pilot.components?.schemas?.ProfessionalArtifactOut).toBeTruthy();
	});

	it('professional-worlds intake/media/playbook streams $ref named B5b residual docs', () => {
		const pilot = JSON.parse(readFileSync(PW_PILOT, 'utf8')) as Pilot;
		const contracts = [
			[
				'/api/v1/professional-worlds/realtor/properties/intake/parse/stream',
				'ProfessionalWorldsIntakeStreamSsePayloadDoc',
			],
			[
				'/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/stream',
				'ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc',
			],
			[
				'/api/v1/professional-worlds/realtor/properties/{property_id}/media/upload-enhance/stream',
				'ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc',
			],
			[
				'/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/batches/{batch_id}/run/stream',
				'ProfessionalWorldsMediaBatchStreamSsePayloadDoc',
			],
			[
				'/api/v1/professional-worlds/playbooks/{vertical_slug}/{playbook_key}/stream',
				'ProfessionalWorldsPlaybookStreamSsePayloadDoc',
			],
			[
				'/api/v1/professional-worlds/playbook-runs/{run_id}/resume/stream',
				'ProfessionalWorldsPlaybookStreamSsePayloadDoc',
			],
		] as const;
		for (const [path, expected] of contracts) {
			const schema = eventStreamSchema(pilot, path, 'post');
			expect(schema?.$ref).toBe(`#/components/schemas/${expected}`);
			expect(pilot.components?.schemas?.[expected]).toBeTruthy();
		}
	});

	it('marketing cabinet AI/chat streams $ref named B5b docs (lite pilot)', () => {
		const pilot = JSON.parse(
			readFileSync(MARKETING_LITE_PILOT, 'utf8')
		) as Pilot;
		const ai = eventStreamSchema(
			pilot,
			'/api/v1/marketing-cabinet/ai/assist/stream',
			'post'
		);
		expect(ai?.$ref).toBe(
			'#/components/schemas/MarketingAiAssistStreamSsePayloadDoc'
		);
		const chat = eventStreamSchema(
			pilot,
			'/api/v1/marketing-cabinet/chat/message/stream',
			'post'
		);
		expect(chat?.$ref).toBe(
			'#/components/schemas/MarketingChatStreamSsePayloadDoc'
		);
		expect(
			pilot.components?.schemas?.MarketingAiAssistStreamSsePayloadDoc
		).toBeTruthy();
		expect(
			pilot.components?.schemas?.MarketingChatStreamSsePayloadDoc
		).toBeTruthy();
		expect(pilot.components?.schemas?.MarketingAiRunOut).toBeTruthy();
	});

	it('marketing cabinet AMKA run events $ref AmkaRunEventsStreamSsePayloadDoc (full pilot)', () => {
		const pilot = JSON.parse(
			readFileSync(MARKETING_FULL_PILOT, 'utf8')
		) as Pilot;
		const schema = eventStreamSchema(
			pilot,
			'/api/v1/marketing-cabinet/amka/runs/{run_id}/events',
			'get'
		);
		expect(schema?.$ref).toBe(
			'#/components/schemas/AmkaRunEventsStreamSsePayloadDoc'
		);
		expect(
			pilot.components?.schemas?.AmkaRunEventsStreamSsePayloadDoc
		).toBeTruthy();
		expect(pilot.components?.schemas?.AmkaRunProgressSnapshotOut).toBeTruthy();
	});

	it('hand companion-chat overlay shares SurfaceBlock + stream event schemas', () => {
		const hand = JSON.parse(readFileSync(HAND_PILOT, 'utf8')) as Pilot;
		expect(hand.components?.schemas?.CompanionSurfaceBlockOut).toBeTruthy();
		expect(hand.components?.schemas?.CompanionChatStreamDelta).toBeTruthy();
		expect(hand.components?.schemas?.CompanionChatStreamFinal).toBeTruthy();
		const final = hand.components?.schemas?.CompanionChatStreamFinal as {
			properties?: { surface_blocks?: unknown };
		};
		expect(final?.properties?.surface_blocks).toBeTruthy();
		const schema = eventStreamSchema(
			hand,
			'/api/v1/ewa/companion-chat/stream',
			'post'
		);
		const refs = (schema?.oneOf ?? [])
			.map((x) => x.$ref)
			.filter(Boolean) as string[];
		expect(refs).toContain('#/components/schemas/CompanionChatStreamDelta');
		expect(refs).toContain('#/components/schemas/CompanionChatStreamFinal');
	});
});
