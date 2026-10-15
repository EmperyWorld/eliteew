/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Professional Worlds OpenAPI pilot (crux paths + communication log create body).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildCommunicationLogCreatePayload } from '../realtorLogic';

const FRONTEND_ROOT = join(__dirname, '../../../../../');
const PILOT = join(
	FRONTEND_ROOT,
	'openapi/pilot/professional-worlds.openapi.json'
);
const CRUX_MANIFEST = join(
	FRONTEND_ROOT,
	'openapi/pilot-professional-worlds-crux-paths.json'
);
const WRITE_EXCEPTIONS_MANIFEST = join(
	FRONTEND_ROOT,
	'openapi/pilot-professional-worlds-write-path-exceptions.json'
);

type OpenApiPilot = {
	paths: Record<
		string,
		{
			get?: unknown;
			post?: unknown;
			put?: unknown;
			patch?: unknown;
		}
	>;
	components: {
		schemas: Record<
			string,
			{
				required?: string[];
				properties?: Record<string, unknown>;
			}
		>;
	};
};

describe('professional-worlds OpenAPI pilot contract', () => {
	it('crux paths from manifest exist in professional-worlds.openapi.json', () => {
		const { paths: expectedPaths } = JSON.parse(
			readFileSync(CRUX_MANIFEST, 'utf8')
		) as { paths: string[] };
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		for (const path of expectedPaths) {
			expect(
				spec.paths[path],
				`expected ${path} in openapi/pilot/professional-worlds.openapi.json`
			).toBeDefined();
		}
	});

	it('communication log POST declares CommunicationLogCreate request body', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		const route =
			spec.paths['/api/v1/professional-worlds/realtor/communication-logs'];
		expect(route?.post).toBeDefined();
		const schema = spec.components.schemas.CommunicationLogCreate;
		expect(schema?.required).toEqual(
			expect.arrayContaining(['related_type', 'channel', 'body'])
		);
	});

	it('buildCommunicationLogCreatePayload matches CommunicationLogCreate required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		const required =
			spec.components.schemas.CommunicationLogCreate?.required ?? [];
		const payload = buildCommunicationLogCreatePayload({
			relatedType: 'deal',
			relatedId: '11111111-1111-4111-8111-111111111111',
			channel: 'call',
			body: 'Follow up on offer',
		});
		expect(payload).not.toBeNull();
		for (const key of required) {
			expect(payload).toHaveProperty(key);
		}
		expect(Object.keys(payload ?? {})).toEqual(
			expect.arrayContaining([
				'related_type',
				'related_id',
				'channel',
				'body',
				'meta',
			])
		);
	});

	it('ProfessionalClientOut and ProfessionalDealOut declare CRM-lite required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(spec.components.schemas.ProfessionalClientCreate?.required).toEqual(
			expect.arrayContaining(['name'])
		);
		expect(spec.components.schemas.ProfessionalDealCreate?.required).toEqual(
			expect.arrayContaining(['title'])
		);
		expect(spec.components.schemas.ProfessionalClientOut?.required).toEqual(
			expect.arrayContaining([
				'name',
				'id',
				'user_id',
				'created_at',
				'updated_at',
			])
		);
		expect(spec.components.schemas.ProfessionalDealOut?.required).toEqual(
			expect.arrayContaining([
				'title',
				'id',
				'user_id',
				'created_at',
				'updated_at',
			])
		);
	});

	it('RealtorLeadOut and RealtorTaskOut declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(spec.components.schemas.RealtorLeadCreate?.required).toEqual(
			expect.arrayContaining(['name'])
		);
		expect(spec.components.schemas.RealtorPropertyCreate?.required).toEqual(
			expect.arrayContaining(['title'])
		);
		expect(spec.components.schemas.RealtorTaskCreate?.required).toEqual(
			expect.arrayContaining(['title'])
		);
		expect(
			spec.components.schemas.RealtorPropertyShowingCreate?.required
		).toEqual(expect.arrayContaining(['property_id', 'scheduled_at']));
		expect(
			spec.components.schemas.RealtorBuyerRequirementCreate?.required
		).toEqual(expect.arrayContaining(['title']));
		expect(spec.components.schemas.RealtorProDocumentCreate?.required).toEqual(
			expect.arrayContaining(['title'])
		);
		expect(spec.components.schemas.MarketingCampaignCreate?.required).toEqual(
			expect.arrayContaining(['title'])
		);
		expect(spec.components.schemas.DealEventAppend?.required).toEqual(
			expect.arrayContaining(['stage_to'])
		);
		expect(
			spec.components.schemas.RealtorPropertyMediaCreate?.required
		).toEqual(expect.arrayContaining(['unified_content_id']));
		expect(spec.components.schemas.RealtorMediaBatchCreate?.required).toEqual(
			expect.arrayContaining(['preset_key', 'source_content_ids'])
		);
		expect(
			spec.components.schemas.ProfessionalMediaAlbumCreate?.required
		).toEqual(expect.arrayContaining(['title']));
		expect(
			spec.components.schemas.RealtorMediaBatchItemReviewBody?.required
		).toEqual(expect.arrayContaining(['decision']));
		expect(spec.components.schemas.ObjectIntakeParseRequest?.required).toEqual(
			expect.arrayContaining(['source_text'])
		);
		expect(spec.components.schemas.ObjectIntakeCommitRequest?.required).toEqual(
			expect.arrayContaining(['job_id'])
		);
		expect(spec.components.schemas.RealtorLeadOut?.required).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'vertical_slug',
				'name',
				'status',
				'created_at',
				'updated_at',
			])
		);
		expect(spec.components.schemas.RealtorTaskOut?.required).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'title',
				'status',
				'priority',
				'created_at',
				'updated_at',
			])
		);
	});

	it('RealtorPropertyOut and RealtorPropertyShowingOut declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(spec.components.schemas.RealtorPropertyOut?.required).toEqual(
			expect.arrayContaining([
				'title',
				'id',
				'user_id',
				'created_at',
				'updated_at',
			])
		);
		expect(spec.components.schemas.RealtorPropertyShowingOut?.required).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'property_id',
				'scheduled_at',
				'status',
				'created_at',
				'updated_at',
			])
		);
	});

	it('ProfessionalLearningCourseOut and ProfessionalArtifactOut declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(
			spec.components.schemas.ProfessionalLearningCourseOut?.required
		).toEqual(
			expect.arrayContaining([
				'id',
				'course_key',
				'vertical_slug',
				'title',
				'level',
			])
		);
		expect(spec.components.schemas.ProfessionalArtifactOut?.required).toEqual(
			expect.arrayContaining([
				'id',
				'vertical_slug',
				'source_type',
				'title',
				'created_at',
			])
		);
	});

	it('ProfessionVerticalOut SpecialistProfileOut and RealtorProDocumentOut declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(spec.components.schemas.ProfessionVerticalOut?.required).toEqual(
			expect.arrayContaining(['slug', 'name'])
		);
		expect(spec.components.schemas.SpecialistProfileOut?.required).toEqual(
			expect.arrayContaining(['id', 'user_id', 'created_at', 'updated_at'])
		);
		expect(spec.components.schemas.RealtorProDocumentOut?.required).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'title',
				'doc_type',
				'created_at',
				'updated_at',
			])
		);
	});

	it('ProfessionalWorldsRuntimeConfig and ProfessionalPlaybookRunOut declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(
			spec.components.schemas.ProfessionalWorldsRuntimeConfig?.required
		).toEqual(expect.arrayContaining(['vertical_slug']));
		expect(
			spec.components.schemas.ProfessionalPlaybookRunOut?.required
		).toEqual(
			expect.arrayContaining([
				'id',
				'vertical_slug',
				'playbook_key',
				'status',
				'created_at',
				'updated_at',
			])
		);
		expect(
			spec.components.schemas.ProfessionalPlaybookRunArtifactOut?.required
		).toEqual(expect.arrayContaining(['step_order']));
	});

	it('RealtorBuyerRequirementOut MediaEnhancementJobOut and RealtorMediaBatchDetailOut declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(
			spec.components.schemas.RealtorBuyerRequirementOut?.required
		).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'title',
				'created_at',
				'updated_at',
			])
		);
		expect(spec.components.schemas.MediaEnhancementJobOut?.required).toEqual(
			expect.arrayContaining([
				'id',
				'property_id',
				'preset_key',
				'status',
				'created_at',
				'updated_at',
			])
		);
		expect(
			spec.components.schemas.RealtorMediaBatchDetailOut?.required
		).toEqual(expect.arrayContaining(['batch', 'items']));
	});

	it('RealtorMarketingCampaignOut and CoachSimulationBody declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(
			spec.components.schemas.RealtorMarketingCampaignOut?.required
		).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'title',
				'status',
				'created_at',
				'updated_at',
			])
		);
		expect(spec.components.schemas.CoachSimulationBody?.required).toEqual(
			expect.arrayContaining(['scenario', 'user_message'])
		);
	});

	it('ProfessionalDealPropertyLinkBackfillOut declares required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(
			spec.components.schemas.ProfessionalDealPropertyLinkBackfillOut?.required
		).toEqual(expect.arrayContaining(['updated', 'skipped']));
	});

	it('ObjectionReplyUpsert PublicationChannelUpsert and MediaEnhancementRequest declare required keys', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		expect(spec.components.schemas.ObjectionReplyUpsert?.required).toEqual(
			expect.arrayContaining(['reply_text'])
		);
		expect(spec.components.schemas.PublicationChannelUpsert?.required).toEqual(
			expect.arrayContaining(['channel_key'])
		);
		expect(spec.components.schemas.MediaEnhancementRequest?.required).toEqual(
			expect.arrayContaining(['content_id', 'preset_key'])
		);
		expect(
			spec.components.schemas.RealtorPublicationChannelOut?.required
		).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'property_id',
				'channel_key',
				'status',
				'created_at',
				'updated_at',
			])
		);
		expect(spec.components.schemas.RealtorObjectionReplyOut?.required).toEqual(
			expect.arrayContaining([
				'id',
				'user_id',
				'objection_key',
				'reply_text',
				'created_at',
				'updated_at',
			])
		);
	});

	it('write-path exceptions manifest lists documented api.ts outliers', () => {
		const manifest = JSON.parse(
			readFileSync(WRITE_EXCEPTIONS_MANIFEST, 'utf8')
		) as {
			empty_body_post: string[];
			no_body_post: string[];
			multipart: string[];
		};
		expect(manifest.empty_body_post.length).toBeGreaterThanOrEqual(6);
		expect(manifest.multipart).toEqual(
			expect.arrayContaining([
				'streamMediaUploadEnhancement',
				'uploadRealtorPropertyMedia',
			])
		);
	});

	it('ProfessionalPlaybookLaunchBody allows optional variables and idempotency_key', () => {
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as OpenApiPilot;
		const schema = spec.components.schemas.ProfessionalPlaybookLaunchBody;
		expect(schema?.properties?.variables).toBeDefined();
		expect(schema?.properties?.idempotency_key).toBeDefined();
		expect(schema?.required ?? []).toEqual([]);
	});
});
