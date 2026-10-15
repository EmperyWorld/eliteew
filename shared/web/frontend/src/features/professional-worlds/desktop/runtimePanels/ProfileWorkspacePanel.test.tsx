/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for specialist profile workspace (import + tab render).
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
import { emptySpecialistProfileDraft } from '../profileDraftDefaults';
import { ProfileWorkspacePanel } from './ProfileWorkspacePanel';

vi.mock('../ProfessionalToast', () => ({
	useProfessionalToasts: () => ({
		notifySuccess: vi.fn(),
		notifyApiError: vi.fn(),
		notifyJobEvent: vi.fn(),
	}),
}));

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		interpolation: { escapeValue: false },
		resources: {
			en: { [PROFESSIONAL_WORLDS_NS]: enProfessionalWorlds },
		},
		ns: [PROFESSIONAL_WORLDS_NS],
		defaultNS: PROFESSIONAL_WORLDS_NS,
	});
});

function renderProfilePanel({
	profileBanner = null,
}: {
	profileBanner?: { kind: 'success' | 'error'; text: string } | null;
} = {}) {
	const profileDraft = emptySpecialistProfileDraft('realtor');
	const value: ProfessionalWorldsWorkspaceContextValue = {
		activeView: 'profile',
		activeVerticalSlug: 'realtor',
		navigate: vi.fn(),
		openClients: vi.fn(),
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
		openCommunications: vi.fn(),
		communicationsFocus: null,
		consumeCommunicationsFocus: vi.fn(),
		openArtifacts: vi.fn(),
		artifactsWorkspaceFocus: null,
		consumeArtifactsWorkspaceFocus: vi.fn(),
		clientsWorkspaceFocus: null,
		consumeClientsWorkspaceFocus: vi.fn(),
		propertiesWorkspaceFocus: null,
		consumePropertiesWorkspaceFocus: vi.fn(),
		openProfessionTool: vi.fn(),
		professionToolFocusModuleKey: null,
		consumeProfessionToolFocus: vi.fn(),
		snapshot: {
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
		copyLane: async () => {},
		patchOnboarding: async () => {},
		embeddedMobileLayout: false,
	};

	return render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalWorldsWorkspaceProvider value={value}>
				<ProfileWorkspacePanel
					profileDraft={profileDraft}
					setProfileDraft={() => {}}
					profileBanner={profileBanner}
					saving={false}
					onSaveProfile={() => {}}
				/>
			</ProfessionalWorldsWorkspaceProvider>
		</I18nextProvider>
	);
}

describe('ProfileWorkspacePanel', () => {
	it('renders visible hero and basics tab without crashing', () => {
		renderProfilePanel();
		expect(
			screen.getByText(/Make your profile client-ready/i)
		).toBeInTheDocument();
		expect(
			screen.getByLabelText('Professional display name')
		).toBeInTheDocument();
		expect(screen.getByText(/How clients see you first/i)).toBeInTheDocument();
		expect(
			screen.getByText(/Nothing publishes automatically/i)
		).toBeInTheDocument();
	});

	it('switches to public page tab and offers fill-in basics', () => {
		renderProfilePanel();
		fireEvent.click(screen.getByRole('tab', { name: 'Public page' }));
		expect(screen.getByText('Public specialist page')).toBeInTheDocument();
		expect(
			screen.getAllByRole('button', { name: 'Fill in basics' }).length
		).toBeGreaterThan(0);
	});

	it('renders saved profile as an outcome card with no auto-publish claim', () => {
		renderProfilePanel({
			profileBanner: { kind: 'success', text: 'Profile saved on the server.' },
		});

		expect(screen.getByText('Profile saved')).toBeInTheDocument();
		expect(
			screen.getByText(/Nothing was published automatically/i)
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', { name: 'Review public page setup' })
		);
		expect(screen.getByText('Public specialist page')).toBeInTheDocument();
	});
});
