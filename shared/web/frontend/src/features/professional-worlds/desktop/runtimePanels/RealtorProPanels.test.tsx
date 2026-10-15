/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Realtor Pro runtime panels: leads views, pipeline ordering, tasks and documents.
 *
 * Invariants:
 * - Mock `../api`; no real HTTP.
 * - Panels use `react-i18next`; this suite initializes an EN `Professional Worlds` resource bundle via `i18next.createInstance()` for stable assertions.
 *
 * Related:
 * - RealtorProPanels.tsx
 */

import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import type { i18n } from 'i18next';
import i18next from 'i18next';
import { describe, expect, it, vi, beforeAll } from 'vitest';

vi.mock('@/notifications', () => ({
	useNotifications: () => ({
		toast: {
			success: vi.fn(),
			error: vi.fn(),
			warning: vi.fn(),
		},
	}),
}));

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import {
	makeRuntimeConfig,
	makeRuntimeModuleByKey,
} from '../professionalWorldsTestFixtures';
import type { RuntimeModulePanelProps } from '../runtimeModuleRegistry';
import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import type {
	ProfessionalClient,
	ProfessionalDeal,
	ProfessionalWorldsSnapshot,
	RealtorLead,
	RealtorProperty,
} from '../types';
import {
	ClientsPanel,
	CommunicationTimelinePanel,
	DealsPipelinePanel,
	DocumentsPanel,
	InsightsPanel,
	LeadsPanel,
	MarketingCampaignPanel,
	ObjectionLibraryPanel,
	SellerOnboardingPanel,
	ShowingsCalendarPanel,
	TasksPanel,
} from './RealtorProPanels';
import {
	convertRealtorLeadToClient,
	createRealtorBuyerRequirement,
	createRealtorCommunicationLog,
	createRealtorDocument,
	createRealtorMarketingCampaign,
	deleteRealtorShowing,
	deleteRealtorTask,
	appendRealtorDealEvent,
	listRealtorCommunicationLogs,
	listRealtorDocuments,
	listRealtorPublicationChannels,
	listRealtorTasks,
	listRealtorObjectionReplies,
	patchRealtorPublicationChannel,
	updateProfessionalDeal,
	updateRealtorDocument,
	updateRealtorMarketingCampaign,
	upsertRealtorObjectionReply,
	upsertRealtorPublicationChannel,
} from '../api';

vi.mock('../api', () => ({
	listRealtorLeads: vi.fn().mockResolvedValue([
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
		} satisfies RealtorLead,
		{
			id: 'l2',
			user_id: 'u1',
			vertical_slug: 'realtor',
			name: 'Beta',
			status: 'contacted',
			source: 'referral',
			contact: '',
			notes: '',
			converted_client_id: null,
			lead_data: {},
			created_at: '',
			updated_at: '',
		} satisfies RealtorLead,
	]),
	createRealtorLead: vi.fn().mockResolvedValue({}),
	convertRealtorLeadToClient: vi.fn().mockResolvedValue({}),
	listRealtorBuyerRequirements: vi.fn().mockResolvedValue([
		{
			id: 'req1',
			user_id: 'u1',
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
	]),
	createRealtorBuyerRequirement: vi.fn().mockResolvedValue({
		id: 'req-new',
		user_id: 'u1',
		client_id: null,
		title: 'New requirement',
		requirements: {},
		created_at: '',
		updated_at: '',
	}),
	listRealtorDealEvents: vi.fn().mockResolvedValue([]),
	appendRealtorDealEvent: vi.fn().mockResolvedValue({
		id: 'ev1',
		deal_id: 'deal-early',
		stage_from: 'showing',
		stage_to: 'negotiation',
		note: 'Client ready',
		event_data: {},
		created_at: '',
	}),
	backfillProfessionalDealPropertyLinks: vi
		.fn()
		.mockResolvedValue({ updated: 1, skipped: 0 }),
	updateProfessionalDeal: vi.fn(),
	listRealtorPriceAnalysisSnapshots: vi.fn().mockResolvedValue([]),
	listRealtorListingQualityScores: vi.fn().mockResolvedValue([
		{
			id: 'q1',
			user_id: 'u1',
			property_id: 'p1',
			score: 77.2,
			breakdown: { photos: 10, copy: 5 },
			created_at: '',
		},
	]),
	recomputeRealtorListingQuality: vi.fn().mockResolvedValue({
		id: 'q2',
		user_id: 'u1',
		property_id: 'p1',
		score: 80,
		breakdown: {},
		created_at: '',
	}),
	listRealtorDocuments: vi.fn().mockResolvedValue([
		{
			id: 'd1',
			user_id: 'u1',
			vertical_slug: 'realtor',
			property_id: 'p1',
			title: 'Passport',
			doc_type: 'identity',
			checklist_state: { verified: false },
			unified_content_id: null,
			created_at: '',
			updated_at: '',
		},
	]),
	createRealtorDocument: vi.fn().mockResolvedValue({
		id: 'd-new',
		user_id: 'u1',
		vertical_slug: 'realtor',
		property_id: 'p1',
		title: 'Contract draft',
		doc_type: 'contract',
		checklist_state: {},
		unified_content_id: null,
		created_at: '',
		updated_at: '',
	}),
	updateRealtorDocument: vi.fn().mockResolvedValue({
		id: 'd1',
		user_id: 'u1',
		vertical_slug: 'realtor',
		property_id: 'p1',
		title: 'Passport updated',
		doc_type: 'contract',
		checklist_state: { verified: false },
		unified_content_id: null,
		created_at: '',
		updated_at: '',
	}),
	listRealtorShowings: vi.fn().mockResolvedValue([
		{
			id: 's1',
			user_id: 'u1',
			property_id: 'p1',
			client_id: 'c1',
			deal_id: null,
			scheduled_at: '2026-05-27T12:00:00.000Z',
			status: 'planned',
			notes: null,
			duration_minutes: null,
			location_notes: null,
			created_at: '',
			updated_at: '',
		},
	]),
	createRealtorShowing: vi.fn().mockResolvedValue({}),
	deleteRealtorShowing: vi.fn().mockResolvedValue(undefined),
	listRealtorTasks: vi.fn().mockResolvedValue([]),
	deleteRealtorTask: vi.fn().mockResolvedValue(undefined),
	listRealtorSellerProfiles: vi.fn().mockResolvedValue([]),
	listRealtorMarketingCampaigns: vi.fn().mockResolvedValue([
		{
			id: 'mc1',
			user_id: 'u1',
			property_id: 'p1',
			title: 'Spring launch',
			channels: ['vk'],
			status: 'draft',
			campaign_data: {},
			created_at: '',
			updated_at: '',
		},
	]),
	createRealtorMarketingCampaign: vi.fn().mockResolvedValue({
		id: 'mc-new',
		user_id: 'u1',
		property_id: 'p1',
		title: 'Summer push',
		channels: [],
		status: 'draft',
		campaign_data: {},
		created_at: '',
		updated_at: '',
	}),
	updateRealtorMarketingCampaign: vi.fn().mockResolvedValue({
		id: 'mc1',
		user_id: 'u1',
		property_id: 'p1',
		title: 'Spring launch updated',
		channels: ['vk'],
		status: 'active',
		campaign_data: {},
		created_at: '',
		updated_at: '',
	}),
	listRealtorCommunicationLogs: vi.fn().mockResolvedValue([
		{
			id: 'log1',
			user_id: 'u1',
			related_type: 'deal',
			related_id: 'deal-early',
			channel: 'phone',
			body: 'Follow-up call',
			meta: {},
			created_at: '',
		},
	]),
	createRealtorCommunicationLog: vi.fn().mockResolvedValue({
		id: 'log-new',
		user_id: 'u1',
		related_type: 'deal',
		related_id: 'deal-early',
		channel: 'email',
		body: 'Sent contract',
		meta: {},
		created_at: '',
	}),
	listRealtorObjectionReplies: vi.fn().mockResolvedValue([]),
	upsertRealtorObjectionReply: vi.fn().mockResolvedValue({
		id: 'or1',
		user_id: 'u1',
		objection_key: 'price_too_high',
		reply_text: 'Compare value with similar listings nearby.',
		tags: ['price'],
		created_at: '2026-05-27T09:00:00Z',
		updated_at: '2026-05-27T09:00:00Z',
	}),
	listRealtorPublicationChannels: vi.fn().mockResolvedValue([
		{
			id: 'pc1',
			user_id: 'u1',
			property_id: 'p1',
			channel_key: 'vk',
			status: 'pending',
			meta: {},
			created_at: '2026-05-27T09:00:00Z',
			updated_at: '2026-05-27T09:00:00Z',
		},
	]),
	upsertRealtorPublicationChannel: vi.fn().mockResolvedValue({
		id: 'pc2',
		user_id: 'u1',
		property_id: 'p1',
		channel_key: 'telegram',
		status: 'pending',
		meta: {},
		created_at: '2026-05-27T09:00:00Z',
		updated_at: '2026-05-27T09:00:00Z',
	}),
	patchRealtorPublicationChannel: vi.fn().mockResolvedValue({
		id: 'pc1',
		user_id: 'u1',
		property_id: 'p1',
		channel_key: 'vk',
		status: 'published',
		meta: {},
		created_at: '2026-05-27T09:00:00Z',
		updated_at: '2026-05-27T09:00:00Z',
	}),
}));

const baseProps = (
	overrides: Partial<RuntimeModulePanelProps> = {}
): RuntimeModulePanelProps => {
	const properties: RealtorProperty[] = [
		{
			id: 'p1',
			user_id: 'u1',
			title: 'Sea View',
			property_type: 'flat',
			deal_type: 'sale',
			city: 'Vladivostok',
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
	const clients: ProfessionalClient[] = [
		{
			id: 'c1',
			user_id: 'u1',
			vertical_slug: 'realtor',
			name: 'Buyer One',
			contact: '',
			need_summary: null,
			emotional_motive: null,
			status: 'lead',
			budget_from: '1',
			budget_to: '2',
			preferred_areas: ['Center'],
			next_action: 'Call',
			created_at: '',
			updated_at: '',
		},
		{
			id: 'c2',
			user_id: 'u1',
			vertical_slug: 'realtor',
			name: 'Seller One',
			contact: '',
			need_summary: 'List duplex',
			emotional_motive: null,
			status: 'lead',
			budget_from: null,
			budget_to: null,
			preferred_areas: [],
			next_action: null,
			created_at: '',
			updated_at: '',
		},
	];
	const deals: ProfessionalDeal[] = [
		{
			id: 'deal-early',
			user_id: 'u1',
			vertical_slug: 'realtor',
			client_id: null,
			title: 'Early offer',
			stage: 'offer',
			amount: null,
			next_action: 'Send draft',
			deal_data: {},
			created_at: '2020-01-01T00:00:00Z',
			updated_at: '2020-01-02T00:00:00Z',
		},
		{
			id: 'deal-late',
			user_id: 'u1',
			vertical_slug: 'realtor',
			client_id: null,
			title: 'Late closing',
			stage: 'closing',
			amount: null,
			next_action: 'Sign',
			deal_data: {},
			created_at: '2021-01-01T00:00:00Z',
			updated_at: '2021-01-02T00:00:00Z',
		},
	];
	const snapshot: ProfessionalWorldsSnapshot = {
		verticals: [],
		runtimeConfig: makeRuntimeConfig({ config_version_hash: 'h' }),
		runtimeConfigs: [],
		verticalActivations: [],
		profile: null,
		properties,
		clients,
		deals,
		courses: [],
		artifacts: [],
	};
	return {
		entry: {
			moduleKey: 'test',
			label: 'Test',
			description: '',
			panelKind: 'dedicated',
			panel: {} as RuntimeModulePanelProps['entry']['panel'],
		},
		runtimeModule: null,
		snapshot,
		verticalSlug: 'realtor',
		...overrides,
	};
};

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		interpolation: { escapeValue: false },
		resources: {
			en: {
				[PROFESSIONAL_WORLDS_NS]: enProfessionalWorlds,
			},
		},
		ns: [PROFESSIONAL_WORLDS_NS],
		defaultNS: PROFESSIONAL_WORLDS_NS,
	});
});

type PwCtx = ProfessionalWorldsWorkspaceContextValue;

function renderWithPwLocales(ui: ReactElement) {
	return render(<I18nextProvider i18n={pwI18n}>{ui}</I18nextProvider>);
}

const testRealtorPipelineModule = makeRuntimeModuleByKey(
	'realtor_pipeline',
	'pipeline'
);
const testRealtorCommunicationsModule = makeRuntimeModuleByKey(
	'realtor_communications',
	'communications'
);

function workspaceContext(
	snapshot: ProfessionalWorldsSnapshot
): ProfessionalWorldsWorkspaceContextValue {
	return {
		activeView: 'professionTools',
		activeVerticalSlug: 'realtor',
		navigate: () => {},
		openClients: () => {},
		openProperties: () => {},
		openPipeline: () => {},
		pipelineFocusDealId: null,
		consumePipelineFocus: () => {},
		openCommunications: () => {},
		communicationsFocus: null,
		consumeCommunicationsFocus: () => {},
		openArtifacts: () => {},
		artifactsWorkspaceFocus: null,
		consumeArtifactsWorkspaceFocus: () => {},
		clientsWorkspaceFocus: null,
		consumeClientsWorkspaceFocus: () => {},
		propertiesWorkspaceFocus: null,
		consumePropertiesWorkspaceFocus: () => {},
		openShowings: () => {},
		showingsFocus: null,
		consumeShowingsFocus: () => {},
		openTasks: () => {},
		tasksFocus: null,
		consumeTasksFocus: () => {},
		openProfessionTool: () => {},
		professionToolFocusModuleKey: null,
		consumeProfessionToolFocus: () => {},
		snapshot,
		refresh: async () => {},
		reloadSnapshot: async () => {},
		saving: false,
		setSaving: () => {},
		selectedPropertyId: null,
		setSelectedPropertyId: () => {},
		selectedProperty: null,
		listingWorkspaceEnabled: true,
		activeRuntimeConfig: null,
		activeActivation: null,
		activeVertical: null,
		verticalAddonModules: [
			testRealtorPipelineModule,
			testRealtorCommunicationsModule,
		],
		resolvedPhotoPresets: [],
		mediaStudioEnabled: true,
		dealsModuleEnabled: true,
		preparedPresentationBrief: '',
		listingStream: { text: '', status: '' },
		brandStream: { text: '', status: '' },
		learningStream: { text: '', status: '' },
		setLaneText: () => {},
		setLaneStatus: () => {},
		addArtifactToSnapshot: () => {},
		patchSnapshot: () => {},
		copyLane: async () => {},
		patchOnboarding: async () => {},
		embeddedMobileLayout: false,
	};
}

function renderLeadsPanel(
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openCommunications?: PwCtx['openCommunications'];
		verticalAddonModules?: ProfessionalWorldsWorkspaceContextValue['verticalAddonModules'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openCommunications = options?.openCommunications ?? vi.fn();
	return {
		openPipeline,
		openCommunications,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openCommunications,
					verticalAddonModules:
						options?.verticalAddonModules ??
						workspaceContext(props.snapshot).verticalAddonModules,
				}}
			>
				<LeadsPanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderTasksPanel(
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openClients?: PwCtx['openClients'];
		openCommunications?: PwCtx['openCommunications'];
		verticalAddonModules?: ProfessionalWorldsWorkspaceContextValue['verticalAddonModules'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openClients = options?.openClients ?? vi.fn();
	const openCommunications = options?.openCommunications ?? vi.fn();
	return {
		openPipeline,
		openClients,
		openCommunications,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openClients,
					openCommunications,
					verticalAddonModules:
						options?.verticalAddonModules ??
						workspaceContext(props.snapshot).verticalAddonModules,
				}}
			>
				<TasksPanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderShowingsPanel(
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openClients?: PwCtx['openClients'];
		openProperties?: PwCtx['openProperties'];
		openCommunications?: PwCtx['openCommunications'];
		selectedPropertyId?: string | null;
		setSelectedPropertyId?: PwCtx['setSelectedPropertyId'];
		verticalAddonModules?: ProfessionalWorldsWorkspaceContextValue['verticalAddonModules'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openClients = options?.openClients ?? vi.fn();
	const openProperties = options?.openProperties ?? vi.fn();
	const openCommunications = options?.openCommunications ?? vi.fn();
	return {
		openPipeline,
		openClients,
		openProperties,
		openCommunications,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openClients,
					openProperties,
					openCommunications,
					selectedPropertyId: options?.selectedPropertyId ?? null,
					setSelectedPropertyId: options?.setSelectedPropertyId ?? vi.fn(),
					verticalAddonModules:
						options?.verticalAddonModules ??
						workspaceContext(props.snapshot).verticalAddonModules,
				}}
			>
				<ShowingsCalendarPanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderDocumentsPanel(
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openClients?: PwCtx['openClients'];
		openProperties?: PwCtx['openProperties'];
		openCommunications?: PwCtx['openCommunications'];
		selectedPropertyId?: string | null;
		setSelectedPropertyId?: PwCtx['setSelectedPropertyId'];
		verticalAddonModules?: ProfessionalWorldsWorkspaceContextValue['verticalAddonModules'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openClients = options?.openClients ?? vi.fn();
	const openProperties = options?.openProperties ?? vi.fn();
	const openCommunications = options?.openCommunications ?? vi.fn();
	return {
		openPipeline,
		openClients,
		openProperties,
		openCommunications,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openClients,
					openProperties,
					openCommunications,
					selectedPropertyId: options?.selectedPropertyId ?? null,
					setSelectedPropertyId: options?.setSelectedPropertyId ?? vi.fn(),
					verticalAddonModules:
						options?.verticalAddonModules ??
						workspaceContext(props.snapshot).verticalAddonModules,
				}}
			>
				<DocumentsPanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderCommunicationTimelinePanel(
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openClients?: PwCtx['openClients'];
		openProperties?: PwCtx['openProperties'];
		openProfessionTool?: PwCtx['openProfessionTool'];
		communicationsFocus?: ProfessionalWorldsWorkspaceContextValue['communicationsFocus'];
		consumeCommunicationsFocus?: PwCtx['consumeCommunicationsFocus'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openClients = options?.openClients ?? vi.fn();
	const openProperties = options?.openProperties ?? vi.fn();
	const openProfessionTool = options?.openProfessionTool ?? vi.fn();
	const consumeCommunicationsFocus =
		options?.consumeCommunicationsFocus ?? vi.fn();
	return {
		openPipeline,
		openClients,
		openProperties,
		openProfessionTool,
		consumeCommunicationsFocus,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openClients,
					openProperties,
					openProfessionTool,
					communicationsFocus: options?.communicationsFocus ?? null,
					consumeCommunicationsFocus,
				}}
			>
				<CommunicationTimelinePanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderObjectionLibraryPanel(
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openCommunications?: PwCtx['openCommunications'];
		verticalAddonModules?: ProfessionalWorldsWorkspaceContextValue['verticalAddonModules'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openCommunications = options?.openCommunications ?? vi.fn();
	return {
		openPipeline,
		openCommunications,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openCommunications,
					verticalAddonModules:
						options?.verticalAddonModules ??
						workspaceContext(props.snapshot).verticalAddonModules,
				}}
			>
				<ObjectionLibraryPanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderClientsPanel(
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openClients?: PwCtx['openClients'];
		openProperties?: PwCtx['openProperties'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openClients = options?.openClients ?? vi.fn();
	const openProperties = options?.openProperties ?? vi.fn();
	return {
		openPipeline,
		openClients,
		openProperties,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openClients,
					openProperties,
				}}
			>
				<ClientsPanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderSellerOnboardingPanel(
	props: RuntimeModulePanelProps,
	options?: { openClients?: PwCtx['openClients'] }
) {
	const openClients = options?.openClients ?? vi.fn();
	return {
		openClients,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openClients,
				}}
			>
				<SellerOnboardingPanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderListingCrmPanel(
	Panel: typeof InsightsPanel | typeof MarketingCampaignPanel,
	props: RuntimeModulePanelProps,
	options?: {
		openPipeline?: PwCtx['openPipeline'];
		openClients?: PwCtx['openClients'];
		openProperties?: PwCtx['openProperties'];
		openCommunications?: PwCtx['openCommunications'];
		verticalAddonModules?: ProfessionalWorldsWorkspaceContextValue['verticalAddonModules'];
	}
) {
	const openPipeline = options?.openPipeline ?? vi.fn();
	const openClients = options?.openClients ?? vi.fn();
	const openProperties = options?.openProperties ?? vi.fn();
	const openCommunications = options?.openCommunications ?? vi.fn();
	return {
		openPipeline,
		openClients,
		openProperties,
		openCommunications,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openPipeline,
					openClients,
					openProperties,
					openCommunications,
					verticalAddonModules:
						options?.verticalAddonModules ??
						workspaceContext(props.snapshot).verticalAddonModules,
				}}
			>
				<Panel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

function renderDealsPipelinePanel(
	props: RuntimeModulePanelProps,
	options?: {
		openClients?: PwCtx['openClients'];
		openProperties?: PwCtx['openProperties'];
		openCommunications?: PwCtx['openCommunications'];
		patchSnapshot?: PwCtx['patchSnapshot'];
		pipelineFocusDealId?: string | null;
		consumePipelineFocus?: PwCtx['consumePipelineFocus'];
		verticalAddonModules?: ProfessionalWorldsWorkspaceContextValue['verticalAddonModules'];
	}
) {
	const openClients = options?.openClients ?? vi.fn();
	const openProperties = options?.openProperties ?? vi.fn();
	const openCommunications = options?.openCommunications ?? vi.fn();
	const patchSnapshot = options?.patchSnapshot ?? vi.fn();
	const consumePipelineFocus = options?.consumePipelineFocus ?? vi.fn();
	const pipelineFocusDealId = options?.pipelineFocusDealId ?? null;
	return {
		openClients,
		openProperties,
		openCommunications,
		patchSnapshot,
		consumePipelineFocus,
		...renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(props.snapshot),
					openClients,
					openProperties,
					openCommunications,
					patchSnapshot,
					pipelineFocusDealId,
					consumePipelineFocus,
					verticalAddonModules:
						options?.verticalAddonModules ??
						workspaceContext(props.snapshot).verticalAddonModules,
				}}
			>
				<DealsPipelinePanel {...props} />
			</ProfessionalWorldsWorkspaceProvider>
		),
	};
}

describe('RealtorProPanels', () => {
	it('LeadsPanel toggles kanban and list', async () => {
		renderLeadsPanel(baseProps());
		await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: 'List' }));
		expect(screen.getAllByText('Alpha').length).toBeGreaterThanOrEqual(1);
		fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));
		expect(screen.getByText('New')).toBeInTheDocument();
	});

	it('LeadsPanel logs communication when module enabled', async () => {
		const openCommunications = vi.fn();
		renderLeadsPanel(baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Log communication' })[0]
		);
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'lead',
			relatedId: 'l1',
		});
	});

	it('LeadsPanel offers open pipeline after convert when module enabled', async () => {
		vi.mocked(convertRealtorLeadToClient).mockResolvedValueOnce({
			lead: {
				id: 'l1',
				user_id: 'u1',
				vertical_slug: 'realtor',
				name: 'Alpha',
				status: 'converted',
				source: 'site',
				contact: 'a@example.com',
				notes: '',
				converted_client_id: 'c-new',
				lead_data: {},
				created_at: '',
				updated_at: '',
			},
			client: {
				id: 'c-new',
				user_id: 'u1',
				vertical_slug: 'realtor',
				name: 'Alpha',
				contact: '',
				need_summary: null,
				emotional_motive: null,
				status: 'lead',
				budget_from: null,
				budget_to: null,
				preferred_areas: [],
				next_action: null,
				created_at: '',
				updated_at: '',
			},
		});
		const { openPipeline } = renderLeadsPanel(baseProps(), {
			openPipeline: vi.fn(),
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_pipeline', 'pipeline'),
			],
		});
		await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Create client profile' })[0]
		);
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Open deals' })).toBeTruthy()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Open deals' }));
		expect(openPipeline).toHaveBeenCalledWith();
	});

	it('DealsPipelinePanel lists stages and prefers first deal for timeline', () => {
		renderDealsPipelinePanel(baseProps());
		expect(screen.getByText('offer')).toBeInTheDocument();
		expect(screen.getByText('closing')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Late closing/i }));
		expect(
			screen.getByText(/Stage timeline: Late closing/i)
		).toBeInTheDocument();
	});

	it('DealsPipelinePanel offers create-deal CTA for unlinked listings', () => {
		const { openClients } = renderDealsPipelinePanel(baseProps());
		fireEvent.click(screen.getByRole('button', { name: 'Create deal' }));
		expect(openClients).toHaveBeenCalledWith({
			tab: 'capture',
			linkedPropertyId: 'p1',
		});
	});

	it('DealsPipelinePanel updates stage and deep-links client or listing', async () => {
		const updatedDeal: ProfessionalDeal = {
			id: 'deal-linked',
			user_id: 'u1',
			vertical_slug: 'realtor',
			client_id: 'c1',
			title: 'Linked deal',
			stage: 'negotiation',
			amount: null,
			next_action: 'Follow up',
			deal_data: { property_id: 'p1' },
			created_at: '',
			updated_at: '',
		};
		vi.mocked(updateProfessionalDeal).mockResolvedValueOnce(updatedDeal);
		const patchSnapshot = vi.fn();
		const openClients = vi.fn();
		const openProperties = vi.fn();
		const props = baseProps({
			snapshot: {
				...baseProps().snapshot,
				deals: [updatedDeal],
			},
		});
		renderDealsPipelinePanel(props, {
			openClients,
			openProperties,
			patchSnapshot,
		});
		fireEvent.change(screen.getByLabelText('Stage'), {
			target: { value: 'negotiation' },
		});
		await waitFor(() =>
			expect(updateProfessionalDeal).toHaveBeenCalledWith('deal-linked', {
				stage: 'negotiation',
			})
		);
		expect(patchSnapshot).toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Open client deals' }));
		expect(openClients).toHaveBeenCalledWith({
			tab: 'directory',
			filterClientId: 'c1',
		});
		fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
		expect(openProperties).toHaveBeenCalledWith({ propertyId: 'p1' });
	});

	it('DealsPipelinePanel focuses deal from pipelineFocusDealId', () => {
		const consumePipelineFocus = vi.fn();
		renderDealsPipelinePanel(baseProps(), {
			pipelineFocusDealId: 'deal-late',
			consumePipelineFocus,
		});
		expect(
			screen.getByText(/Stage timeline: Late closing/i)
		).toBeInTheDocument();
		expect(consumePipelineFocus).toHaveBeenCalled();
	});

	it('DealsPipelinePanel logs communication for selected deal', () => {
		const openCommunications = vi.fn();
		renderDealsPipelinePanel(baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		fireEvent.click(screen.getByRole('button', { name: 'Log communication' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'deal',
			relatedId: 'deal-early',
		});
	});

	it('TasksPanel groups next actions from deals and clients', () => {
		renderTasksPanel(baseProps());
		expect(screen.getByText('Send draft')).toBeInTheDocument();
		expect(screen.getByText('Call')).toBeInTheDocument();
	});

	it('TasksPanel applies workspace tasks focus to new-task draft', () => {
		const consumeTasksFocus = vi.fn();
		const setSelectedPropertyId = vi.fn();
		renderWithPwLocales(
			<ProfessionalWorldsWorkspaceProvider
				value={{
					...workspaceContext(baseProps().snapshot),
					tasksFocus: {
						draftTitle: 'Schedule buyer call',
						propertyId: 'p1',
						clientId: 'c1',
						dealId: 'd1',
					},
					consumeTasksFocus,
					setSelectedPropertyId,
				}}
			>
				<TasksPanel {...baseProps()} />
			</ProfessionalWorldsWorkspaceProvider>
		);
		expect(screen.getByDisplayValue('Schedule buyer call')).toBeInTheDocument();
		expect(setSelectedPropertyId).toHaveBeenCalledWith('p1');
		expect(consumeTasksFocus).toHaveBeenCalled();
	});

	it('TasksPanel deep-links CRM suggested follow-ups', () => {
		const openPipeline = vi.fn();
		const openClients = vi.fn();
		renderTasksPanel(baseProps(), { openPipeline, openClients });
		fireEvent.click(screen.getAllByRole('button', { name: 'Open deal' })[0]);
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'deal-early' });
		fireEvent.click(screen.getByRole('button', { name: 'Open client' }));
		expect(openClients).toHaveBeenCalledWith({
			tab: 'directory',
			filterClientId: 'c1',
		});
	});

	it('TasksPanel logs communication for CRM suggested follow-ups', () => {
		const openCommunications = vi.fn();
		renderTasksPanel(baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Log communication' })[0]
		);
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'deal',
			relatedId: 'deal-early',
		});
	});

	it('TasksPanel logs communication for scheduled tasks with deal link', async () => {
		const openCommunications = vi.fn();
		vi.mocked(listRealtorTasks).mockResolvedValueOnce([
			{
				id: 'task-linked',
				user_id: 'u1',
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
				deal_id: 'deal-early',
				task_meta: {},
				created_at: '',
				updated_at: '',
			},
		]);
		renderTasksPanel(baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		await waitFor(() =>
			expect(screen.getByText('Call buyer')).toBeInTheDocument()
		);
		const taskRow = screen.getByText('Call buyer').closest('article');
		expect(taskRow).toBeTruthy();
		fireEvent.click(
			within(taskRow as HTMLElement).getByRole('button', {
				name: 'Log communication',
			})
		);
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'deal',
			relatedId: 'deal-early',
		});
	});

	it('ShowingsCalendarPanel deep-links CRM entities and auto-links deal on create', async () => {
		const openPipeline = vi.fn();
		const openClients = vi.fn();
		const openProperties = vi.fn();
		const snapshot = {
			...baseProps().snapshot,
			deals: [
				...baseProps().snapshot.deals,
				{
					id: 'deal-show',
					user_id: 'u1',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Buyer showing deal',
					stage: 'showing',
					amount: null,
					next_action: 'Meet',
					deal_data: { property_id: 'p1' },
					created_at: '',
					updated_at: '',
				},
			],
		};
		renderShowingsPanel(
			{ ...baseProps(), snapshot },
			{ openPipeline, openClients, openProperties }
		);
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Open listing' })).toBeTruthy()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
		expect(openProperties).toHaveBeenCalledWith({ propertyId: 'p1' });
		fireEvent.click(screen.getByRole('button', { name: 'Open client' }));
		expect(openClients).toHaveBeenCalledWith({
			tab: 'directory',
			filterClientId: 'c1',
		});
		fireEvent.click(screen.getByRole('button', { name: 'Open deal' }));
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'deal-show' });
	});

	it('ShowingsCalendarPanel logs communication with deal-first focus', async () => {
		const openCommunications = vi.fn();
		const snapshot = {
			...baseProps().snapshot,
			deals: [
				...baseProps().snapshot.deals,
				{
					id: 'deal-show',
					user_id: 'u1',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Buyer showing deal',
					stage: 'showing',
					amount: null,
					next_action: 'Meet',
					deal_data: { property_id: 'p1' },
					created_at: '',
					updated_at: '',
				},
			],
		};
		renderShowingsPanel(
			{ ...baseProps(), snapshot },
			{
				openCommunications,
				verticalAddonModules: [
					makeRuntimeModuleByKey('realtor_communications', 'communications'),
				],
			}
		);
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Log communication' })
			).toBeTruthy()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Log communication' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'deal',
			relatedId: 'deal-show',
		});
	});

	it('ClientsPanel segments buyers vs sellers', async () => {
		renderClientsPanel(baseProps());
		expect(screen.getAllByText('Buyer One').length).toBeGreaterThan(0);
		fireEvent.change(screen.getByLabelText('Client segment'), {
			target: { value: 'seller' },
		});
		await waitFor(() =>
			expect(screen.getByText('Seller One')).toBeInTheDocument()
		);
	});

	it('ClientsPanel matcher deep-links listing client and deal', async () => {
		const openPipeline = vi.fn();
		const openClients = vi.fn();
		const openProperties = vi.fn();
		const snapshot = {
			...baseProps().snapshot,
			deals: [
				...baseProps().snapshot.deals,
				{
					id: 'deal-buyer-match',
					user_id: 'u1',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Buyer match deal',
					stage: 'showing',
					amount: null,
					next_action: null,
					deal_data: { property_id: 'p1' },
					created_at: '',
					updated_at: '',
				},
			],
		};
		renderClientsPanel(
			{ ...baseProps(), snapshot },
			{ openPipeline, openClients, openProperties }
		);
		await waitFor(() =>
			expect(screen.getByText(/Center buyer/)).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
		expect(openProperties).toHaveBeenCalledWith({ propertyId: 'p1' });
		fireEvent.click(screen.getByRole('button', { name: 'Open client' }));
		expect(openClients).toHaveBeenCalledWith({
			tab: 'directory',
			filterClientId: 'c1',
		});
		fireEvent.click(screen.getByRole('button', { name: 'Open deal' }));
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'deal-buyer-match' });
	});

	it('SellerOnboardingPanel links seller clients to Clients workspace', async () => {
		const openClients = vi.fn();
		renderSellerOnboardingPanel(baseProps(), { openClients });
		await waitFor(() =>
			expect(screen.getByText('Seller clients')).toBeInTheDocument()
		);
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Open in Clients' })[0]
		);
		expect(openClients).toHaveBeenCalledWith({
			tab: 'directory',
			filterClientId: 'c2',
		});
	});

	it('DocumentsPanel shows checklist state for selected property', async () => {
		renderDocumentsPanel(baseProps());
		await waitFor(() =>
			expect(screen.getByText('Passport')).toBeInTheDocument()
		);
		expect(screen.getByText(/verified/i)).toBeInTheDocument();
	});

	it('DocumentsPanel renders custom document types as human labels', async () => {
		vi.mocked(listRealtorDocuments).mockResolvedValueOnce([
			{
				id: 'd-custom',
				user_id: 'u1',
				property_id: 'p1',
				title: 'Developer package',
				doc_type: 'developer_dossier',
				checklist_state: {},
				unified_content_id: null,
				created_at: '',
				updated_at: '',
			},
		]);

		renderDocumentsPanel(baseProps());

		await waitFor(() =>
			expect(screen.getByText('Developer package')).toBeInTheDocument()
		);
		expect(
			screen.getByText(/Other option: developer dossier/)
		).toBeInTheDocument();
		expect(screen.queryByText(/developer_dossier/)).not.toBeInTheDocument();
	});

	it('DocumentsPanel starts from workspace selected property', async () => {
		const props = baseProps();
		const baseProperty = props.snapshot.properties[0];
		if (!baseProperty) {
			throw new Error('base property missing');
		}
		const snapshot = {
			...props.snapshot,
			properties: [
				...props.snapshot.properties,
				{
					...baseProperty,
					id: 'p2',
					title: 'Hill View',
				},
			],
		};
		renderDocumentsPanel({ ...props, snapshot }, { selectedPropertyId: 'p2' });

		await waitFor(() =>
			expect(listRealtorDocuments).toHaveBeenLastCalledWith({
				propertyId: 'p2',
			})
		);
		expect(screen.getByDisplayValue('Hill View')).toBeInTheDocument();
	});

	it('DocumentsPanel deep-links listing and deal when unique match exists', async () => {
		const openPipeline = vi.fn();
		const openClients = vi.fn();
		const openProperties = vi.fn();
		const snapshot = {
			...baseProps().snapshot,
			deals: [
				...baseProps().snapshot.deals,
				{
					id: 'deal-docs',
					user_id: 'u1',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Sea View docs deal',
					stage: 'offer',
					amount: null,
					next_action: null,
					deal_data: { property_id: 'p1' },
					created_at: '',
					updated_at: '',
				},
			],
		};
		renderDocumentsPanel(
			{ ...baseProps(), snapshot },
			{ openPipeline, openClients, openProperties }
		);
		await waitFor(() =>
			expect(screen.getByText('Passport')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
		expect(openProperties).toHaveBeenCalledWith({ propertyId: 'p1' });
		fireEvent.click(screen.getAllByRole('button', { name: 'Open deal' })[0]);
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'deal-docs' });
	});

	it('DocumentsPanel logs communication via listing CRM bridge', async () => {
		const openCommunications = vi.fn();
		renderDocumentsPanel(baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		await waitFor(() =>
			expect(screen.getByText('Passport')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Log communication' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'property',
			relatedId: 'p1',
		});
	});

	it('CommunicationTimelinePanel deep-links deal logs to pipeline', async () => {
		const openPipeline = vi.fn();
		renderCommunicationTimelinePanel(baseProps(), { openPipeline });
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Open deal' })).toBeTruthy()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Open deal' }));
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'deal-early' });
	});

	it('CommunicationTimelinePanel renders custom related types and channels as human labels', async () => {
		vi.mocked(listRealtorCommunicationLogs).mockResolvedValueOnce([
			{
				id: 'log-custom',
				user_id: 'u1',
				related_type: 'investor_portal',
				related_id: 'custom-1',
				channel: 'partner_chat',
				body: 'Asked for investment summary',
				meta: {},
				created_at: '',
			},
		]);

		renderCommunicationTimelinePanel(baseProps());

		await waitFor(() =>
			expect(screen.getByText('Other option: partner chat')).toBeInTheDocument()
		);
		expect(
			screen.getByText(/Other option: investor portal/)
		).toBeInTheDocument();
		expect(screen.queryByText(/investor_portal/)).not.toBeInTheDocument();
	});

	it('CommunicationTimelinePanel creates a log via quick capture form', async () => {
		renderCommunicationTimelinePanel(baseProps());
		fireEvent.change(screen.getByRole('textbox', { name: 'Channel' }), {
			target: { value: 'email' },
		});
		fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
			target: { value: 'Sent contract' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Add log' }));
		await waitFor(() =>
			expect(createRealtorCommunicationLog).toHaveBeenCalledWith({
				related_type: 'deal',
				related_id: 'deal-early',
				channel: 'email',
				body: 'Sent contract',
				meta: {},
			})
		);
		expect(screen.getByText('Communication logged.')).toBeInTheDocument();
	});

	it('CommunicationTimelinePanel pre-fills quick log from communicationsFocus', async () => {
		const consumeCommunicationsFocus = vi.fn();
		renderCommunicationTimelinePanel(baseProps(), {
			communicationsFocus: { relatedType: 'lead', relatedId: 'l1' },
			consumeCommunicationsFocus,
		});
		await waitFor(() =>
			expect(consumeCommunicationsFocus).toHaveBeenCalledTimes(1)
		);
		await waitFor(() =>
			expect(
				screen.getByRole('combobox', { name: 'Related record' })
			).toHaveValue('l1')
		);
	});

	it('ObjectionLibraryPanel links active deals to pipeline', async () => {
		const openPipeline = vi.fn();
		renderObjectionLibraryPanel(baseProps(), { openPipeline });
		await waitFor(() =>
			expect(screen.getByText('Practice with active deals')).toBeInTheDocument()
		);
		fireEvent.click(screen.getAllByRole('button', { name: 'Open deal' })[0]);
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'deal-late' });
	});

	it('ObjectionLibraryPanel logs communication for active deals', async () => {
		const openCommunications = vi.fn();
		renderObjectionLibraryPanel(baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		await waitFor(() =>
			expect(screen.getByText('Practice with active deals')).toBeInTheDocument()
		);
		const dealRow = screen.getByText('Late closing').closest('article');
		expect(dealRow).toBeTruthy();
		fireEvent.click(
			within(dealRow as HTMLElement).getByRole('button', {
				name: 'Log communication',
			})
		);
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'deal',
			relatedId: 'deal-late',
		});
	});

	it('ObjectionLibraryPanel upserts objection reply through typed API client', async () => {
		renderObjectionLibraryPanel(baseProps());
		await waitFor(() =>
			expect(screen.getByText('Save objection reply')).toBeInTheDocument()
		);
		fireEvent.change(screen.getByLabelText('Client situation'), {
			target: { value: 'price_too_high' },
		});
		fireEvent.change(screen.getByLabelText('Reply text'), {
			target: { value: 'Compare value with similar listings nearby.' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Save reply' }));
		await waitFor(() =>
			expect(upsertRealtorObjectionReply).toHaveBeenCalledWith(
				'price_too_high',
				{
					reply_text: 'Compare value with similar listings nearby.',
				}
			)
		);
		await waitFor(() =>
			expect(
				screen.getByText('Reply saved to your library.')
			).toBeInTheDocument()
		);
	});

	it('ObjectionLibraryPanel loads existing reply into edit form', async () => {
		vi.mocked(listRealtorObjectionReplies).mockResolvedValueOnce([
			{
				id: 'or-existing',
				user_id: 'u1',
				objection_key: 'need_time',
				reply_text: 'Take the time you need; I will follow up next week.',
				tags: ['timing'],
				created_at: '2026-05-27T09:00:00Z',
				updated_at: '2026-05-27T09:00:00Z',
			},
		]);
		renderObjectionLibraryPanel(baseProps());
		await waitFor(() =>
			expect(screen.getByText('Needs time to think')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(screen.getByLabelText('Client situation')).toHaveValue('need_time');
		expect(screen.getByLabelText('Reply text')).toHaveValue(
			'Take the time you need; I will follow up next week.'
		);
		expect(screen.getByLabelText('Tags (optional)')).toHaveValue('timing');
	});

	it('InsightsPanel renders listing quality score and CRM bridge', async () => {
		const openProperties = vi.fn();
		renderListingCrmPanel(InsightsPanel, baseProps(), { openProperties });
		await waitFor(() => expect(screen.getByText('77%')).toBeInTheDocument());
		expect(screen.getByText(/photos/i)).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
		expect(openProperties).toHaveBeenCalledWith({ propertyId: 'p1' });
	});

	it('InsightsPanel logs communication for selected listing', async () => {
		const openCommunications = vi.fn();
		renderListingCrmPanel(InsightsPanel, baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		await waitFor(() => expect(screen.getByText('77%')).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: 'Log communication' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'property',
			relatedId: 'p1',
		});
	});

	it('MarketingCampaignPanel lists campaigns and deep-links listing', async () => {
		const openProperties = vi.fn();
		const openPipeline = vi.fn();
		const snapshot = {
			...baseProps().snapshot,
			deals: [
				...baseProps().snapshot.deals,
				{
					id: 'deal-marketing',
					user_id: 'u1',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Sea View marketing deal',
					stage: 'negotiation',
					amount: null,
					next_action: null,
					deal_data: { property_id: 'p1' },
					created_at: '',
					updated_at: '',
				},
			],
		};
		renderListingCrmPanel(
			MarketingCampaignPanel,
			{ ...baseProps(), snapshot },
			{ openProperties, openPipeline }
		);
		await waitFor(() =>
			expect(screen.getByText('Spring launch')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
		expect(openProperties).toHaveBeenCalledWith({ propertyId: 'p1' });
		fireEvent.click(screen.getByRole('button', { name: 'Open deal' }));
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'deal-marketing' });
	});

	it('MarketingCampaignPanel logs communication for selected listing', async () => {
		const openCommunications = vi.fn();
		renderListingCrmPanel(MarketingCampaignPanel, baseProps(), {
			openCommunications,
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
			],
		});
		await waitFor(() =>
			expect(screen.getByText('Spring launch')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Log communication' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'property',
			relatedId: 'p1',
		});
	});

	it('MarketingCampaignPanel loads publication channels and upserts a channel', async () => {
		renderListingCrmPanel(MarketingCampaignPanel, baseProps());
		await waitFor(() =>
			expect(listRealtorPublicationChannels).toHaveBeenCalledWith('p1')
		);
		expect(screen.getByText('Publication channels')).toBeInTheDocument();
		expect(
			screen.getByRole('combobox', { name: 'Status for vk' })
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Add channel' }));
		await waitFor(() =>
			expect(upsertRealtorPublicationChannel).toHaveBeenCalledWith('p1', {
				channel_key: 'vk',
				status: 'pending',
			})
		);
	});

	it('MarketingCampaignPanel renders custom publication channels as human labels', async () => {
		vi.mocked(listRealtorPublicationChannels).mockResolvedValueOnce([
			{
				id: 'pc-custom',
				user_id: 'u1',
				property_id: 'p1',
				channel_key: 'developer_portal',
				status: 'pending',
				meta: {},
				created_at: '',
				updated_at: '',
			},
		]);

		renderListingCrmPanel(MarketingCampaignPanel, baseProps());

		await waitFor(() =>
			expect(
				screen.getByText('Other channel: developer portal')
			).toBeInTheDocument()
		);
		expect(screen.queryByText(/developer_portal/)).not.toBeInTheDocument();
	});

	it('MarketingCampaignPanel patches publication channel status', async () => {
		renderListingCrmPanel(MarketingCampaignPanel, baseProps());
		await waitFor(() =>
			expect(
				screen.getByRole('combobox', { name: 'Status for vk' })
			).toBeInTheDocument()
		);
		const statusSelect = screen.getByRole('combobox', {
			name: 'Status for vk',
		});
		fireEvent.change(statusSelect, { target: { value: 'published' } });
		await waitFor(() =>
			expect(patchRealtorPublicationChannel).toHaveBeenCalledWith('pc1', {
				status: 'published',
			})
		);
	});

	it('ClientsPanel creates a buyer requirement from the form', async () => {
		renderClientsPanel(baseProps());
		await waitFor(() =>
			expect(screen.getByText(/Center buyer/)).toBeInTheDocument()
		);
		fireEvent.change(screen.getByLabelText('Requirement title'), {
			target: { value: 'Loft hunter' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Save requirement' }));
		await waitFor(() =>
			expect(createRealtorBuyerRequirement).toHaveBeenCalledWith({
				title: 'Loft hunter',
			})
		);
	});

	it('DocumentsPanel creates a checklist row for the selected listing', async () => {
		renderListingCrmPanel(DocumentsPanel, baseProps());
		await waitFor(() =>
			expect(screen.getByText('Passport')).toBeInTheDocument()
		);
		fireEvent.change(screen.getByLabelText('Document title'), {
			target: { value: 'Contract draft' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Save document' }));
		await waitFor(() =>
			expect(createRealtorDocument).toHaveBeenCalledWith({
				title: 'Contract draft',
				property_id: 'p1',
				doc_type: 'other',
			})
		);
	});

	it('MarketingCampaignPanel creates a campaign for the selected listing', async () => {
		renderListingCrmPanel(MarketingCampaignPanel, baseProps());
		await waitFor(() =>
			expect(screen.getByText('Spring launch')).toBeInTheDocument()
		);
		fireEvent.change(screen.getByLabelText('Campaign title'), {
			target: { value: 'Summer push' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Save campaign' }));
		await waitFor(() =>
			expect(createRealtorMarketingCampaign).toHaveBeenCalledWith({
				title: 'Summer push',
				property_id: 'p1',
				status: 'draft',
			})
		);
	});

	it('DocumentsPanel updates an existing checklist row from edit mode', async () => {
		renderListingCrmPanel(DocumentsPanel, baseProps());
		await waitFor(() =>
			expect(screen.getByText('Passport')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(screen.getByText('Edit checklist row')).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText('Document title'), {
			target: { value: 'Passport copy' },
		});
		fireEvent.change(screen.getByLabelText('Document type'), {
			target: { value: 'contract' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() =>
			expect(updateRealtorDocument).toHaveBeenCalledWith('d1', {
				title: 'Passport copy',
				doc_type: 'contract',
			})
		);
	});

	it('MarketingCampaignPanel updates an existing campaign from edit mode', async () => {
		renderListingCrmPanel(MarketingCampaignPanel, baseProps());
		await waitFor(() =>
			expect(screen.getByText('Spring launch')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(screen.getByText('Edit campaign')).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText('Campaign title'), {
			target: { value: 'Spring relaunch' },
		});
		fireEvent.change(screen.getByLabelText('Status'), {
			target: { value: 'active' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() =>
			expect(updateRealtorMarketingCampaign).toHaveBeenCalledWith('mc1', {
				title: 'Spring relaunch',
				status: 'active',
			})
		);
	});

	it('DealsPipelinePanel appends a timeline event for the selected deal', async () => {
		renderDealsPipelinePanel(baseProps());
		fireEvent.change(screen.getByLabelText('Timeline stage'), {
			target: { value: 'negotiation' },
		});
		fireEvent.change(screen.getByLabelText('Note'), {
			target: { value: 'Client ready' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Add timeline event' }));
		await waitFor(() =>
			expect(appendRealtorDealEvent).toHaveBeenCalledWith('deal-early', {
				stage_from: 'offer',
				stage_to: 'negotiation',
				note: 'Client ready',
			})
		);
	});

	describe('delete confirm modal', () => {
		it('ShowingsCalendarPanel opens confirm modal before delete API', async () => {
			vi.mocked(deleteRealtorShowing).mockClear();
			renderShowingsPanel(baseProps());
			await waitFor(() =>
				expect(
					screen.getByRole('button', { name: 'Remove showing' })
				).toBeInTheDocument()
			);

			fireEvent.click(screen.getByRole('button', { name: 'Remove showing' }));

			await waitFor(() => {
				expect(
					screen.getByText(/This removes the showing from your calendar/)
				).toBeInTheDocument();
				expect(
					screen.getAllByRole('button', { name: 'Remove showing' }).length
				).toBe(2);
				expect(deleteRealtorShowing).not.toHaveBeenCalled();
			});

			const confirmShowingButtons = screen.getAllByRole('button', {
				name: 'Remove showing',
			});
			expect(confirmShowingButtons.length).toBeGreaterThanOrEqual(2);
			fireEvent.click(confirmShowingButtons[confirmShowingButtons.length - 1]);

			await waitFor(() =>
				expect(deleteRealtorShowing).toHaveBeenCalledWith('s1')
			);
			expect(deleteRealtorShowing).toHaveBeenCalledTimes(1);
		});

		it('TasksPanel opens confirm modal before delete API', async () => {
			vi.mocked(deleteRealtorTask).mockClear();
			vi.mocked(listRealtorTasks).mockResolvedValue([
				{
					id: 'task-del',
					user_id: 'u1',
					title: 'Follow up buyer',
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
					created_at: '',
					updated_at: '',
				},
			]);
			renderTasksPanel(baseProps());
			await waitFor(() =>
				expect(screen.getByText('Follow up buyer')).toBeInTheDocument()
			);

			const taskRow = screen.getByText('Follow up buyer').closest('article');
			expect(taskRow).toBeTruthy();
			fireEvent.click(
				within(taskRow as HTMLElement).getByRole('button', {
					name: 'Remove task',
				})
			);

			await waitFor(() => {
				expect(
					screen.getByText(/This removes the task from your list/)
				).toBeInTheDocument();
				expect(
					screen.getAllByRole('button', { name: 'Remove task' }).length
				).toBe(2);
				expect(deleteRealtorTask).not.toHaveBeenCalled();
			});

			const confirmButtons = screen.getAllByRole('button', {
				name: 'Remove task',
			});
			expect(confirmButtons.length).toBeGreaterThanOrEqual(2);
			fireEvent.click(confirmButtons[confirmButtons.length - 1]);

			await waitFor(() =>
				expect(deleteRealtorTask).toHaveBeenCalledWith('task-del')
			);
			expect(deleteRealtorTask).toHaveBeenCalledTimes(1);
		});
	});
});
