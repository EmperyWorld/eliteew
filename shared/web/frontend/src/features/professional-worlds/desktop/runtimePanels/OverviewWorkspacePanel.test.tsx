/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Overview pulse cross-links and Today's focus CRM CTAs.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import type { ProfessionalWorldsSnapshot } from '../types';
import { makeRuntimeModuleByKey } from '../professionalWorldsTestFixtures';
import { OverviewWorkspacePanel } from './OverviewWorkspacePanel';

const baseSnapshot = {
	verticals: [],
	runtimeConfig: null,
	runtimeConfigs: [],
	verticalActivations: [],
	profile: {
		id: 'profile-1',
		user_id: 'u1',
		vertical_slug: 'realtor',
		display_name: 'Anna',
		headline: null,
		city: 'Vladivostok',
		agency_name: null,
		specialization: [],
		profile_data: {},
		is_public_ready: false,
		created_at: '',
		updated_at: '',
	},
	properties: [],
	clients: [],
	deals: [
		{
			id: 'deal-focus',
			user_id: 'u1',
			vertical_slug: 'realtor',
			client_id: null,
			title: 'Open deal',
			stage: 'offer',
			amount: null,
			next_action: 'Follow up',
			deal_data: {},
			created_at: '',
			updated_at: '',
		},
	],
	courses: [],
	artifacts: [],
} satisfies ProfessionalWorldsSnapshot;

const addonModules = [
	makeRuntimeModuleByKey('realtor_leads', 'leads'),
	makeRuntimeModuleByKey('realtor_showings', 'showings'),
	makeRuntimeModuleByKey('realtor_tasks', 'tasks'),
	makeRuntimeModuleByKey('realtor_communications', 'communications'),
	makeRuntimeModuleByKey('realtor_pipeline', 'pipeline'),
];

const seaViewProperty = {
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
} satisfies ProfessionalWorldsSnapshot['properties'][number];

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

function renderOverview(
	overrides: Partial<ProfessionalWorldsWorkspaceContextValue> = {}
) {
	const openClients = vi.fn();
	const openPipeline = vi.fn();
	const openProfessionTool = vi.fn();
	const openCommunications = vi.fn();
	const openTasks = vi.fn();
	const navigate = vi.fn();
	const value: ProfessionalWorldsWorkspaceContextValue = {
		activeView: 'overview',
		activeVerticalSlug: 'realtor',
		navigate,
		openClients,
		openProperties: vi.fn(),
		openPipeline,
		pipelineFocusDealId: null,
		consumePipelineFocus: vi.fn(),
		openShowings: vi.fn(),
		showingsFocus: null,
		consumeShowingsFocus: vi.fn(),
		openTasks,
		tasksFocus: null,
		consumeTasksFocus: vi.fn(),
		openCommunications,
		communicationsFocus: null,
		consumeCommunicationsFocus: vi.fn(),
		openArtifacts: vi.fn(),
		artifactsWorkspaceFocus: null,
		consumeArtifactsWorkspaceFocus: vi.fn(),
		clientsWorkspaceFocus: null,
		consumeClientsWorkspaceFocus: vi.fn(),
		propertiesWorkspaceFocus: null,
		consumePropertiesWorkspaceFocus: vi.fn(),
		openProfessionTool,
		professionToolFocusModuleKey: null,
		consumeProfessionToolFocus: vi.fn(),
		snapshot: baseSnapshot,
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
		verticalAddonModules: addonModules,
		resolvedPhotoPresets: [],
		mediaStudioEnabled: false,
		dealsModuleEnabled: true,
		preparedPresentationBrief: '',
		listingStream: { text: '', status: '' },
		brandStream: { text: '', status: '' },
		learningStream: { text: '', status: '' },
		setLaneText: () => {},
		setLaneStatus: () => {},
		addArtifactToSnapshot: () => {},
		patchSnapshot: () => {},
		copyLane: () => {},
		patchOnboarding: () => {},
		embeddedMobileLayout: false,
		...overrides,
	};
	render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalWorldsWorkspaceProvider value={value}>
				<OverviewWorkspacePanel />
			</ProfessionalWorldsWorkspaceProvider>
		</I18nextProvider>
	);
	return {
		openClients,
		openCommunications,
		openPipeline,
		openProfessionTool,
		openTasks,
		navigate,
	};
}

describe('OverviewWorkspacePanel', () => {
	it('shows distinct first-run visible hero and task board', () => {
		renderOverview({
			snapshot: {
				...baseSnapshot,
				profile: null,
				deals: [],
			},
		});

		expect(
			screen.getByRole('heading', {
				name: /Build the first client-ready realtor workspace/i,
			})
		).toBeInTheDocument();
		expect(screen.getByText('Today in work')).toBeInTheDocument();
		expect(screen.getByText('Next best step')).toBeInTheDocument();
		expect(
			screen.getByText('What will not happen automatically')
		).toBeInTheDocument();
	});

	it('shows mid-progress hero when profile exists but portfolio is still incomplete', () => {
		renderOverview();

		expect(
			screen.getByRole('heading', {
				name: /Your realtor desk is taking shape/i,
			})
		).toBeInTheDocument();
		expect(screen.getByText('Profile is ready for drafts')).toBeInTheDocument();
		expect(screen.getByText('No active listing yet')).toBeInTheDocument();
	});

	it('shows complete hero once quick-start progress is done', () => {
		renderOverview({
			activeActivation: {
				vertical_slug: 'realtor',
				is_active: true,
				onboarding: {
					completed_steps: ['profile', 'first-object', 'first-artifact'],
				},
				entitlements: {},
			},
			snapshot: {
				...baseSnapshot,
				properties: [seaViewProperty],
			},
		});

		expect(
			screen.getByRole('heading', {
				name: /Your realtor workspace is ready for daily work/i,
			})
		).toBeInTheDocument();
		expect(
			screen.getByText('Review outputs before sending or publishing.')
		).toBeInTheDocument();
		expect(screen.getByText('Sea View')).toBeInTheDocument();
	});

	it('shows My week focus lines on pulse tab', () => {
		renderOverview();
		expect(
			screen.getByText(
				/Your week at a glance — numbers link to the right workspace/i
			)
		).toBeInTheDocument();
		expect(screen.getByText('My week')).toBeInTheDocument();
		expect(
			screen.getByText('Add your first listing to the portfolio.')
		).toBeInTheDocument();
		expect(screen.getByText('Deals in progress: 1.')).toBeInTheDocument();
	});

	it('routes empty Clients metric to Leads addon when enabled', () => {
		const { openProfessionTool, openClients } = renderOverview();
		const leadsMetricButton = screen
			.getAllByRole('button')
			.find((node) => node.textContent?.includes('Open client leads'));
		if (!leadsMetricButton) {
			throw new Error('expected leads metric button');
		}
		fireEvent.click(leadsMetricButton);
		expect(openProfessionTool).toHaveBeenCalledWith('realtor_leads');
		expect(openClients).not.toHaveBeenCalled();
	});

	it('shows CRM tasks focus CTA and opens Tasks with first follow-up prefill', () => {
		const { openTasks } = renderOverview();
		fireEvent.click(
			screen.getByRole('button', { name: /Review client tasks \(1\)/i })
		);
		expect(openTasks).toHaveBeenCalledWith({
			draftTitle: 'Follow up',
			dealId: 'deal-focus',
			clientId: null,
			propertyId: null,
		});
	});

	it('shows Communications follow-up CTA and opens quick log focus', () => {
		const { openCommunications } = renderOverview();
		fireEvent.click(screen.getByRole('button', { name: 'Log follow-ups (1)' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'deal',
			relatedId: 'deal-focus',
		});
	});

	it('renders realtor context summary from selected property and linked deal', () => {
		renderOverview({
			selectedProperty: {
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
			snapshot: {
				...baseSnapshot,
				properties: [
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
				],
				clients: [
					{
						id: 'c1',
						user_id: 'u1',
						vertical_slug: 'realtor',
						name: 'Buyer One',
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
				],
				deals: [
					{
						id: 'd1',
						user_id: 'u1',
						vertical_slug: 'realtor',
						client_id: 'c1',
						title: 'Sea View deal',
						stage: 'showing',
						amount: null,
						next_action: null,
						deal_data: { property_id: 'p1' },
						created_at: '',
						updated_at: '',
					},
				],
			},
		});

		expect(screen.getByText('Realtor context')).toBeInTheDocument();
		expect(
			screen.getByText(/What you have in focus right now/i)
		).toBeInTheDocument();
		expect(screen.getAllByText('Sea View').length).toBeGreaterThan(0);
		expect(screen.getByText('Buyer One')).toBeInTheDocument();
		expect(screen.getByText('Sea View deal')).toBeInTheDocument();
		expect(screen.getByText('Open calendar')).toBeInTheDocument();
		expect(screen.getByText('Open tasks')).toBeInTheDocument();
	});

	it('opens pipeline from week focus when deals are in progress', () => {
		const { openPipeline } = renderOverview();
		fireEvent.click(screen.getByRole('button', { name: 'Open deals' }));
		expect(openPipeline).toHaveBeenCalledWith();
	});
});
