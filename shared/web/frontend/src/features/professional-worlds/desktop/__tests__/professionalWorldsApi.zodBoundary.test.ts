/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod boundary tests for Professional Worlds OpenAPI pilot payloads and API parsers.
 */

import {
	communicationLogCreateSchema,
	communicationLogOutSchema,
	parseProfessionalClientOut,
	parseProfessionalClientOutList,
	parseProfessionalDealOut,
	parseProfessionalArtifactOutList,
	parseProfessionalLearningCourseOutList,
	parseProfessionalPlaybookRunOut,
	parseProfessionalPlaybookRunOutList,
	parseProfessionalWorldsRuntimeConfigOut,
	parseObjectIntakeStreamPreview,
	parseObjectIntakeCommitRequestBody,
	parseObjectIntakeParseRequestBody,
	parseBrandVisualKitUpsertBody,
	parseProfessionalPlaybookLaunchBody,
	parseProfessionalVerticalActivationUpsertBody,
	parseRealtorPropertyDraftPayloadBody,
	parseCommunicationLogCreateBody,
	parseProfessionalClientCreateBody,
	parseProfessionalDealCreateBody,
	parseProfessionalDealUpdateBody,
	parseRealtorLeadCreateBody,
	parseRealtorPropertyCreateBody,
	parseRealtorPropertyShowingCreateBody,
	dealEventAppendSchema,
	marketingCampaignCreateSchema,
	marketingCampaignUpdateSchema,
	parseDealEventAppendBody,
	parseMarketingCampaignCreateBody,
	parseMarketingCampaignUpdateBody,
	parseRealtorBuyerRequirementCreateBody,
	parseRealtorBuyerRequirementUpdateBody,
	parseRealtorProDocumentCreateBody,
	parseRealtorProDocumentUpdateBody,
	parseSpecialistProfileUpsertBody,
	parseRealtorTaskCreateBody,
	parseObjectionReplyUpsertBody,
	parsePublicationChannelPatchBody,
	parsePublicationChannelUpsertBody,
	parseProfessionalMediaAlbumCreateBody,
	parseProfessionalMediaAlbumPatchBody,
	parseProfessionalVerticalOnboardingPatchBody,
	parsePriceAnalysisSnapshotCreateBody,
	parseProfessionalDealPropertyLinkBackfillOut,
	parseRealtorMediaBatchDetailOut,
	parseRealtorMediaBatchCreateBody,
	parseRealtorMediaBatchItemReviewBody,
	parseRealtorPropertyMediaCreateBody,
	parseProfessionalWorldsSnapshotOut,
	parseRealtorCommunicationLogOutList,
	parseRealtorLeadConvertOut,
	parseRealtorLeadOutList,
	parseRealtorProDocumentOutList,
	parseRealtorPropertyOutList,
	parseRealtorPropertyShowingOut,
	parseRealtorTaskOut,
	parseStreamProfessionalArtifactOut,
	professionalArtifactOutSchema,
	professionalClientOutSchema,
	professionalClientCreateSchema,
	professionalDealCreateSchema,
	professionalDealUpdateSchema,
	professionalDealOutSchema,
	professionalLearningCourseOutSchema,
	professionalPlaybookRunOutSchema,
	professionalWorldsRuntimeConfigOutSchema,
	realtorBuyerRequirementCreateSchema,
	realtorBuyerRequirementOutSchema,
	realtorBuyerRequirementUpdateSchema,
	realtorProDocumentCreateSchema,
	realtorProDocumentUpdateSchema,
	realtorMarketingCampaignOutSchema,
	realtorMediaBatchDetailOutSchema,
	realtorGenerationBodySchema,
	mediaEnhancementRequestSchema,
	brandVisualKitUpsertSchema,
	objectIntakeCommitRequestSchema,
	objectIntakeParseRequestSchema,
	objectIntakePreviewSchema,
	objectionReplyUpsertSchema,
	publicationChannelPatchSchema,
	publicationChannelUpsertSchema,
	professionalDealPropertyLinkBackfillOutSchema,
	professionalMediaAlbumCreateSchema,
	professionalMediaAlbumPatchSchema,
	professionalPlaybookLaunchBodySchema,
	professionalUserVerticalActivationUpsertSchema,
	realtorMediaBatchCreateSchema,
	realtorMediaBatchItemReviewBodySchema,
	realtorPropertyMediaCreateSchema,
	realtorPublicationChannelOutSchema,
	realtorPropertyMediaOutSchema,
	professionVerticalOutSchema,
	realtorLeadOutSchema,
	realtorLeadCreateSchema,
	realtorPropertyCreateSchema,
	realtorPropertyDraftPayloadSchema,
	realtorPropertyShowingCreateSchema,
	realtorTaskCreateSchema,
	realtorProDocumentOutSchema,
	realtorPropertyOutSchema,
	realtorPropertyShowingOutSchema,
	realtorTaskOutSchema,
	snapshotOutSchema,
	specialistProfileOutSchema,
	specialistProfileUpsertSchema,
	ProfessionalWorldsApiParseError,
} from '../professionalWorldsApiZod';
import { mapProfessionalWorldsSnapshotApiRow } from '../professionalWorldsSnapshotUtils';
import { buildCommunicationLogCreatePayload } from '../realtorLogic';

const minimalPropertyOutRow = {
	id: '11111111-1111-4111-8111-111111111111',
	user_id: '55555555-5555-4555-8555-555555555555',
	title: 'Sea View',
	property_type: 'apartment',
	deal_type: 'sale',
	city: 'Vladivostok',
	district: null,
	address: null,
	price: null,
	area_m2: null,
	rooms: null,
	floor: null,
	total_floors: null,
	view: null,
	infrastructure: [],
	jtbd_context: {},
	facts: {},
	status: 'draft',
	created_at: '2026-05-27T09:00:00Z',
	updated_at: '2026-05-27T09:00:00Z',
};

const minimalSnapshotRow = {
	verticals: [{ slug: 'realtor', name: 'Realtor' }],
	runtime_config: { vertical_slug: 'realtor', modules: [] },
	runtime_configs: [{ vertical_slug: 'realtor', modules: [] }],
	vertical_activations: [{ vertical_slug: 'realtor', is_active: true }],
	profile: null,
	properties: [minimalPropertyOutRow],
	clients: [],
	deals: [],
	courses: [],
	artifacts: [],
};

describe('professionalWorldsApi zod boundary', () => {
	it('accepts buildCommunicationLogCreatePayload output for deal focus', () => {
		const payload = buildCommunicationLogCreatePayload({
			relatedType: 'deal',
			relatedId: '11111111-1111-4111-8111-111111111111',
			channel: 'call',
			body: 'Follow up on offer',
		});
		expect(payload).not.toBeNull();
		expect(communicationLogCreateSchema.safeParse(payload).success).toBe(true);
	});

	it('accepts lead rows without related_id', () => {
		const payload = buildCommunicationLogCreatePayload({
			relatedType: 'lead',
			relatedId: '',
			channel: 'email',
			body: 'Intro sent',
		});
		expect(communicationLogCreateSchema.safeParse(payload).success).toBe(true);
	});

	it('rejects incomplete operator input before POST', () => {
		expect(
			buildCommunicationLogCreatePayload({
				relatedType: 'deal',
				relatedId: '11111111-1111-4111-8111-111111111111',
				channel: '',
				body: 'Missing channel',
			})
		).toBeNull();
	});

	it('accepts RealtorCommunicationLogOut-shaped POST responses', () => {
		const response = {
			id: '22222222-2222-4222-8222-222222222222',
			user_id: '33333333-3333-4333-8333-333333333333',
			related_type: 'deal',
			related_id: '11111111-1111-4111-8111-111111111111',
			channel: 'email',
			body: 'Sent contract',
			meta: {},
			created_at: '2026-05-27T09:00:00Z',
		};
		expect(communicationLogOutSchema.safeParse(response).success).toBe(true);
	});

	it('parses communication log list responses', () => {
		const rows = parseRealtorCommunicationLogOutList([
			{
				id: '22222222-2222-4222-8222-222222222222',
				user_id: '33333333-3333-4333-8333-333333333333',
				related_type: 'deal',
				related_id: '11111111-1111-4111-8111-111111111111',
				channel: 'email',
				body: 'Sent contract',
				meta: {},
				created_at: '2026-05-27T09:00:00Z',
			},
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.channel).toBe('email');
	});

	it('maps validated snapshotOut rows into Desktop camelCase snapshot', () => {
		expect(snapshotOutSchema.safeParse(minimalSnapshotRow).success).toBe(true);
		const parsedRow = parseProfessionalWorldsSnapshotOut(minimalSnapshotRow);
		const mapped = mapProfessionalWorldsSnapshotApiRow(parsedRow);
		expect(mapped.runtimeConfig).toEqual(parsedRow.runtime_config);
		expect(mapped.verticalActivations).toEqual(
			minimalSnapshotRow.vertical_activations
		);
		expect(mapped.properties[0]?.title).toBe('Sea View');
	});

	it('accepts snapshot aggregate rows with strict CRM-lite clients and deals', () => {
		const row = {
			...minimalSnapshotRow,
			clients: [
				{
					id: '44444444-4444-4444-8444-444444444444',
					user_id: '55555555-5555-4555-8555-555555555555',
					vertical_slug: 'realtor',
					name: 'Ivan Buyer',
					contact: null,
					need_summary: null,
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: null,
					next_action: null,
					status: 'lead',
					created_at: '2026-05-27T09:00:00Z',
					updated_at: '2026-05-27T09:00:00Z',
				},
			],
			deals: [
				{
					id: '66666666-6666-4666-8666-666666666666',
					user_id: '55555555-5555-4555-8555-555555555555',
					vertical_slug: 'realtor',
					client_id: '44444444-4444-4444-8444-444444444444',
					title: 'Sea View deal',
					stage: 'new',
					amount: null,
					next_action: null,
					deal_data: {},
					created_at: '2026-05-27T09:00:00Z',
					updated_at: '2026-05-27T09:00:00Z',
				},
			],
		};
		const parsed = parseProfessionalWorldsSnapshotOut(row);
		expect(parsed.clients).toHaveLength(1);
		expect(parsed.deals?.[0]?.title).toBe('Sea View deal');
	});

	it('rejects snapshot aggregate rows when a client entry drifts', () => {
		expect(
			snapshotOutSchema.safeParse({
				...minimalSnapshotRow,
				clients: [{ name: 'Missing uuid ids' }],
			}).success
		).toBe(false);
	});

	it('parses fan-out client list responses', () => {
		const rows = parseProfessionalClientOutList([
			{
				id: '44444444-4444-4444-8444-444444444444',
				user_id: '55555555-5555-4555-8555-555555555555',
				vertical_slug: 'realtor',
				name: 'Ivan Buyer',
				contact: null,
				need_summary: null,
				budget_from: null,
				budget_to: null,
				preferred_areas: [],
				emotional_motive: null,
				next_action: null,
				status: 'lead',
				created_at: '2026-05-27T09:00:00Z',
				updated_at: '2026-05-27T09:00:00Z',
			},
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe('Ivan Buyer');
	});

	it('accepts ProfessionalClientOut-shaped POST responses', () => {
		const response = {
			id: '44444444-4444-4444-8444-444444444444',
			user_id: '55555555-5555-4555-8555-555555555555',
			vertical_slug: 'realtor',
			name: 'Ivan Buyer',
			contact: '+7',
			need_summary: null,
			budget_from: '5000000',
			budget_to: null,
			preferred_areas: ['center'],
			emotional_motive: null,
			next_action: 'Call back',
			status: 'active',
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(professionalClientOutSchema.safeParse(response).success).toBe(true);
		expect(parseProfessionalClientOut(response).name).toBe('Ivan Buyer');
	});

	it('accepts ProfessionalDealOut-shaped PATCH responses', () => {
		const response = {
			id: '66666666-6666-4666-8666-666666666666',
			user_id: '55555555-5555-4555-8555-555555555555',
			vertical_slug: 'realtor',
			client_id: '44444444-4444-4444-8444-444444444444',
			title: 'Sea View deal',
			stage: 'negotiation',
			amount: '12000000',
			next_action: null,
			deal_data: { property_id: '11111111-1111-4111-8111-111111111111' },
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:05:00Z',
		};
		expect(professionalDealOutSchema.safeParse(response).success).toBe(true);
		expect(parseProfessionalDealOut(response).stage).toBe('negotiation');
	});

	it('validates CRM-lite create and update request bodies', () => {
		expect(
			professionalClientCreateSchema.safeParse({
				vertical_slug: 'realtor',
				name: 'Ivan Buyer',
			}).success
		).toBe(true);
		expect(() =>
			parseProfessionalClientCreateBody({ vertical_slug: 'realtor', name: '' })
		).toThrow(ProfessionalWorldsApiParseError);
		expect(
			parseProfessionalDealCreateBody({
				vertical_slug: 'realtor',
				title: 'Sea View deal',
			}).title
		).toBe('Sea View deal');
		expect(professionalDealCreateSchema.safeParse({ title: '' }).success).toBe(
			false
		);
		expect(parseProfessionalDealUpdateBody({ stage: 'won' }).stage).toBe('won');
		expect(professionalDealUpdateSchema.safeParse({ title: '' }).success).toBe(
			false
		);
	});

	it('validates realtor property, lead, task, and showing write bodies', () => {
		expect(parseRealtorPropertyCreateBody({ title: 'Sea View' }).title).toBe(
			'Sea View'
		);
		expect(realtorPropertyCreateSchema.safeParse({ title: '' }).success).toBe(
			false
		);
		expect(parseRealtorLeadCreateBody({ name: 'Lead One' }).name).toBe(
			'Lead One'
		);
		expect(realtorLeadCreateSchema.safeParse({ name: '' }).success).toBe(false);
		expect(parseRealtorTaskCreateBody({ title: 'Call buyer' }).title).toBe(
			'Call buyer'
		);
		expect(realtorTaskCreateSchema.safeParse({ title: '' }).success).toBe(
			false
		);
		expect(
			realtorPropertyShowingCreateSchema.safeParse({
				property_id: '11111111-1111-4111-8111-111111111111',
				scheduled_at: '2026-05-27T12:00:00.000Z',
			}).success
		).toBe(true);
		expect(() =>
			parseRealtorPropertyShowingCreateBody({
				property_id: 'bad',
				scheduled_at: '2026-05-27T12:00:00.000Z',
			})
		).toThrow(ProfessionalWorldsApiParseError);
	});

	it('validates specialist profile, buyer requirements, documents, campaigns, and deal events write bodies', () => {
		expect(
			parseSpecialistProfileUpsertBody({
				vertical_slug: 'realtor',
				display_name: 'Agent One',
			}).display_name
		).toBe('Agent One');
		expect(
			specialistProfileUpsertSchema.safeParse({ vertical_slug: 'x' }).success
		).toBe(false);
		expect(
			parseRealtorBuyerRequirementCreateBody({ title: 'Budget sheet' }).title
		).toBe('Budget sheet');
		expect(
			realtorBuyerRequirementCreateSchema.safeParse({ title: '' }).success
		).toBe(false);
		expect(
			parseRealtorBuyerRequirementUpdateBody({ title: 'Updated' }).title
		).toBe('Updated');
		expect(
			realtorBuyerRequirementUpdateSchema.safeParse({ title: '' }).success
		).toBe(false);
		expect(
			parseRealtorProDocumentCreateBody({ title: 'Offer pack' }).title
		).toBe('Offer pack');
		expect(
			realtorProDocumentCreateSchema.safeParse({ title: '' }).success
		).toBe(false);
		expect(
			parseRealtorProDocumentUpdateBody({ doc_type: 'contract' }).doc_type
		).toBe('contract');
		expect(
			realtorProDocumentUpdateSchema.safeParse({ title: '' }).success
		).toBe(false);
		expect(
			parseMarketingCampaignCreateBody({ title: 'Spring launch' }).title
		).toBe('Spring launch');
		expect(marketingCampaignCreateSchema.safeParse({ title: '' }).success).toBe(
			false
		);
		expect(parseMarketingCampaignUpdateBody({ status: 'active' }).status).toBe(
			'active'
		);
		expect(marketingCampaignUpdateSchema.safeParse({ title: '' }).success).toBe(
			false
		);
		expect(parseDealEventAppendBody({ stage_to: 'negotiation' }).stage_to).toBe(
			'negotiation'
		);
		expect(dealEventAppendSchema.safeParse({ stage_to: '' }).success).toBe(
			false
		);
	});

	it('validates media, price snapshot, album, and onboarding write bodies', () => {
		expect(
			parseRealtorPropertyMediaCreateBody({
				unified_content_id: '11111111-1111-4111-8111-111111111111',
			}).unified_content_id
		).toBe('11111111-1111-4111-8111-111111111111');
		expect(
			realtorPropertyMediaCreateSchema.safeParse({ unified_content_id: 'bad' })
				.success
		).toBe(false);
		expect(
			parseRealtorMediaBatchCreateBody({
				preset_key: 'brighten',
				source_content_ids: ['11111111-1111-4111-8111-111111111111'],
			}).preset_key
		).toBe('brighten');
		expect(
			realtorMediaBatchCreateSchema.safeParse({
				preset_key: 'x',
				source_content_ids: [],
			}).success
		).toBe(false);
		expect(
			parseRealtorMediaBatchItemReviewBody({ decision: 'accepted' }).decision
		).toBe('accepted');
		expect(
			realtorMediaBatchItemReviewBodySchema.safeParse({ decision: 'maybe' })
				.success
		).toBe(false);
		expect(
			parsePriceAnalysisSnapshotCreateBody({ snapshot: { comps: 3 } })
		).toEqual({ snapshot: { comps: 3 } });
		expect(
			parseProfessionalMediaAlbumCreateBody({ title: 'Listing gallery' }).title
		).toBe('Listing gallery');
		expect(
			professionalMediaAlbumCreateSchema.safeParse({ title: '' }).success
		).toBe(false);
		expect(
			parseProfessionalMediaAlbumPatchBody({ title: 'Renamed' }).title
		).toBe('Renamed');
		expect(
			professionalMediaAlbumPatchSchema.safeParse({ title: '' }).success
		).toBe(false);
		expect(
			parseProfessionalVerticalOnboardingPatchBody({
				onboarding: { step: 'profile' },
			}).onboarding
		).toEqual({ step: 'profile' });
	});

	it('validates brand kit, activation, property draft, and object intake write bodies', () => {
		expect(
			parseBrandVisualKitUpsertBody({ kit: { primary: '#112233' } }).kit
		).toEqual({ primary: '#112233' });
		expect(brandVisualKitUpsertSchema.safeParse({ kit: 'bad' }).success).toBe(
			false
		);
		expect(
			parseProfessionalVerticalActivationUpsertBody({ is_active: false })
				.is_active
		).toBe(false);
		expect(
			professionalUserVerticalActivationUpsertSchema.safeParse({
				is_active: 'yes',
			}).success
		).toBe(false);
		expect(parseRealtorPropertyDraftPayloadBody({ note: 'handoff' }).note).toBe(
			'handoff'
		);
		expect(realtorPropertyDraftPayloadSchema.safeParse(null).success).toBe(
			false
		);
		expect(
			parseObjectIntakeParseRequestBody({
				source_text: 'Twenty chars minimum here',
			}).source_text
		).toBe('Twenty chars minimum here');
		expect(
			objectIntakeParseRequestSchema.safeParse({ source_text: 'short' }).success
		).toBe(false);
		expect(
			parseObjectIntakeCommitRequestBody({
				job_id: '11111111-1111-4111-8111-111111111111',
				accepted_fields: ['title'],
			}).accepted_fields
		).toEqual(['title']);
		expect(
			objectIntakeCommitRequestSchema.safeParse({ job_id: 'bad' }).success
		).toBe(false);
		expect(
			parseProfessionalPlaybookLaunchBody({
				variables: { property_id: '11111111-1111-4111-8111-111111111111' },
			}).variables?.property_id
		).toBe('11111111-1111-4111-8111-111111111111');
		expect(
			professionalPlaybookLaunchBodySchema.safeParse({
				idempotency_key: 'x'.repeat(200),
			}).success
		).toBe(false);
	});

	it('accepts RealtorLeadOut list and convert payloads', () => {
		const lead = {
			id: '77777777-7777-4777-8777-777777777777',
			user_id: '55555555-5555-4555-8555-555555555555',
			vertical_slug: 'realtor',
			name: 'Lead One',
			contact: null,
			source: 'site',
			status: 'new',
			notes: null,
			converted_client_id: null,
			lead_data: {},
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(realtorLeadOutSchema.safeParse(lead).success).toBe(true);
		expect(parseRealtorLeadOutList([lead])).toHaveLength(1);
		expect(
			parseRealtorLeadConvertOut({
				lead,
				client: {
					id: '44444444-4444-4444-8444-444444444444',
					user_id: '55555555-5555-4555-8555-555555555555',
					vertical_slug: 'realtor',
					name: 'Lead One',
					contact: null,
					need_summary: null,
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: null,
					next_action: null,
					status: 'lead',
					created_at: '2026-05-27T09:00:00Z',
					updated_at: '2026-05-27T09:00:00Z',
				},
			}).client.name
		).toBe('Lead One');
	});

	it('accepts RealtorTaskOut-shaped responses', () => {
		const task = {
			id: '88888888-8888-4888-8888-888888888888',
			user_id: '55555555-5555-4555-8555-555555555555',
			title: 'Call buyer',
			status: 'open',
			priority: 'normal',
			due_at: null,
			reminder_at: null,
			next_action: null,
			notes: null,
			property_id: null,
			client_id: null,
			showing_id: null,
			deal_id: null,
			task_meta: {},
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(realtorTaskOutSchema.safeParse(task).success).toBe(true);
		expect(parseRealtorTaskOut(task).title).toBe('Call buyer');
	});

	it('rejects snapshot aggregate rows when a property entry drifts', () => {
		expect(
			snapshotOutSchema.safeParse({
				...minimalSnapshotRow,
				properties: [{ title: 'Missing ids' }],
			}).success
		).toBe(false);
	});

	it('accepts RealtorPropertyOut list and showing responses', () => {
		expect(parseRealtorPropertyOutList([minimalPropertyOutRow])).toHaveLength(
			1
		);
		expect(
			realtorPropertyOutSchema.safeParse(minimalPropertyOutRow).success
		).toBe(true);
		const showing = {
			id: '99999999-9999-4999-8999-999999999999',
			user_id: '55555555-5555-4555-8555-555555555555',
			property_id: minimalPropertyOutRow.id,
			client_id: null,
			scheduled_at: '2026-05-28T10:00:00Z',
			status: 'scheduled',
			notes: null,
			duration_minutes: 60,
			location_notes: null,
			deal_id: null,
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(realtorPropertyShowingOutSchema.safeParse(showing).success).toBe(
			true
		);
		expect(parseRealtorPropertyShowingOut(showing).status).toBe('scheduled');
	});

	it('accepts learning course and artifact rows in snapshot aggregate', () => {
		const courseRow = {
			id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			course_key: 'basics',
			vertical_slug: 'realtor',
			title: 'Basics',
			description: null,
			level: 'intro',
			sort_order: 0,
			lessons: [
				{
					id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
					lesson_key: 'intro',
					title: 'Intro',
					summary: null,
					content_md: '# Intro',
					exercise: {},
					sort_order: 0,
					completed: false,
				},
			],
		};
		const artifactRow = {
			id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
			vertical_slug: 'realtor',
			source_type: 'recipe',
			source_id: null,
			recipe_key: 'realtor_property_description_jtbd',
			title: 'Listing copy',
			content: 'Draft text',
			artifact_data: {},
			unified_content_id: null,
			ugs_request_id: null,
			module_key: 'objects',
			artifact_kind: 'text',
			parent_artifact_id: null,
			source_media_id: null,
			export_metadata: {},
			created_at: '2026-05-27T09:00:00Z',
		};
		const row = {
			...minimalSnapshotRow,
			courses: [courseRow],
			artifacts: [artifactRow],
		};
		expect(
			professionalLearningCourseOutSchema.safeParse(courseRow).success
		).toBe(true);
		expect(professionalArtifactOutSchema.safeParse(artifactRow).success).toBe(
			true
		);
		expect(parseProfessionalWorldsSnapshotOut(row).artifacts?.[0]?.title).toBe(
			'Listing copy'
		);
		expect(parseProfessionalLearningCourseOutList([courseRow])).toHaveLength(1);
		expect(parseProfessionalArtifactOutList([artifactRow])).toHaveLength(1);
	});

	it('rejects snapshot aggregate rows when an artifact entry drifts', () => {
		expect(
			snapshotOutSchema.safeParse({
				...minimalSnapshotRow,
				artifacts: [{ title: 'Missing ids' }],
			}).success
		).toBe(false);
	});

	it('accepts bootstrap vertical/profile/document rows and stream artifacts', () => {
		expect(
			professionVerticalOutSchema.safeParse({
				slug: 'realtor',
				name: 'Realtor',
			}).success
		).toBe(true);
		expect(
			specialistProfileOutSchema.safeParse({
				id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
				user_id: '55555555-5555-4555-8555-555555555555',
				vertical_slug: 'realtor',
				display_name: 'Anna',
				headline: null,
				city: 'Vladivostok',
				agency_name: null,
				specialization: [],
				profile_data: {},
				is_public_ready: false,
				created_at: '2026-05-27T09:00:00Z',
				updated_at: '2026-05-27T09:00:00Z',
			}).success
		).toBe(true);
		const documentRow = {
			id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
			user_id: '55555555-5555-4555-8555-555555555555',
			deal_id: null,
			property_id: minimalPropertyOutRow.id,
			title: 'Purchase agreement',
			doc_type: 'contract',
			checklist_state: {},
			unified_content_id: null,
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(realtorProDocumentOutSchema.safeParse(documentRow).success).toBe(
			true
		);
		expect(parseRealtorProDocumentOutList([documentRow])).toHaveLength(1);
		expect(
			parseStreamProfessionalArtifactOut({
				id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
				vertical_slug: 'realtor',
				source_type: 'recipe',
				title: 'Generated copy',
				created_at: '2026-05-27T09:00:00Z',
			})?.title
		).toBe('Generated copy');
		expect(() =>
			parseStreamProfessionalArtifactOut({ title: 'Missing ids' })
		).toThrow(ProfessionalWorldsApiParseError);
	});

	it('accepts runtime config rows and rejects drifted module entries', () => {
		const runtimeRow = {
			vertical_slug: 'realtor',
			modules: [
				{
					id: '11111111-1111-4111-8111-111111111111',
					vertical_slug: 'realtor',
					module_key: 'profile',
					created_at: '2026-05-27T09:00:00Z',
					updated_at: '2026-05-27T09:00:00Z',
				},
			],
		};
		expect(
			professionalWorldsRuntimeConfigOutSchema.safeParse(runtimeRow).success
		).toBe(true);
		expect(
			parseProfessionalWorldsRuntimeConfigOut(runtimeRow).modules
		).toHaveLength(1);
		expect(
			snapshotOutSchema.safeParse({
				...minimalSnapshotRow,
				runtime_config: runtimeRow,
				runtime_configs: [runtimeRow],
			}).success
		).toBe(true);
		expect(
			professionalWorldsRuntimeConfigOutSchema.safeParse({
				vertical_slug: 'realtor',
				modules: [{ module_key: 'profile' }],
			}).success
		).toBe(false);
	});

	it('accepts playbook run rows and rejects drifted artifact entries', () => {
		const runRow = {
			id: '77777777-7777-4777-8777-777777777777',
			vertical_slug: 'realtor',
			playbook_key: 'realtor_listing_launch',
			status: 'completed',
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
			artifacts: [{ step_order: 1, artifact_id: minimalPropertyOutRow.id }],
		};
		expect(professionalPlaybookRunOutSchema.safeParse(runRow).success).toBe(
			true
		);
		expect(parseProfessionalPlaybookRunOut(runRow).playbook_key).toBe(
			'realtor_listing_launch'
		);
		expect(parseProfessionalPlaybookRunOutList([runRow])).toHaveLength(1);
		expect(
			professionalPlaybookRunOutSchema.safeParse({
				...runRow,
				artifacts: [{ artifact_kind: 'text' }],
			}).success
		).toBe(false);
	});

	it('accepts CRM mesh and media Out rows and rejects drift', () => {
		const buyerRow = {
			id: '88888888-8888-4888-8888-888888888888',
			user_id: '55555555-5555-4555-8555-555555555555',
			title: '2BR near sea',
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(realtorBuyerRequirementOutSchema.safeParse(buyerRow).success).toBe(
			true
		);
		const mediaRow = {
			id: '99999999-9999-4999-8999-999999999999',
			property_id: minimalPropertyOutRow.id,
			unified_content_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			created_at: '2026-05-27T09:00:00Z',
		};
		expect(realtorPropertyMediaOutSchema.safeParse(mediaRow).success).toBe(
			true
		);
		const batchDetail = {
			batch: {
				id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
				property_id: minimalPropertyOutRow.id,
				preset_key: 'brighten',
				status: 'queued',
				created_at: '2026-05-27T09:00:00Z',
				updated_at: '2026-05-27T09:00:00Z',
			},
			items: [
				{
					id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
					batch_job_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
					source_content_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
					status: 'pending',
					created_at: '2026-05-27T09:00:00Z',
					updated_at: '2026-05-27T09:00:00Z',
				},
			],
		};
		expect(parseRealtorMediaBatchDetailOut(batchDetail).items).toHaveLength(1);
		expect(
			realtorMediaBatchDetailOutSchema.safeParse({
				...batchDetail,
				items: [{ status: 'pending' }],
			}).success
		).toBe(false);
	});

	it('accepts insights/marketing Out rows and generation/intake bodies', () => {
		const campaignRow = {
			id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
			user_id: '55555555-5555-4555-8555-555555555555',
			title: 'Spring launch',
			status: 'draft',
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(
			realtorMarketingCampaignOutSchema.safeParse(campaignRow).success
		).toBe(true);
		expect(
			realtorGenerationBodySchema.safeParse({ tone: 'jtbd' }).success
		).toBe(true);
		const preview = {
			job_id: '11111111-1111-4111-8111-111111111111',
			property: { title: 'Sea View' },
			source_text: '3BR apartment',
		};
		expect(objectIntakePreviewSchema.safeParse(preview).success).toBe(true);
		expect(() =>
			parseObjectIntakeStreamPreview({
				job_id: 'bad',
				property: { title: 'X' },
				source_text: 'text',
			})
		).toThrow(ProfessionalWorldsApiParseError);
	});

	it('accepts backfill, publication channel, and media enhancement bodies', () => {
		expect(
			professionalDealPropertyLinkBackfillOutSchema.safeParse({
				updated: 1,
				skipped: 0,
			}).success
		).toBe(true);
		expect(
			parseProfessionalDealPropertyLinkBackfillOut({ updated: 2, skipped: 1 })
		).toEqual({ updated: 2, skipped: 1 });
		const channelRow = {
			id: '11111111-1111-4111-8111-111111111111',
			user_id: '55555555-5555-4555-8555-555555555555',
			property_id: minimalPropertyOutRow.id,
			channel_key: 'telegram',
			status: 'pending',
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		expect(
			realtorPublicationChannelOutSchema.safeParse(channelRow).success
		).toBe(true);
		expect(
			mediaEnhancementRequestSchema.safeParse({
				content_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				preset_key: 'brighten',
			}).success
		).toBe(true);
	});

	it('validates objection reply and publication channel request bodies', () => {
		expect(
			parseCommunicationLogCreateBody({
				related_type: 'deal',
				channel: 'phone',
				body: 'Hello',
			}).body
		).toBe('Hello');
		expect(() =>
			parseCommunicationLogCreateBody({
				related_type: 'deal',
				channel: 'phone',
				body: '',
			})
		).toThrow(ProfessionalWorldsApiParseError);
		expect(
			objectionReplyUpsertSchema.safeParse({
				reply_text: 'Focus on value, not price alone.',
				tags: ['price'],
			}).success
		).toBe(true);
		expect(
			parseObjectionReplyUpsertBody({
				reply_text: 'Focus on value, not price alone.',
			}).reply_text
		).toBe('Focus on value, not price alone.');
		expect(() => parseObjectionReplyUpsertBody({ reply_text: '' })).toThrow(
			ProfessionalWorldsApiParseError
		);
		expect(
			publicationChannelUpsertSchema.safeParse({
				channel_key: 'telegram',
				status: 'pending',
			}).success
		).toBe(true);
		expect(
			parsePublicationChannelUpsertBody({ channel_key: 'vk' }).channel_key
		).toBe('vk');
		expect(
			publicationChannelPatchSchema.safeParse({ status: 'published' }).success
		).toBe(true);
		expect(
			parsePublicationChannelPatchBody({ status: null }).status
		).toBeNull();
		expect(() =>
			parsePublicationChannelUpsertBody({ channel_key: '' })
		).toThrow(ProfessionalWorldsApiParseError);
	});
});
