/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Professional Worlds desktop API client freshness, Zod parse boundaries, and stream handling.
 *
 * Invariants:
 * - Snapshot bootstrap sends cache-busting query params for prod freshness.
 * - Invalid communication-log, CRM-lite client/deal, lead/task, and wave-21 write payloads fail closed via `ProfessionalWorldsApiParseError`.
 * - SSE parser still handles the final event when server closes stream without trailing separator.
 *
 * Related:
 * - src/features/professional-worlds/desktop/api.ts
 * - src/features/professional-worlds/desktop/professionalWorldsApiZod.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	backfillProfessionalDealPropertyLinks,
	appendRealtorDealEvent,
	attachRealtorPropertyMedia,
	commitObjectIntake,
	createProfessionalClient,
	createProfessionalDeal,
	createProfessionalMediaAlbum,
	createRealtorBuyerRequirement,
	createRealtorCommunicationLog,
	createRealtorDocument,
	createRealtorLead,
	createRealtorMarketingCampaign,
	createRealtorMediaBatch,
	createRealtorProperty,
	createRealtorTask,
	listRealtorCommunicationLogs,
	listRealtorDocuments,
	listRealtorPublicationChannels,
	listRealtorLeads,
	listRealtorShowings,
	listRealtorTasks,
	listProfessionalArtifacts,
	loadProfessionalWorldsSnapshot,
	patchRealtorPublicationChannel,
	streamObjectIntakeParse,
	resumeProfessionalPlaybookStream,
	streamProfessionalPlaybook,
	updateProfessionalDeal,
	upsertRealtorObjectionReply,
	upsertRealtorPublicationChannel,
} from './api';
import { ProfessionalWorldsApiParseError } from './professionalWorldsApiZod';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPutMock = vi.fn();
const apiPatchMock = vi.fn();
const apiFetchWithAuthMock = vi.fn();

vi.mock('@/services/api/client', () => ({
	api: {
		get: (...args: unknown[]) => apiGetMock(...args),
		post: (...args: unknown[]) => apiPostMock(...args),
		put: (...args: unknown[]) => apiPutMock(...args),
		patch: (...args: unknown[]) => apiPatchMock(...args),
		delete: vi.fn(),
	},
	apiFetchWithAuth: (...args: unknown[]) => apiFetchWithAuthMock(...args),
}));

function buildRuntimeModule(
	id: string,
	moduleKey: string,
	moduleName: string,
	moduleCategory: string,
	sortOrder: number
) {
	return {
		id,
		vertical_slug: 'realtor',
		module_key: moduleKey,
		module_name: moduleName,
		module_category: moduleCategory,
		icon_key: null,
		config: {},
		sort_order: sortOrder,
		is_enabled: true,
		created_at: '2026-05-27T09:00:00Z',
		updated_at: '2026-05-27T09:00:00Z',
	};
}

function buildSnapshotPayload() {
	const modules = [
		buildRuntimeModule(
			'11111111-1111-4111-8111-111111111111',
			'profile',
			'Profile',
			'core',
			1
		),
		buildRuntimeModule(
			'22222222-2222-4222-8222-222222222222',
			'objects',
			'Objects',
			'core',
			2
		),
		buildRuntimeModule(
			'33333333-3333-4333-8333-333333333333',
			'clients',
			'Clients',
			'crm',
			3
		),
		buildRuntimeModule(
			'44444444-4444-4444-8444-444444444444',
			'deals',
			'Deals',
			'crm',
			4
		),
		buildRuntimeModule(
			'55555555-5555-4555-8555-555555555555',
			'learning',
			'Learning',
			'core',
			5
		),
		buildRuntimeModule(
			'66666666-6666-4666-8666-666666666666',
			'artifacts',
			'Artifacts',
			'core',
			6
		),
	];
	const runtimeConfig = {
		vertical_slug: 'realtor',
		modules,
		schemas: [],
		ai_actions: [],
		photo_presets: [],
		integrations: [],
		playbooks: [],
	};
	return {
		verticals: [{ slug: 'realtor', name: 'Realtor' }],
		runtimeConfig,
		runtimeConfigs: { configs: [runtimeConfig] },
		verticalActivations: [],
		profile: null,
		properties: [],
		clients: [],
		deals: [],
		courses: [],
		artifacts: [],
	};
}

function createResponseFromChunks(chunks: string[]): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
	return new Response(stream, {
		status: 200,
		headers: { 'Content-Type': 'text/event-stream' },
	});
}

describe('professional worlds desktop api', () => {
	afterEach(() => {
		apiGetMock.mockReset();
		apiPostMock.mockReset();
		apiPatchMock.mockReset();
		apiFetchWithAuthMock.mockReset();
	});

	it('adds cache-busting _ts query on snapshot GET requests', async () => {
		const payload = buildSnapshotPayload();
		apiGetMock.mockImplementation(async (url: string) => {
			if (url.includes('/me/snapshot')) {
				return {
					verticals: payload.verticals,
					runtime_config: payload.runtimeConfig,
					runtime_configs: payload.runtimeConfigs.configs,
					vertical_activations: payload.verticalActivations,
					profile: payload.profile,
					properties: payload.properties,
					clients: payload.clients,
					deals: payload.deals,
					courses: payload.courses,
					artifacts: payload.artifacts,
				};
			}
			throw new Error(`unexpected ${url}`);
		});

		await loadProfessionalWorldsSnapshot('realtor');

		const calledUrls = apiGetMock.mock.calls.map((call) => call[0] as string);
		expect(calledUrls).toHaveLength(1);
		expect(calledUrls[0]).toContain('/me/snapshot');
		expect(calledUrls[0]).toContain('_ts=');
	});

	it('loads snapshot from aggregate /me/snapshot when available', async () => {
		const payload = buildSnapshotPayload();
		apiGetMock.mockImplementation(async (url: string) => {
			if (url.includes('/me/snapshot')) {
				return {
					verticals: payload.verticals,
					runtime_config: payload.runtimeConfig,
					runtime_configs: payload.runtimeConfigs.configs,
					vertical_activations: payload.verticalActivations,
					profile: payload.profile,
					properties: payload.properties,
					clients: payload.clients,
					deals: payload.deals,
					courses: payload.courses,
					artifacts: payload.artifacts,
				};
			}
			throw new Error(`unexpected ${url}`);
		});

		const snapshot = await loadProfessionalWorldsSnapshot('realtor');
		expect(snapshot.clients).toEqual([]);
		expect(apiGetMock.mock.calls).toHaveLength(1);
		expect(apiGetMock.mock.calls[0]?.[0]).toContain('/me/snapshot');
	});

	it('falls back to fan-out GETs and warns when aggregate snapshot fails', async () => {
		const payload = buildSnapshotPayload();
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		apiGetMock.mockImplementation(async (url: string) => {
			if (url.includes('/me/snapshot')) {
				throw new Error('snapshot unavailable');
			}
			if (url.includes('/me/runtime-configs')) {
				return payload.runtimeConfigs;
			}
			if (url.includes('/verticals')) return payload.verticals;
			if (url.includes('/me/vertical-activations')) {
				return payload.verticalActivations;
			}
			if (url.includes('/me/profile')) return payload.profile;
			if (url.includes('/realtor/properties')) return payload.properties;
			if (url.includes('/clients?vertical_slug=')) {
				return payload.clients;
			}
			if (url.includes('/deals?vertical_slug=')) {
				return payload.deals;
			}
			if (url.includes('/learning/courses')) return payload.courses;
			if (url.includes('/artifacts')) return payload.artifacts;
			return {};
		});

		await loadProfessionalWorldsSnapshot('realtor');

		expect(warnSpy).toHaveBeenCalledWith(
			'[professional-worlds] aggregate snapshot unavailable; falling back to fan-out GETs',
			expect.any(Error)
		);
		expect(
			apiGetMock.mock.calls.some((call) =>
				String(call[0]).includes('/me/snapshot')
			)
		).toBe(true);
		warnSpy.mockRestore();
	});

	it('loads snapshot without duplicate runtime-config when configs list includes the vertical', async () => {
		const payload = buildSnapshotPayload();
		apiGetMock.mockImplementation(async (url: string) => {
			if (url.includes('/me/snapshot')) {
				throw new Error('snapshot unavailable');
			}
			if (url.includes('/me/runtime-configs')) {
				return payload.runtimeConfigs;
			}
			if (url.includes('/me/runtime-config')) {
				throw new Error('unexpected /me/runtime-config call');
			}
			if (url.includes('/verticals')) return payload.verticals;
			if (url.includes('/me/vertical-activations')) {
				return payload.verticalActivations;
			}
			if (url.includes('/me/profile')) return payload.profile;
			if (url.includes('/realtor/properties')) return payload.properties;
			if (url.includes('/clients?vertical_slug=')) {
				return payload.clients;
			}
			if (url.includes('/deals?vertical_slug=')) {
				return payload.deals;
			}
			if (url.includes('/learning/courses')) return payload.courses;
			if (url.includes('/artifacts')) return payload.artifacts;
			return {};
		});

		await loadProfessionalWorldsSnapshot('realtor');

		const calledUrls = apiGetMock.mock.calls.map((call) => call[0] as string);
		expect(calledUrls.some((url) => url.includes('/me/runtime-config?'))).toBe(
			false
		);
	});

	it('parses final SSE result block without trailing separator', async () => {
		const previewSpy = vi.fn();
		apiFetchWithAuthMock.mockResolvedValue(
			createResponseFromChunks([
				'event: started\ndata: {"request_id":"req-1"}\n\n',
				'event: result\ndata: {"job_id":"11111111-1111-4111-8111-111111111111","property":{"title":"A","infrastructure":[]},"confidence":{},"warnings":[]}',
			])
		);

		await streamObjectIntakeParse('raw source text for intake parse', {
			onPreview: previewSpy,
		});

		expect(previewSpy).toHaveBeenCalledTimes(1);
		expect(previewSpy.mock.calls[0]?.[0]?.job_id).toBe(
			'11111111-1111-4111-8111-111111111111'
		);
	});

	it('surfaces parse errors when object intake preview drifts', async () => {
		const errorSpy = vi.fn();
		apiFetchWithAuthMock.mockResolvedValue(
			createResponseFromChunks([
				'event: result\ndata: {"job_id":"not-a-uuid","property":{"title":"A"},"confidence":{},"warnings":[]}',
			])
		);

		await streamObjectIntakeParse('raw source text for intake parse', {
			onError: errorSpy,
		});

		expect(errorSpy).toHaveBeenCalledWith('Invalid object intake preview');
	});

	it('rejects short object intake source text before stream POST', async () => {
		await expect(streamObjectIntakeParse('too short', {})).rejects.toThrow(
			ProfessionalWorldsApiParseError
		);
		expect(apiFetchWithAuthMock).not.toHaveBeenCalled();
	});

	it('rejects invalid object intake commit body before POST', async () => {
		await expect(commitObjectIntake('not-a-uuid', ['title'])).rejects.toThrow(
			ProfessionalWorldsApiParseError
		);
		expect(apiPostMock).not.toHaveBeenCalled();
	});

	it('rejects invalid playbook launch body before SSE POST', async () => {
		await expect(
			streamProfessionalPlaybook(
				'realtor',
				'realtor_property_content_pack',
				{ idempotency_key: 'x'.repeat(200) },
				vi.fn()
			)
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiFetchWithAuthMock).not.toHaveBeenCalled();
	});

	it('rejects invalid playbook resume body before SSE POST', async () => {
		await expect(
			resumeProfessionalPlaybookStream(
				'11111111-1111-4111-8111-111111111111',
				{ idempotency_key: 'x'.repeat(200) },
				vi.fn()
			)
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiFetchWithAuthMock).not.toHaveBeenCalled();
	});

	it('parses communication log list through Zod before returning', async () => {
		const logRow = {
			id: '11111111-1111-4111-8111-111111111111',
			user_id: '22222222-2222-4222-8222-222222222222',
			related_type: 'client',
			related_id: '33333333-3333-4333-8333-333333333333',
			channel: 'phone',
			body: 'Follow-up call',
			meta: { source: 'test' },
			created_at: '2026-05-27T09:00:00Z',
		};
		apiGetMock.mockResolvedValue([logRow]);

		const logs = await listRealtorCommunicationLogs({
			relatedType: 'client',
			relatedId: '33333333-3333-4333-8333-333333333333',
		});

		expect(logs).toEqual([logRow]);
		expect(apiGetMock.mock.calls[0]?.[0]).toContain(
			'/realtor/communication-logs'
		);
	});

	it('throws ProfessionalWorldsApiParseError when communication log list drifts', async () => {
		apiGetMock.mockResolvedValue([{ id: 'not-a-uuid' }]);

		await expect(
			listRealtorCommunicationLogs({ relatedType: 'client' })
		).rejects.toThrow(ProfessionalWorldsApiParseError);
	});

	it('rejects invalid communication log create body before POST', async () => {
		await expect(
			createRealtorCommunicationLog({
				related_type: 'deal',
				related_id: '11111111-1111-4111-8111-111111111111',
				channel: 'phone',
				body: '',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPostMock).not.toHaveBeenCalled();
	});

	it('parses communication log create response through Zod', async () => {
		const logRow = {
			id: '11111111-1111-4111-8111-111111111111',
			user_id: '22222222-2222-4222-8222-222222222222',
			related_type: 'deal',
			related_id: '33333333-3333-4333-8333-333333333333',
			channel: 'phone',
			body: 'Follow-up call',
			meta: {},
			created_at: '2026-05-27T09:00:00Z',
		};
		apiPostMock.mockResolvedValue(logRow);

		const log = await createRealtorCommunicationLog({
			related_type: 'deal',
			related_id: '33333333-3333-4333-8333-333333333333',
			channel: 'phone',
			body: 'Follow-up call',
		});

		expect(log).toEqual(logRow);
	});

	it('parses createProfessionalClient response through Zod', async () => {
		const clientRow = {
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
		};
		apiPostMock.mockResolvedValue(clientRow);

		const client = await createProfessionalClient({
			vertical_slug: 'realtor',
			name: 'Ivan Buyer',
			status: 'lead',
		});

		expect(client).toEqual(clientRow);
		expect(apiPostMock.mock.calls[0]?.[0]).toContain('/clients');
	});

	it('rejects invalid professional client create body before POST', async () => {
		await expect(
			createProfessionalClient({
				vertical_slug: 'realtor',
				name: '',
				status: 'lead',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPostMock).not.toHaveBeenCalled();
	});

	it('throws ProfessionalWorldsApiParseError when createProfessionalDeal response drifts', async () => {
		apiPostMock.mockResolvedValue({ title: 'Missing ids' });

		await expect(
			createProfessionalDeal({
				vertical_slug: 'realtor',
				title: 'Deal',
				stage: 'lead',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
	});

	it('parses updateProfessionalDeal response through Zod', async () => {
		const dealRow = {
			id: '66666666-6666-4666-8666-666666666666',
			user_id: '55555555-5555-4555-8555-555555555555',
			vertical_slug: 'realtor',
			client_id: null,
			title: 'Sea View deal',
			stage: 'won',
			amount: null,
			next_action: null,
			deal_data: {},
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:05:00Z',
		};
		apiPatchMock.mockResolvedValue(dealRow);

		const deal = await updateProfessionalDeal(
			'66666666-6666-4666-8666-666666666666',
			{
				stage: 'won',
			}
		);

		expect(deal).toEqual(dealRow);
		expect(apiPatchMock.mock.calls[0]?.[0]).toContain('/deals/');
	});

	it('rejects invalid professional deal update body before PATCH', async () => {
		await expect(
			updateProfessionalDeal('66666666-6666-4666-8666-666666666666', {
				title: '',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPatchMock).not.toHaveBeenCalled();
	});

	it('rejects invalid realtor property, lead, and task create bodies before POST', async () => {
		await expect(
			createRealtorProperty({
				title: '',
				property_type: 'apartment',
				deal_type: 'sale',
				city: 'City',
				status: 'draft',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		await expect(
			createRealtorLead({
				name: '',
				vertical_slug: 'realtor',
				status: 'new',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		await expect(
			createRealtorTask({
				title: '',
				status: 'open',
				priority: 'normal',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPostMock).not.toHaveBeenCalled();
	});

	it('rejects invalid buyer requirement, document, campaign, and deal event bodies before POST', async () => {
		await expect(createRealtorBuyerRequirement({ title: '' })).rejects.toThrow(
			ProfessionalWorldsApiParseError
		);
		await expect(
			createRealtorDocument({ title: '', doc_type: 'contract' })
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		await expect(
			createRealtorMarketingCampaign({ title: '', status: 'draft' })
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		await expect(
			appendRealtorDealEvent('66666666-6666-4666-8666-666666666666', {
				stage_to: '',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPostMock).not.toHaveBeenCalled();
	});

	it('rejects invalid media attach, batch, and album bodies before POST', async () => {
		await expect(
			attachRealtorPropertyMedia('11111111-1111-4111-8111-111111111111', {
				unified_content_id: 'not-a-uuid',
				sort_order: 0,
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		await expect(
			createRealtorMediaBatch('11111111-1111-4111-8111-111111111111', {
				preset_key: 'x',
				source_content_ids: [],
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		await expect(
			createProfessionalMediaAlbum({ title: '', vertical_slug: 'realtor' })
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPostMock).not.toHaveBeenCalled();
	});

	it('parses listRealtorLeads response through Zod', async () => {
		const leadRow = {
			id: '77777777-7777-4777-8777-777777777777',
			user_id: '55555555-5555-4555-8555-555555555555',
			vertical_slug: 'realtor',
			name: 'Lead One',
			contact: null,
			source: null,
			status: 'new',
			notes: null,
			converted_client_id: null,
			lead_data: {},
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		apiGetMock.mockResolvedValue([leadRow]);

		const leads = await listRealtorLeads();

		expect(leads).toEqual([leadRow]);
		expect(apiGetMock.mock.calls[0]?.[0]).toContain('/realtor/leads');
	});

	it('throws ProfessionalWorldsApiParseError when listRealtorTasks drifts', async () => {
		apiGetMock.mockResolvedValue([{ title: 'Missing ids' }]);

		await expect(listRealtorTasks()).rejects.toThrow(
			ProfessionalWorldsApiParseError
		);
	});

	it('parses createRealtorProperty response through Zod', async () => {
		const propertyRow = {
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
		apiPostMock.mockResolvedValue(propertyRow);

		const property = await createRealtorProperty({
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
		});

		expect(property).toEqual(propertyRow);
	});

	it('throws ProfessionalWorldsApiParseError when listRealtorShowings drifts', async () => {
		apiGetMock.mockResolvedValue([{ status: 'scheduled' }]);

		await expect(listRealtorShowings()).rejects.toThrow(
			ProfessionalWorldsApiParseError
		);
	});

	it('throws ProfessionalWorldsApiParseError when listProfessionalArtifacts drifts', async () => {
		apiGetMock.mockResolvedValue([{ title: 'Missing ids' }]);

		await expect(listProfessionalArtifacts()).rejects.toThrow(
			ProfessionalWorldsApiParseError
		);
	});

	it('parses listRealtorDocuments response through Zod', async () => {
		const documentRow = {
			id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
			user_id: '55555555-5555-4555-8555-555555555555',
			deal_id: null,
			property_id: null,
			title: 'Purchase agreement',
			doc_type: 'contract',
			checklist_state: {},
			unified_content_id: null,
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		apiGetMock.mockResolvedValue([documentRow]);

		const documents = await listRealtorDocuments();

		expect(documents).toEqual([documentRow]);
		expect(apiGetMock.mock.calls[0]?.[0]).toContain('/realtor/documents');
	});

	it('parses deal property link backfill through Zod', async () => {
		apiPostMock.mockResolvedValue({ updated: 2, skipped: 1 });

		const result = await backfillProfessionalDealPropertyLinks('realtor');

		expect(result).toEqual({ updated: 2, skipped: 1 });
	});

	it('throws ProfessionalWorldsApiParseError when backfill response drifts', async () => {
		apiPostMock.mockResolvedValue({ updated: 'two' });

		await expect(
			backfillProfessionalDealPropertyLinks('realtor')
		).rejects.toThrow(ProfessionalWorldsApiParseError);
	});

	it('parses publication channel list through Zod', async () => {
		const channelRow = {
			id: '11111111-1111-4111-8111-111111111111',
			user_id: '55555555-5555-4555-8555-555555555555',
			property_id: '22222222-2222-4222-8222-222222222222',
			channel_key: 'vk',
			status: 'pending',
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		apiGetMock.mockResolvedValue([channelRow]);

		const channels = await listRealtorPublicationChannels(
			channelRow.property_id
		);

		expect(channels).toEqual([channelRow]);
	});

	it('rejects invalid objection reply upsert body before PUT', async () => {
		await expect(
			upsertRealtorObjectionReply('price_too_high', { reply_text: '' })
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPutMock).not.toHaveBeenCalled();
	});

	it('parses objection reply upsert response through Zod', async () => {
		const replyRow = {
			id: '33333333-3333-4333-8333-333333333333',
			user_id: '55555555-5555-4555-8555-555555555555',
			objection_key: 'price_too_high',
			reply_text: 'Compare with similar listings nearby.',
			tags: ['price'],
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		apiPutMock.mockResolvedValue(replyRow);

		const reply = await upsertRealtorObjectionReply('price_too_high', {
			reply_text: replyRow.reply_text,
			tags: replyRow.tags,
		});

		expect(reply).toEqual(replyRow);
	});

	it('rejects invalid publication channel upsert body before POST', async () => {
		await expect(
			upsertRealtorPublicationChannel('22222222-2222-4222-8222-222222222222', {
				channel_key: '',
				status: 'pending',
			})
		).rejects.toThrow(ProfessionalWorldsApiParseError);
		expect(apiPostMock).not.toHaveBeenCalled();
	});

	it('parses publication channel patch response through Zod', async () => {
		const channelRow = {
			id: '11111111-1111-4111-8111-111111111111',
			user_id: '55555555-5555-4555-8555-555555555555',
			property_id: '22222222-2222-4222-8222-222222222222',
			channel_key: 'vk',
			status: 'published',
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		};
		apiPatchMock.mockResolvedValue(channelRow);

		const channel = await patchRealtorPublicationChannel(channelRow.id, {
			status: 'published',
		});

		expect(channel).toEqual(channelRow);
	});
});
