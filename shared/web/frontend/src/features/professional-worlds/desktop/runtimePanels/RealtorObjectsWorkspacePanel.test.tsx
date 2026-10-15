/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Objects workspace listing navigation and post-create next-step CTAs.
 *
 * Invariants:
 * - Navigation CTAs only focus existing Professional Worlds surfaces; they must not create downstream records.
 *
 * Related:
 * - ./RealtorObjectsWorkspacePanel.tsx
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { makeRuntimeModuleByKey } from '../professionalWorldsTestFixtures';
import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import { createEmptyRealtorProperty } from '../realtorLogic';
import type { ProfessionalWorldsSnapshot, RealtorProperty } from '../types';
import { RealtorObjectsWorkspacePanel } from './RealtorObjectsWorkspacePanel';

const mockObjectsWorkspace = vi.hoisted(() => ({
	setPropertiesWorkspaceTab: vi.fn(),
	overrides: {} as Record<string, unknown>,
}));

vi.mock('../hooks/useRealtorObjectsWorkspace', () => ({
	useRealtorObjectsWorkspace: () => ({
		propertyDraft: createEmptyRealtorProperty({ city: 'Vladivostok' }),
		setPropertyDraft: vi.fn(),
		infrastructureCsv: '',
		setInfrastructureCsv: vi.fn(),
		tone: 'neutral',
		setTone: vi.fn(),
		mediaPickerItems: [],
		setMediaPickerItems: vi.fn(),
		listingMediaRefreshAt: 0,
		uploadEnhanceInputRef: { current: null },
		mediaPipelineBusy: false,
		uploadProgressRows: [],
		listingAlbums: [],
		batchTargetAlbumId: null,
		setBatchTargetAlbumId: vi.fn(),
		objectIntakeText: '',
		setObjectIntakeText: vi.fn(),
		objectIntakePreview: null,
		photoPresetKey: '',
		setPhotoPresetKey: vi.fn(),
		photoInstruction: '',
		setPhotoInstruction: vi.fn(),
		uploadWithoutProcessing: false,
		setUploadWithoutProcessing: vi.fn(),
		propertiesWorkspaceTab: 'listingWorkspace',
		setPropertiesWorkspaceTab: mockObjectsWorkspace.setPropertiesWorkspaceTab,
		lastCreatedProperty: null,
		clearLastCreatedProperty: vi.fn(),
		handleCreateProperty: vi.fn(),
		handleUpdateSelectedProperty: vi.fn(),
		handleStream: vi.fn(),
		handleObjectIntake: vi.fn(),
		handleCommitObjectIntake: vi.fn(),
		handleMultiPhotoUploadEnhance: vi.fn(),
		handleMediaLibraryBatch: vi.fn(),
		resetPropertyDraft: vi.fn(),
		saving: false,
		...mockObjectsWorkspace.overrides,
	}),
}));

vi.mock('../hooks/useListingPrimaryUnifiedContentIds', () => ({
	useListingPrimaryUnifiedContentIds: () => ({
		coverStates: {
			p1: { kind: 'ready', primaryUnifiedContentId: null, photoTotal: 0 },
		},
		registerListingCoverInterest: vi.fn(),
		selectedCoverPending: () => false,
	}),
}));

vi.mock('../api', () => ({
	deleteRealtorProperty: vi.fn(),
}));

vi.mock('../ProfessionalToast', () => ({
	useProfessionalToasts: () => ({
		notifySuccess: vi.fn(),
		notifyApiError: vi.fn(),
	}),
}));

import { deleteRealtorProperty } from '../api';

vi.mock('../ProfessionalMediaWorkbench', () => ({
	ProfessionalMediaWorkbench: () => <div>Advanced media workbench</div>,
}));

vi.mock('../UnifiedContentPickerBridge', () => ({
	UnifiedContentPickerBridge: ({
		buttonLabel,
		description,
		title,
	}: {
		readonly buttonLabel: string;
		readonly description: string;
		readonly title: string;
	}) => (
		<section>
			<h3>{title}</h3>
			<p>{description}</p>
			<button type="button">{buttonLabel}</button>
		</section>
	),
}));

const selectedProperty: RealtorProperty = {
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
};

const baseSnapshot = {
	verticals: [],
	runtimeConfig: null,
	runtimeConfigs: [],
	verticalActivations: [],
	profile: null,
	properties: [selectedProperty],
	clients: [],
	deals: [],
	courses: [],
	artifacts: [],
} satisfies ProfessionalWorldsSnapshot;

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

beforeEach(() => {
	mockObjectsWorkspace.overrides = {};
	mockObjectsWorkspace.setPropertiesWorkspaceTab.mockClear();
});

function renderObjectsPanel(
	overrides: Partial<ProfessionalWorldsWorkspaceContextValue> = {}
) {
	const openClients = vi.fn();
	const openCommunications = vi.fn();
	const openProfessionTool = vi.fn();
	const value: ProfessionalWorldsWorkspaceContextValue = {
		activeView: 'properties',
		activeVerticalSlug: 'realtor',
		navigate: vi.fn(),
		openClients,
		openProperties: vi.fn(),
		openPipeline: vi.fn(),
		pipelineFocusDealId: null,
		consumePipelineFocus: vi.fn(),
		openShowings: vi.fn(),
		showingsFocus: null,
		consumeShowingsFocus: vi.fn(),
		openTasks: vi.fn(),
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
		selectedPropertyId: 'p1',
		setSelectedPropertyId: () => {},
		selectedProperty,
		listingWorkspaceEnabled: true,
		activeRuntimeConfig: null,
		activeActivation: null,
		activeVertical: null,
		verticalAddonModules: [
			makeRuntimeModuleByKey('realtor_communications', 'communications'),
		],
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
				<RealtorObjectsWorkspacePanel />
			</ProfessionalWorldsWorkspaceProvider>
		</I18nextProvider>
	);
	return { openClients, openCommunications, openProfessionTool };
}

describe('RealtorObjectsWorkspacePanel', () => {
	beforeEach(() => {
		class MockIntersectionObserver {
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
		}
		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
	});

	it('shows new draft hero on the new listing tab', () => {
		mockObjectsWorkspace.overrides = { propertiesWorkspaceTab: 'newDraft' };
		renderObjectsPanel({
			snapshot: { ...baseSnapshot, properties: [] },
			selectedPropertyId: null,
			selectedProperty: null,
		});
		expect(screen.getByText(/Add your first listing/i)).toBeInTheDocument();
		expect(
			screen.getByText(
				/Describe the property in plain language or use the form/i
			)
		).toBeInTheDocument();
	});

	it('shows saved listings hero and portfolio summary', () => {
		mockObjectsWorkspace.overrides = {
			propertiesWorkspaceTab: 'savedListings',
		};
		renderObjectsPanel({
			snapshot: {
				...baseSnapshot,
				properties: [selectedProperty],
			},
		});
		expect(
			screen.getByText(
				/Pick a listing to attach photos, descriptions, and client materials/i
			)
		).toBeInTheDocument();
		expect(
			screen.getByText('1 listing(s) in your portfolio.')
		).toBeInTheDocument();
	});

	it('listing workspace header logs communication for selected property', () => {
		const { openCommunications } = renderObjectsPanel();
		expect(screen.getByText('Active listing context')).toBeInTheDocument();
		expect(
			screen.getByRole('region', { name: 'Active listing context' })
		).toBeInTheDocument();
		expect(
			screen.getByText(/Vladivostok.*Sale.*nothing is created automatically/i)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Create text only after the listing facts look right/)
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/Check facts first, then add photos or prepare description text/i
			)
		).toBeInTheDocument();
		expect(screen.getByText('Listing facts')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Log communication' }));
		expect(openCommunications).toHaveBeenCalledWith({
			relatedType: 'property',
			relatedId: 'p1',
		});
	});

	it('hides log communication CTA when communications module disabled', () => {
		renderObjectsPanel({ verticalAddonModules: [] });
		expect(
			screen.queryByRole('button', { name: 'Log communication' })
		).toBeNull();
	});

	it('offers next-step links from active listing without creating new data', () => {
		const { openClients, openProfessionTool } = renderObjectsPanel({
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_showings'),
				makeRuntimeModuleByKey('realtor_documents'),
				makeRuntimeModuleByKey('realtor_marketing'),
				makeRuntimeModuleByKey('realtor_insights'),
			],
		});

		fireEvent.click(screen.getByText('More for this listing'));
		fireEvent.click(screen.getByRole('button', { name: 'Create deal' }));
		expect(openClients).toHaveBeenCalledWith({
			tab: 'capture',
			linkedPropertyId: 'p1',
		});

		fireEvent.click(screen.getByRole('button', { name: 'Showings calendar' }));
		fireEvent.click(screen.getByRole('button', { name: 'Document checklist' }));
		fireEvent.click(
			screen.getByRole('button', { name: 'Marketing campaigns' })
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Price and listing quality insights',
			})
		);
		expect(openProfessionTool).toHaveBeenCalledWith('realtor_showings');
		expect(openProfessionTool).toHaveBeenCalledWith('realtor_documents');
		expect(openProfessionTool).toHaveBeenCalledWith('realtor_marketing');
		expect(openProfessionTool).toHaveBeenCalledWith('realtor_insights');
	});

	it('shows a simple realtor photo flow before advanced processing tools', () => {
		mockObjectsWorkspace.overrides = {
			propertiesWorkspaceTab: 'listingWorkspace',
		};
		renderObjectsPanel({
			mediaStudioEnabled: true,
		});

		expect(screen.getByText('Choose from uploaded photos')).toBeInTheDocument();
		expect(
			screen.getByText(/Photos attach to the listing right away/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Upload photos' })
		).toBeInTheDocument();
		expect(screen.getByText('Advanced: improve photos')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', {
				name: 'Upload and enhance multiple photos',
			})
		).toBeNull();
	});

	it('embedded mobile shows read-only listing summary and photo upload only', () => {
		mockObjectsWorkspace.overrides = {
			propertiesWorkspaceTab: 'listingWorkspace',
		};
		renderObjectsPanel({
			embeddedMobileLayout: true,
			mediaStudioEnabled: true,
		});

		expect(
			screen.getByText(
				/Add photos from your phone or pick files you already uploaded/i
			)
		).toBeInTheDocument();
		expect(screen.getByText('Sea View')).toBeInTheDocument();
		expect(screen.getByText('Vladivostok')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Upload photos' })
		).toBeInTheDocument();
		expect(screen.getByText('Listing facts')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save listing' })).toBeNull();
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(screen.queryByText('Advanced: improve photos')).toBeNull();
		expect(screen.queryByText('Advanced media workbench')).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'Client-focused description' })
		).toBeNull();
	});

	it('offers next-step actions after a listing is saved', () => {
		mockObjectsWorkspace.overrides = {
			propertiesWorkspaceTab: 'newDraft',
			lastCreatedProperty: { id: 'p1', title: 'Sea View' },
		};
		renderObjectsPanel({
			verticalAddonModules: [
				makeRuntimeModuleByKey('realtor_showings'),
				makeRuntimeModuleByKey('realtor_documents'),
				makeRuntimeModuleByKey('realtor_marketing'),
			],
		});

		expect(screen.getByText('Listing saved')).toBeInTheDocument();
		expect(screen.getByText(/Sea View.*Next, add photos/i)).toBeInTheDocument();
		expect(
			screen.getByText(/No deal, client message, showing, document/i)
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', { name: 'Open listing workspace' })
		);
		expect(mockObjectsWorkspace.setPropertiesWorkspaceTab).toHaveBeenCalledWith(
			'listingWorkspace'
		);

		fireEvent.click(screen.getByRole('button', { name: 'Add photos' }));
		fireEvent.click(
			screen.getByRole('button', { name: 'Prepare description' })
		);
		expect(mockObjectsWorkspace.setPropertiesWorkspaceTab).toHaveBeenCalledWith(
			'listingWorkspace'
		);
	});

	it('removes listing from portfolio after confirm delete', async () => {
		mockObjectsWorkspace.overrides = {
			propertiesWorkspaceTab: 'listingWorkspace',
		};
		const patchSnapshot = vi.fn();
		const setSelectedPropertyId = vi.fn();
		vi.mocked(deleteRealtorProperty).mockResolvedValue(undefined);
		renderObjectsPanel({ patchSnapshot, setSelectedPropertyId });

		fireEvent.click(screen.getByText('More for this listing'));
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove from portfolio' })
		);
		await waitFor(() =>
			expect(
				screen.getAllByRole('button', { name: 'Remove from portfolio' }).length
			).toBe(2)
		);
		const confirmRemoveFromPortfolioButton = screen
			.getAllByRole('button', { name: 'Remove from portfolio' })
			.at(-1);
		expect(confirmRemoveFromPortfolioButton).toBeDefined();
		fireEvent.click(confirmRemoveFromPortfolioButton as HTMLButtonElement);

		await waitFor(() =>
			expect(deleteRealtorProperty).toHaveBeenCalledWith('p1')
		);
		expect(patchSnapshot).toHaveBeenCalled();
		expect(setSelectedPropertyId).toHaveBeenCalledWith(null);
	});
});
