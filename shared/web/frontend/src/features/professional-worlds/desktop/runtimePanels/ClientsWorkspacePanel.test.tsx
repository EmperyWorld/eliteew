/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for Clients workspace empty-state CRM bridge.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import type {
	ProfessionalClientCreate,
	ProfessionalDealCreate,
	ProfessionalWorldsSnapshot,
} from '../types';
import { makeRuntimeModuleByKey } from '../professionalWorldsTestFixtures';
import { ClientsWorkspacePanel } from './ClientsWorkspacePanel';

vi.mock('../ProfessionalToast', () => ({
	useProfessionalToasts: () => ({
		notifySuccess: vi.fn(),
		notifyApiError: vi.fn(),
	}),
}));

vi.mock('../api', () => ({
	updateProfessionalDeal: vi.fn(),
	deleteProfessionalClient: vi.fn(),
	deleteProfessionalDeal: vi.fn(),
}));

import {
	deleteProfessionalClient,
	deleteProfessionalDeal,
	updateProfessionalDeal,
} from '../api';
import { APIError } from '@/services/api/client';

const emptySnapshot = {
	verticals: [],
	runtimeConfig: null,
	runtimeConfigs: [],
	verticalActivations: [],
	profile: null,
	properties: [],
	clients: [],
	deals: [],
	courses: [],
	artifacts: [],
} satisfies ProfessionalWorldsSnapshot;

const clientDraft = {
	vertical_slug: 'realtor',
	name: '',
	contact: '',
	need_summary: '',
	budget_from: null,
	budget_to: null,
	preferred_areas: [],
	emotional_motive: '',
	next_action: '',
	status: 'lead',
} satisfies ProfessionalClientCreate;

const dealDraft = {
	vertical_slug: 'realtor',
	client_id: null,
	title: '',
	stage: 'new',
	amount: null,
	next_action: '',
	deal_data: {},
} satisfies ProfessionalDealCreate;

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

describe('ClientsWorkspacePanel', () => {
	it('shows user-facing intro leads on capture and directory tabs', () => {
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: emptySnapshot,
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
			verticalAddonModules: [],
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={emptySnapshot}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		expect(
			screen.getByText(/Capture the first client relationship/i)
		).toBeInTheDocument();
		expect(screen.getByText(/Manual outreach only/i)).toBeInTheDocument();
		expect(
			screen.getByText(
				/Link the deal to a client and describe the next concrete step/i
			)
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		expect(
			screen.getByRole('button', { name: 'Capture client' })
		).toBeInTheDocument();
		expect(
			screen.getByText('0 client(s), 0 deal(s) in your workspace.')
		).toBeInTheDocument();
	});

	it('offers Leads deep link when directory is empty and realtor_leads is enabled', () => {
		const openProfessionTool = vi.fn();
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool,
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: emptySnapshot,
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
			verticalAddonModules: [makeRuntimeModuleByKey('realtor_leads', 'leads')],
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={emptySnapshot}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		fireEvent.click(screen.getByRole('button', { name: 'Open client leads' }));
		expect(openProfessionTool).toHaveBeenCalledWith('realtor_leads');
	});

	it('applies clients workspace focus tab and consumes the token', () => {
		const consumeClientsWorkspaceFocus = vi.fn();
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: { tab: 'directory' as const },
			consumeClientsWorkspaceFocus,
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: {
				...emptySnapshot,
				clients: [
					{
						id: 'c1',
						user_id: 'u1',
						vertical_slug: 'realtor',
						name: 'Anna',
						contact: '',
						need_summary: '',
						budget_from: null,
						budget_to: null,
						preferred_areas: [],
						emotional_motive: '',
						next_action: '',
						status: 'lead',
						created_at: '',
						updated_at: '',
					},
				],
			},
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
			verticalAddonModules: [],
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={value.snapshot}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		expect(
			screen.getByRole('tab', { name: 'Clients & deals', selected: true })
		).toBeTruthy();
		expect(consumeClientsWorkspaceFocus).toHaveBeenCalled();
	});

	it('selects client for deal capture when use-for-deal is clicked', () => {
		const setDealDraft = vi.fn();
		const snapshotWithClient = {
			...emptySnapshot,
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithClient,
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
			verticalAddonModules: [],
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithClient}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={setDealDraft}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		fireEvent.click(screen.getByRole('button', { name: 'Use for new deal →' }));
		expect(setDealDraft).toHaveBeenCalled();
		const updater = setDealDraft.mock.calls.at(-1)?.[0];
		expect(typeof updater).toBe('function');
		expect(updater(dealDraft).client_id).toBe('c1');
		expect(
			screen.getByRole('tab', { name: 'Lead capture', selected: true })
		).toBeTruthy();
	});

	it('filters deals directory when a client row is selected', () => {
		const snapshotWithCrm = {
			...emptySnapshot,
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
				{
					id: 'c2',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Boris',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Anna showing',
					stage: 'showing',
					amount: null,
					next_action: 'Call',
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
				{
					id: 'd2',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c2',
					title: 'Boris offer',
					stage: 'negotiation',
					amount: null,
					next_action: 'Review',
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
			],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithCrm,
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
			verticalAddonModules: [],
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithCrm}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		fireEvent.click(screen.getByRole('button', { name: /Anna/ }));
		expect(screen.getByText('Anna showing')).toBeTruthy();
		expect(screen.queryByText('Boris offer')).toBeNull();
	});

	it('deep-links deal rows to pipeline and listing', () => {
		const openPipeline = vi.fn();
		const openProperties = vi.fn();
		const openCommunications = vi.fn();
		const snapshotWithLinkedDeal = {
			...emptySnapshot,
			properties: [
				{
					id: 'p1',
					user_id: 'u',
					title: 'Sea View',
					property_type: 'flat',
					deal_type: 'sale',
					city: 'Vladivostok',
					district: 'Center',
					address: null,
					price: '1',
					area_m2: '50',
					rooms: 2,
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
			],
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Anna offer',
					stage: 'negotiation',
					amount: null,
					next_action: 'Call',
					deal_data: { property_id: 'p1' },
					created_at: '',
					updated_at: '',
				},
			],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties,
			openPipeline,
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications,
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithLinkedDeal,
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
				makeRuntimeModuleByKey('realtor_pipeline', 'pipeline'),
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithLinkedDeal}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		fireEvent.click(screen.getByRole('button', { name: 'Open in deals' }));
		expect(openPipeline).toHaveBeenCalledWith({ dealId: 'd1' });
		fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
		expect(openProperties).toHaveBeenCalledWith({ propertyId: 'p1' });
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Log communication' })[1]
		);
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'deal',
			relatedId: 'd1',
		});
	});

	it('logs communication from client directory row', () => {
		const openCommunications = vi.fn();
		const snapshotWithClient = {
			...emptySnapshot,
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications,
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithClient,
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
				makeRuntimeModuleByKey('realtor_communications', 'communications'),
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithClient}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		fireEvent.click(screen.getByRole('button', { name: 'Log communication' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'client',
			relatedId: 'c1',
		});
	});

	it('clears client filter from deals directory', () => {
		const snapshotWithCrm = {
			...emptySnapshot,
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Anna showing',
					stage: 'showing',
					amount: null,
					next_action: 'Call',
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
			],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: { filterClientId: 'c1' },
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithCrm,
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
			verticalAddonModules: [],
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
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithCrm}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		expect(screen.getByText('Anna showing')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
		expect(screen.getByText('Anna showing')).toBeTruthy();
	});

	it('updates deal stage from directory without full refresh', async () => {
		const patchSnapshot = vi.fn();
		const updatedDeal = {
			id: 'd1',
			user_id: 'u',
			vertical_slug: 'realtor',
			client_id: 'c1',
			title: 'Anna showing',
			stage: 'negotiation',
			amount: null,
			next_action: 'Call',
			deal_data: {},
			created_at: '',
			updated_at: '',
		};
		vi.mocked(updateProfessionalDeal).mockResolvedValueOnce(updatedDeal);
		const snapshotWithDeal = {
			...emptySnapshot,
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Anna showing',
					stage: 'showing',
					amount: null,
					next_action: 'Call',
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
			],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithDeal,
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
			verticalAddonModules: [],
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
			patchSnapshot,
			copyLane: async () => {},
			patchOnboarding: async () => {},
			embeddedMobileLayout: false,
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithDeal}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		fireEvent.change(screen.getByLabelText('Stage'), {
			target: { value: 'negotiation' },
		});
		await waitFor(() =>
			expect(updateProfessionalDeal).toHaveBeenCalledWith('d1', {
				stage: 'negotiation',
			})
		);
		expect(patchSnapshot).toHaveBeenCalled();
	});

	it('removes deal from snapshot after confirm delete', async () => {
		const patchSnapshot = vi.fn();
		const snapshotWithDeal = {
			...emptySnapshot,
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Anna deal',
					stage: 'new',
					amount: null,
					next_action: '',
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
			],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithDeal,
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
			verticalAddonModules: [],
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
			patchSnapshot,
			copyLane: async () => {},
			patchOnboarding: async () => {},
			embeddedMobileLayout: false,
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		vi.mocked(deleteProfessionalDeal).mockResolvedValue(undefined);

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithDeal}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		const [firstRemoveDealButton] = screen.getAllByRole('button', {
			name: 'Remove deal',
		});
		expect(firstRemoveDealButton).toBeDefined();
		fireEvent.click(firstRemoveDealButton as HTMLButtonElement);
		await waitFor(() =>
			expect(
				screen.getAllByRole('button', { name: 'Remove deal' }).length
			).toBe(2)
		);
		const confirmRemoveDealButton = screen
			.getAllByRole('button', { name: 'Remove deal' })
			.at(-1);
		expect(confirmRemoveDealButton).toBeDefined();
		fireEvent.click(confirmRemoveDealButton as HTMLButtonElement);

		await waitFor(() =>
			expect(deleteProfessionalDeal).toHaveBeenCalledWith('d1')
		);
		expect(patchSnapshot).toHaveBeenCalled();
	});

	it('shows client delete conflict when deals remain', async () => {
		const patchSnapshot = vi.fn();
		const snapshotWithDeal = {
			...emptySnapshot,
			clients: [
				{
					id: 'c1',
					user_id: 'u',
					vertical_slug: 'realtor',
					name: 'Anna',
					contact: '',
					need_summary: '',
					budget_from: null,
					budget_to: null,
					preferred_areas: [],
					emotional_motive: '',
					next_action: '',
					status: 'lead',
					created_at: '',
					updated_at: '',
				},
			],
			deals: [
				{
					id: 'd1',
					user_id: 'u',
					vertical_slug: 'realtor',
					client_id: 'c1',
					title: 'Anna deal',
					stage: 'new',
					amount: null,
					next_action: '',
					deal_data: {},
					created_at: '',
					updated_at: '',
				},
			],
		};
		const value = {
			activeView: 'clients',
			activeVerticalSlug: 'realtor',
			navigate: vi.fn(),
			openClients: vi.fn(),
			openProperties: vi.fn(),
			openPipeline: vi.fn(),
			pipelineFocusDealId: null,
			consumePipelineFocus: vi.fn(),
			openCommunications: vi.fn(),
			communicationsFocus: null,
			consumeCommunicationsFocus: vi.fn(),
			openArtifacts: vi.fn(),
			artifactsWorkspaceFocus: null,
			consumeArtifactsWorkspaceFocus: vi.fn(),
			openShowings: vi.fn(),
			showingsFocus: null,
			consumeShowingsFocus: vi.fn(),
			openTasks: vi.fn(),
			tasksFocus: null,
			consumeTasksFocus: vi.fn(),
			clientsWorkspaceFocus: null,
			consumeClientsWorkspaceFocus: vi.fn(),
			propertiesWorkspaceFocus: null,
			consumePropertiesWorkspaceFocus: vi.fn(),
			openProfessionTool: vi.fn(),
			professionToolFocusModuleKey: null,
			consumeProfessionToolFocus: vi.fn(),
			snapshot: snapshotWithDeal,
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
			verticalAddonModules: [],
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
			patchSnapshot,
			copyLane: async () => {},
			patchOnboarding: async () => {},
			embeddedMobileLayout: false,
		} satisfies ProfessionalWorldsWorkspaceContextValue;

		vi.mocked(deleteProfessionalClient).mockRejectedValue(
			new APIError('conflict', 409, undefined, {
				detail: { code: 'client_has_deals', deal_count: 1 },
			})
		);

		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ClientsWorkspacePanel
						activeVerticalSlug="realtor"
						snapshot={snapshotWithDeal}
						clientDraft={clientDraft}
						setClientDraft={() => {}}
						dealDraft={dealDraft}
						setDealDraft={() => {}}
						saving={false}
						clientsBanner={null}
						onCreateClient={() => {}}
						onCreateDeal={() => {}}
					/>
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		fireEvent.click(screen.getByRole('tab', { name: 'Clients & deals' }));
		const [firstRemoveClientButton] = screen.getAllByRole('button', {
			name: 'Remove client',
		});
		expect(firstRemoveClientButton).toBeDefined();
		fireEvent.click(firstRemoveClientButton as HTMLButtonElement);
		await waitFor(() =>
			expect(
				screen.getAllByRole('button', { name: 'Remove client' }).length
			).toBe(2)
		);
		const confirmRemoveClientButton = screen
			.getAllByRole('button', { name: 'Remove client' })
			.at(-1);
		expect(confirmRemoveClientButton).toBeDefined();
		fireEvent.click(confirmRemoveClientButton as HTMLButtonElement);

		await waitFor(() =>
			expect(screen.getByText('Remove linked deals first')).toBeInTheDocument()
		);
		expect(patchSnapshot).not.toHaveBeenCalled();
	});
});
