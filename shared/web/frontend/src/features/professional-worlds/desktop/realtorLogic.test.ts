/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Professional Worlds realtor DTO mapping (draft + PATCH payloads), JTBD preview, addon module ordering, recipe selection helpers.
 *
 * Invariants:
 * - Tests stay pure and do not mount Desktop or call the backend.
 *
 * Related:
 * - realtorLogic.ts
 */

import { describe, expect, it } from 'vitest';
import { PROFESSIONAL_WORLDS_API_BASE } from './api';
import {
	makePhotoPreset,
	makeRuntimeModule,
	PW_TEST_TS,
} from './professionalWorldsTestFixtures';
import {
	buildJtbdPreview,
	buildProfessionalDealCreatePayload,
	buildCommunicationLogCreatePayload,
	buildRealtorCrmFollowUpItems,
	buildRealtorDashboardMetrics,
	buildRealtorPropertyPatchPayload,
	countOverviewCrmFollowUps,
	pickFirstOverviewCrmFollowUpCommunicationFocus,
	createEmptyRealtorProperty,
	countDealsForClient,
	classifyClientSegment,
	countDealsNeedingPropertyBackfill,
	dealLinksProperty,
	enabledRuntimeModuleKeys,
	filterDealsByClientId,
	findUniqueDealForPropertyId,
	findUniqueDealForShowingContext,
	isProfessionalDealStage,
	listActiveDealsForObjectionCoach,
	listPropertiesWithoutDealLink,
	listCommunicationLeadEntityOptions,
	listCommunicationRelatedEntityOptions,
	normalizeCommunicationRelatedType,
	resolveCrmFollowUpCommunicationFocus,
	resolveDealLinkedClientName,
	resolveDealLinkedPropertyTitle,
	rankBuyerPropertyMatches,
	resolveBuyerMatchLinkedDealId,
	resolveOverviewClientsNavigation,
	resolveCommunicationLogCrmAction,
	resolveDocumentLinkedDealId,
	resolveListingCommunicationFocus,
	resolveShowingCommunicationFocus,
	resolveShowingLinkedDealId,
	resolveTaskCommunicationFocus,
	resolveDefaultRealtorPropertyCity,
	aiActionsForModule,
	groupPhotoPresetsByCategory,
	normalizeCsvList,
	realtorPropertyToCreateDraft,
	selectRecipeKey,
	sortedEnabledRealtorAddonModules,
	shouldIncludeDedicatedRealtorAddon,
} from './realtorLogic';

describe('professional worlds realtor logic', () => {
	it('keeps the API base path aligned with backend router prefix', () => {
		expect(PROFESSIONAL_WORLDS_API_BASE).toBe('/api/v1/professional-worlds');
	});

	it('normalizes comma-separated infrastructure input', () => {
		expect(normalizeCsvList(' море, школа ,, кафе ')).toEqual([
			'море',
			'школа',
			'кафе',
		]);
	});

	it('prefers specialist profile city for new listing drafts', () => {
		expect(
			resolveDefaultRealtorPropertyCity({
				id: 'p1',
				user_id: 'u1',
				vertical_slug: 'realtor',
				display_name: 'Agent',
				headline: null,
				city: '  Казань ',
				agency_name: null,
				specialization: [],
				profile_data: {},
				is_public_ready: false,
				created_at: '',
				updated_at: '',
			})
		).toBe('Казань');
		expect(createEmptyRealtorProperty().city).toBe('');
		expect(createEmptyRealtorProperty({ city: 'Сочи' }).city).toBe('Сочи');
	});

	it('maps a persisted listing into an editor draft without snapshot ids', () => {
		const draft = realtorPropertyToCreateDraft({
			id: 'listing-1',
			user_id: 'user-1',
			title: 'Flat',
			property_type: 'apartment',
			deal_type: 'sale',
			city: 'Владивосток',
			district: 'Центр',
			address: 'ул. 1',
			price: '12500000',
			area_m2: '48',
			rooms: 2,
			floor: 4,
			total_floors: 9,
			view: 'море',
			infrastructure: ['парк'],
			jtbd_context: {
				trigger_context: 'нужно быстро',
				expected_result: 'купить',
				emotional_transformation: 'уверенность',
				audience_segment: '',
			},
			facts: { a: 1 },
			status: 'active',
			created_at: 't0',
			updated_at: 't1',
		});
		expect(draft.title).toBe('Flat');
		expect(draft.infrastructure).toEqual(['парк']);
		expect((draft.facts as { a?: number }).a).toBe(1);
	});

	it('serializes PATCH payloads from draft + CSV infrastructure', () => {
		const draft = createEmptyRealtorProperty();
		draft.title = 'Комната';
		draft.district = '';
		const payload = buildRealtorPropertyPatchPayload(draft, ' лифт , балкон ');
		expect(payload.title).toBe('Комната');
		expect(payload.infrastructure).toEqual(['лифт', 'балкон']);
		expect(payload.district).toBeNull();
	});

	it('flags dedicated vs placeholder-backed registry routes for addons', () => {
		expect(shouldIncludeDedicatedRealtorAddon('realtor_leads')).toBe(true);
		expect(shouldIncludeDedicatedRealtorAddon('profile')).toBe(false);
		expect(shouldIncludeDedicatedRealtorAddon('realtor_playbooks')).toBe(false);
		expect(shouldIncludeDedicatedRealtorAddon('realtor_unknown_future')).toBe(
			false
		);
	});

	it('links deals to properties only by deal_data.property_id', () => {
		const property = {
			id: 'prop-1',
			user_id: 'u',
			title: 'Flat on Main',
			property_type: 'apartment',
			deal_type: 'sale',
			city: 'City',
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
			created_at: '',
			updated_at: '',
		};
		expect(
			dealLinksProperty(
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: null,
					title: 'Other',
					stage: 'new',
					amount: null,
					next_action: null,
					deal_data: { property_id: 'prop-1' },
					created_at: '',
					updated_at: '',
				},
				property
			)
		).toBe(true);
		expect(
			dealLinksProperty(
				{
					id: 'd2',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: null,
					title: 'Flat on Main — sale',
					stage: 'new',
					amount: null,
					next_action: null,
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
				property
			)
		).toBe(false);
	});

	it('listPropertiesWithoutDealLink treats unique legacy title inference as linked', () => {
		const property = {
			id: 'prop-1',
			user_id: 'u',
			title: 'Flat on Main',
			property_type: 'apartment',
			deal_type: 'sale',
			city: 'City',
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
			created_at: '',
			updated_at: '',
		};
		const linkedProperty = { ...property, id: 'prop-2', title: 'Linked flat' };
		const deals = [
			{
				id: 'd-title-only',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: null,
				title: 'Flat on Main — sale',
				stage: 'new',
				amount: null,
				next_action: null,
				deal_data: {},
				created_at: '',
				updated_at: '',
			},
			{
				id: 'd-linked',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: null,
				title: 'Offer',
				stage: 'new',
				amount: null,
				next_action: null,
				deal_data: { property_id: 'prop-2' },
				created_at: '',
				updated_at: '',
			},
		];
		expect(
			listPropertiesWithoutDealLink([property, linkedProperty], deals).map(
				(item) => item.id
			)
		).toEqual([]);
	});

	it('countDealsNeedingPropertyBackfill counts legacy rows without FK', () => {
		const property = {
			id: 'prop-1',
			user_id: 'u',
			title: 'Flat on Main',
			property_type: 'apartment',
			deal_type: 'sale',
			city: 'City',
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
			created_at: '',
			updated_at: '',
		};
		expect(
			countDealsNeedingPropertyBackfill(
				[
					{
						id: 'd1',
						user_id: 'u',
						vertical_slug: 'realtor',
						client_id: null,
						title: 'Flat on Main — sale',
						stage: 'new',
						amount: null,
						next_action: null,
						deal_data: {},
						created_at: '',
						updated_at: '',
					},
					{
						id: 'd2',
						user_id: 'u',
						vertical_slug: 'realtor',
						client_id: null,
						title: 'Flat on Main — sale',
						stage: 'new',
						amount: null,
						next_action: null,
						deal_data: { property_id: 'prop-1' },
						created_at: '',
						updated_at: '',
					},
				],
				[property]
			)
		).toBe(1);
	});

	it('resolves linked listing title from deal_data.property_id', () => {
		const property = {
			id: 'prop-1',
			user_id: 'u',
			title: 'Flat on Main',
			property_type: 'apartment',
			deal_type: 'sale',
			city: 'City',
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
			created_at: '',
			updated_at: '',
		};
		expect(
			resolveDealLinkedPropertyTitle(
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: null,
					title: 'Offer review',
					stage: 'new',
					amount: null,
					next_action: null,
					deal_data: { property_id: 'prop-1' },
					created_at: '',
					updated_at: '',
				},
				[property]
			)
		).toBe('Flat on Main');
	});

	it('buildProfessionalDealCreatePayload attaches linked property id', () => {
		const payload = buildProfessionalDealCreatePayload(
			{
				vertical_slug: 'realtor',
				client_id: null,
				title: 'Showing',
				stage: 'new',
				amount: null,
				next_action: 'Call seller',
				deal_data: { note: 'x' },
			},
			{ linkedPropertyId: 'prop-9' }
		);
		expect(payload.deal_data).toEqual({
			note: 'x',
			property_id: 'prop-9',
		});
	});

	it('resolves linked client name for deals', () => {
		expect(
			resolveDealLinkedClientName(
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Showing',
					stage: 'new',
					amount: null,
					next_action: null,
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
				[
					{
						id: 'c1',
						user_id: 'u',
						vertical_slug: 'realtor',
						name: 'Anna',
						contact: null,
						need_summary: null,
						budget_from: null,
						budget_to: null,
						preferred_areas: [],
						emotional_motive: null,
						next_action: null,
						status: 'lead',
						created_at: '',
						updated_at: '',
					},
				]
			)
		).toBe('Anna');
	});

	it('filterDealsByClientId returns all deals when client id is empty', () => {
		const deals = [
			{
				id: 'd1',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: 'c1',
				title: 'A',
				stage: 'new',
				amount: null,
				next_action: null,
				deal_data: {},
				created_at: '',
				updated_at: '',
			},
			{
				id: 'd2',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: 'c2',
				title: 'B',
				stage: 'new',
				amount: null,
				next_action: null,
				deal_data: {},
				created_at: '',
				updated_at: '',
			},
		];
		expect(filterDealsByClientId(deals, null)).toHaveLength(2);
		expect(filterDealsByClientId(deals, 'c1')).toEqual([deals[0]]);
		expect(countDealsForClient(deals, 'c2')).toBe(1);
	});

	it('isProfessionalDealStage recognizes canonical stages', () => {
		expect(isProfessionalDealStage('showing')).toBe(true);
		expect(isProfessionalDealStage('custom')).toBe(false);
	});

	it('findUniqueDealForShowingContext requires unique listing and client match', () => {
		const properties = [
			{
				id: 'p1',
				user_id: 'u',
				title: 'Sea View',
				property_type: 'flat',
				deal_type: 'sale',
				city: 'V',
				district: '',
				address: null,
				price: '1',
				area_m2: '1',
				rooms: 1,
				floor: null,
				total_floors: null,
				view: null,
				infrastructure: [],
				jtbd_context: {},
				facts: {},
				status: 'active',
				created_at: '',
				updated_at: '',
			},
		];
		const deals = [
			{
				id: 'd1',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: 'c1',
				title: 'Anna deal',
				stage: 'showing',
				amount: null,
				next_action: null,
				deal_data: { property_id: 'p1' },
				created_at: '',
				updated_at: '',
			},
			{
				id: 'd2',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: 'c2',
				title: 'Other',
				stage: 'new',
				amount: null,
				next_action: null,
				deal_data: { property_id: 'p1' },
				created_at: '',
				updated_at: '',
			},
		];
		expect(
			findUniqueDealForShowingContext(deals, properties, 'p1', 'c1')?.id
		).toBe('d1');
		expect(
			findUniqueDealForShowingContext(deals, properties, 'p1', 'c2')?.id
		).toBe('d2');
		expect(
			findUniqueDealForShowingContext(deals, properties, 'p1', null)
		).toBeNull();
		expect(
			resolveShowingLinkedDealId(
				{ deal_id: null, property_id: 'p1', client_id: 'c1' },
				deals,
				properties
			)
		).toBe('d1');
		expect(
			resolveShowingCommunicationFocus(
				{ deal_id: null, property_id: 'p1', client_id: 'c1' },
				deals,
				properties
			)
		).toEqual({ relatedType: 'deal', relatedId: 'd1' });
		expect(
			resolveShowingCommunicationFocus(
				{ deal_id: null, property_id: 'p1', client_id: null },
				deals,
				properties
			)
		).toEqual({ relatedType: 'property', relatedId: 'p1' });
		expect(resolveListingCommunicationFocus(' p1 ')).toEqual({
			relatedType: 'property',
			relatedId: 'p1',
		});
		expect(resolveListingCommunicationFocus('')).toBeNull();
	});

	it('resolveTaskCommunicationFocus and resolveCrmFollowUpCommunicationFocus', () => {
		const deals = [
			{
				id: 'd1',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: 'c1',
				title: 'Deal',
				stage: 'negotiation',
				amount: null,
				next_action: null,
				deal_data: { property_id: 'p1' },
				created_at: '',
				updated_at: '',
			},
		];
		const properties = [
			{
				id: 'p1',
				user_id: 'u',
				title: 'Sea View',
				property_type: 'flat',
				deal_type: 'sale',
				city: 'V',
				district: '',
				address: null,
				price: '1',
				area_m2: '1',
				rooms: 1,
				floor: null,
				total_floors: null,
				year_built: null,
				description: null,
				features: {},
				media_count: 0,
				status: 'active',
				created_at: '',
				updated_at: '',
			},
		];
		const showings = [
			{
				id: 's1',
				user_id: 'u',
				property_id: 'p1',
				client_id: 'c1',
				deal_id: null,
				scheduled_at: '',
				status: 'planned',
				notes: null,
				duration_minutes: 60,
				location_notes: null,
				created_at: '',
				updated_at: '',
			},
		];
		expect(
			resolveTaskCommunicationFocus(
				{
					deal_id: 'd1',
					client_id: null,
					property_id: null,
					showing_id: null,
				},
				showings,
				deals,
				properties
			)
		).toEqual({ relatedType: 'deal', relatedId: 'd1' });
		expect(
			resolveTaskCommunicationFocus(
				{
					deal_id: null,
					client_id: null,
					property_id: null,
					showing_id: 's1',
				},
				showings,
				deals,
				properties
			)
		).toEqual({ relatedType: 'deal', relatedId: 'd1' });
		expect(
			resolveCrmFollowUpCommunicationFocus({
				id: 'deal-d1',
				source: 'deal',
				entityId: 'd1',
				title: 'Call',
			})
		).toEqual({ relatedType: 'deal', relatedId: 'd1' });
		expect(
			resolveCrmFollowUpCommunicationFocus({
				id: 'client-c1',
				source: 'client',
				entityId: 'c1',
				title: 'Email',
			})
		).toEqual({ relatedType: 'client', relatedId: 'c1' });
	});

	it('findUniqueDealForPropertyId and resolveDocumentLinkedDealId', () => {
		const properties = [
			{
				id: 'p1',
				user_id: 'u',
				title: 'Sea View',
				property_type: 'flat',
				deal_type: 'sale',
				city: 'V',
				district: '',
				address: null,
				price: '1',
				area_m2: '1',
				rooms: 1,
				floor: null,
				total_floors: null,
				view: null,
				infrastructure: [],
				jtbd_context: {},
				facts: {},
				status: 'active',
				created_at: '',
				updated_at: '',
			},
		];
		const deals = [
			{
				id: 'd1',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: 'c1',
				title: 'Sea View offer',
				stage: 'offer',
				amount: null,
				next_action: null,
				deal_data: { property_id: 'p1' },
				created_at: '',
				updated_at: '',
			},
		];
		expect(findUniqueDealForPropertyId(deals, properties, 'p1')?.id).toBe('d1');
		expect(
			resolveDocumentLinkedDealId(
				{ deal_id: null, property_id: 'p1' },
				deals,
				properties
			)
		).toBe('d1');
		expect(
			resolveDocumentLinkedDealId(
				{ deal_id: 'd-explicit', property_id: 'p1' },
				deals,
				properties
			)
		).toBe('d-explicit');
	});

	it('normalizes communication related types and resolves CRM actions', () => {
		expect(normalizeCommunicationRelatedType('Deal')).toBe('deal');
		expect(normalizeCommunicationRelatedType('listings')).toBe('property');
		expect(
			resolveCommunicationLogCrmAction({
				related_type: 'client',
				related_id: 'c1',
			})
		).toEqual({
			kind: 'clients',
			tab: 'directory',
			filterClientId: 'c1',
		});
		expect(
			resolveCommunicationLogCrmAction({
				related_type: 'lead',
				related_id: 'l1',
			})
		).toEqual({ kind: 'leads' });
	});

	it('lists communication entity options and validates create payload', () => {
		const snapshot = {
			deals: [
				{
					id: 'd1',
					title: 'Offer',
				},
			],
			clients: [
				{
					id: 'c1',
					name: 'Buyer',
				},
			],
			properties: [
				{
					id: 'p1',
					title: 'Sea View',
				},
			],
		} as Parameters<typeof listCommunicationRelatedEntityOptions>[1];

		expect(listCommunicationRelatedEntityOptions('deal', snapshot)).toEqual([
			{ id: 'd1', label: 'Offer' },
		]);
		expect(
			listCommunicationLeadEntityOptions([
				{
					id: 'l1',
					user_id: 'u1',
					vertical_slug: 'realtor',
					name: 'Alpha',
					status: 'new',
					source: 'site',
					contact: 'a@example.com',
					notes: '',
					converted_client_id: null,
					lead_data: {},
					created_at: '',
					updated_at: '',
				},
			])
		).toEqual([{ id: 'l1', label: 'Alpha · a@example.com · new' }]);
		expect(
			buildCommunicationLogCreatePayload({
				relatedType: 'deal',
				relatedId: '',
				channel: 'phone',
				body: 'Called back',
			})
		).toBeNull();
		expect(
			buildCommunicationLogCreatePayload({
				relatedType: 'lead',
				relatedId: '',
				channel: 'email',
				body: 'Intro sent',
			})
		).toEqual({
			related_type: 'lead',
			related_id: null,
			channel: 'email',
			body: 'Intro sent',
			meta: {},
		});
	});

	it('builds CRM follow-ups and objection coach deal shortlist', () => {
		const deals = [
			{
				id: 'd-open',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: null,
				title: 'Open',
				stage: 'negotiation',
				amount: null,
				next_action: 'Call buyer',
				deal_data: {},
				created_at: '',
				updated_at: '2026-05-27T10:00:00Z',
			},
			{
				id: 'd-closed',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: null,
				title: 'Closed',
				stage: 'closed',
				amount: null,
				next_action: 'Archive',
				deal_data: {},
				created_at: '',
				updated_at: '2026-05-27T11:00:00Z',
			},
		];
		const clients = [
			{
				id: 'c1',
				user_id: 'u',
				vertical_slug: 'realtor',
				name: 'Buyer',
				contact: null,
				need_summary: null,
				budget_from: null,
				budget_to: null,
				preferred_areas: [],
				emotional_motive: null,
				next_action: 'Send docs',
				status: 'lead',
				created_at: '',
				updated_at: '',
			},
		];
		const followUps = buildRealtorCrmFollowUpItems(deals, clients, {
			dealFallback: 'Deal',
			clientFallback: 'Client',
		});
		expect(followUps).toHaveLength(2);
		expect(
			listActiveDealsForObjectionCoach(deals).map((deal) => deal.id)
		).toEqual(['d-open']);
	});

	it('ranks buyer matches and resolves linked deal id', () => {
		const properties = [
			{
				id: 'p1',
				user_id: 'u',
				title: 'Sea View',
				property_type: 'flat',
				deal_type: 'sale',
				city: 'V',
				district: 'Center',
				address: null,
				price: '10000000',
				area_m2: '100',
				rooms: 3,
				floor: null,
				total_floors: null,
				view: null,
				infrastructure: [],
				jtbd_context: {},
				facts: {},
				status: 'active',
				created_at: '',
				updated_at: '',
			},
		];
		const requirements = [
			{
				id: 'req1',
				user_id: 'u',
				client_id: 'c1',
				title: 'Center buyer',
				requirements: {
					budget_max: 15_000_000,
					districts: ['Center'],
					rooms: 3,
				},
				created_at: '',
				updated_at: '',
			},
		];
		const deals = [
			{
				id: 'd-buyer',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: 'c1',
				title: 'Buyer deal',
				stage: 'showing',
				amount: null,
				next_action: null,
				deal_data: { property_id: 'p1' },
				created_at: '',
				updated_at: '',
			},
		];
		const matches = rankBuyerPropertyMatches(requirements, properties);
		expect(matches).toHaveLength(1);
		expect(matches[0]?.score).toBe(100);
		expect(
			resolveBuyerMatchLinkedDealId(requirements[0], 'p1', deals, properties)
		).toBe('d-buyer');
		expect(
			classifyClientSegment({
				id: 'c1',
				user_id: 'u',
				vertical_slug: 'realtor',
				name: 'Buyer',
				contact: null,
				need_summary: null,
				budget_from: '1',
				budget_to: '2',
				preferred_areas: ['Center'],
				emotional_motive: null,
				next_action: null,
				status: 'lead',
				created_at: '',
				updated_at: '',
			})
		).toBe('buyer');
	});

	it('counts overview CRM follow-ups and routes empty clients to Leads', () => {
		const deals = [
			{
				id: 'd1',
				user_id: 'u',
				vertical_slug: 'realtor',
				client_id: null,
				title: 'Open',
				stage: 'offer',
				amount: null,
				next_action: 'Call',
				deal_data: {},
				created_at: '',
				updated_at: '',
			},
		];
		const clients = [
			{
				id: 'c1',
				user_id: 'u',
				vertical_slug: 'realtor',
				name: 'Buyer',
				contact: null,
				need_summary: null,
				budget_from: null,
				budget_to: null,
				preferred_areas: [],
				emotional_motive: null,
				next_action: 'Email',
				status: 'lead',
				created_at: '',
				updated_at: '',
			},
		];
		expect(countOverviewCrmFollowUps(deals, clients)).toBe(2);
		expect(
			pickFirstOverviewCrmFollowUpCommunicationFocus(deals, clients, {
				dealFallback: 'Deal',
				clientFallback: 'Client',
			})
		).toEqual({ relatedType: 'deal', relatedId: 'd1' });
		expect(resolveOverviewClientsNavigation(0, true)).toEqual({
			kind: 'leadsModule',
		});
		expect(resolveOverviewClientsNavigation(1, true)).toEqual({
			kind: 'clientsDirectory',
		});
	});

	it('filters enabled realtor_* addon panels by sort_order', () => {
		expect(
			sortedEnabledRealtorAddonModules([
				makeRuntimeModule({
					id: '1',
					module_key: 'realtor_tasks',
					module_name: 'Tasks',
					module_category: 'ops',
					sort_order: 40,
				}),
				makeRuntimeModule({
					id: '2',
					module_key: 'clients',
					module_name: 'Clients',
					module_category: 'core',
					sort_order: 10,
				}),
				makeRuntimeModule({
					id: '3',
					module_key: 'realtor_leads',
					module_name: 'Leads',
					module_category: 'crm',
					sort_order: 25,
				}),
			]).map((m) => m.module_key)
		).toEqual(['realtor_leads', 'realtor_tasks']);
	});

	it('builds a JTBD preview from realtor context', () => {
		const property = createEmptyRealtorProperty();
		property.jtbd_context = {
			trigger_context: 'нужна квартира у моря',
			expected_result: 'найти дом и рабочее пространство',
			emotional_transformation: 'спокойствие после дня',
		};

		expect(buildJtbdPreview(property)).toContain('спокойствие после дня');
	});

	it('selects stable recipe keys', () => {
		expect(selectRecipeKey('description')).toBe(
			'realtor_property_description_jtbd'
		);
		expect(selectRecipeKey('contentPack')).toBe(
			'realtor_property_content_pack'
		);
		expect(selectRecipeKey('roleplay')).toBe('realtor_learning_roleplay');
	});

	it('maps runtime config modules, actions and photo presets', () => {
		expect(
			enabledRuntimeModuleKeys([
				makeRuntimeModule({
					id: '2',
					module_key: 'media-studio',
					module_name: 'Media',
					module_category: 'content',
					sort_order: 20,
				}),
				makeRuntimeModule({
					id: '1',
					module_key: 'objects',
					module_name: 'Objects',
					module_category: 'core',
					sort_order: 10,
				}),
			])
		).toEqual(['objects', 'media-studio']);

		expect(
			aiActionsForModule(
				[
					{
						module_key: 'objects',
						action_key: 'sales_copy',
						display_name: 'Copy',
						description: null,
						input_schema: {},
						artifact_kind: 'text',
						sort_order: 20,
					},
					{
						module_key: 'profile',
						action_key: 'brand',
						display_name: 'Brand',
						description: null,
						input_schema: {},
						artifact_kind: 'brand',
						sort_order: 10,
					},
				],
				'objects'
			).map((action) => action.action_key)
		).toEqual(['sales_copy']);

		expect(
			Object.keys(
				groupPhotoPresetsByCategory([
					makePhotoPreset({
						id: 'preset-1',
						preset_key: 'brighten',
						display_name: 'Brighten',
						category: 'enhance',
						action_type: 'image_edit',
						ugs_type_key: 'image_studio_image_edit',
						sort_order: 10,
					}),
				])
			)
		).toEqual(['enhance']);
	});

	it('maps DTO lists to dashboard metrics', () => {
		const metrics = buildRealtorDashboardMetrics({
			verticalSlug: 'realtor',
			profile: {
				id: 'profile-1',
				user_id: 'user-1',
				vertical_slug: 'realtor',
				display_name: 'Анна',
				headline: null,
				city: 'Владивосток',
				agency_name: null,
				specialization: [],
				profile_data: {},
				is_public_ready: false,
				created_at: '',
				updated_at: '',
			},
			properties: [
				{
					id: 'property-1',
					user_id: 'user-1',
					title: 'Квартира',
					property_type: 'apartment',
					deal_type: 'sale',
					city: '',
					status: 'draft',
					created_at: PW_TEST_TS,
					updated_at: PW_TEST_TS,
				},
			],
			clients: [
				{
					id: 'client-1',
					user_id: 'user-1',
					vertical_slug: 'realtor',
					name: 'Иван',
					contact: null,
					need_summary: null,
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: null,
					next_action: null,
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [],
			courses: [
				{
					id: 'course-1',
					course_key: 'start',
					vertical_slug: 'realtor',
					title: 'Start',
					description: null,
					level: 'starter',
					sort_order: 0,
					lessons: [
						{
							id: 'lesson-1',
							lesson_key: 'a',
							title: 'A',
							summary: null,
							content_md: '',
							exercise: {},
							sort_order: 0,
							completed: true,
						},
					],
				},
			],
			artifacts: [],
		});

		expect(metrics.profileReady).toBe(true);
		expect(metrics.propertiesTotal).toBe(1);
		expect(metrics.learningCompleted).toBe(1);
	});
});
