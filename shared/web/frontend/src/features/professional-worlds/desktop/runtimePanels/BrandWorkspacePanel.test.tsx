/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Brand workspace tab intro leads.
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
import { makeEmptySnapshot } from '../professionalWorldsTestFixtures';
import { BrandWorkspacePanel } from './BrandWorkspacePanel';

const emptySnapshot = makeEmptySnapshot();

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

function renderBrand() {
	const value = {
		activeView: 'brand',
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
		snapshot: emptySnapshot,
		refresh: async () => {},
		reloadSnapshot: async () => {},
		saving: false,
		setSaving: () => {},
		selectedPropertyId: null,
		setSelectedPropertyId: () => {},
		selectedProperty: null,
		listingWorkspaceEnabled: true,
		activeRuntimeConfig: emptySnapshot.runtimeConfig,
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
		setLaneText: vi.fn(),
		setLaneStatus: vi.fn(),
		addArtifactToSnapshot: () => {},
		patchSnapshot: () => {},
		copyLane: () => {},
		patchOnboarding: async () => {},
		embeddedMobileLayout: false,
	} satisfies ProfessionalWorldsWorkspaceContextValue;

	return render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalWorldsWorkspaceProvider value={value}>
				<BrandWorkspacePanel />
			</ProfessionalWorldsWorkspaceProvider>
		</I18nextProvider>
	);
}

describe('BrandWorkspacePanel', () => {
	it('shows premium hero on starters tab', () => {
		renderBrand();
		expect(
			screen.getByText(/Prepare client-facing brand materials/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Open saved listings' })
		).toBeInTheDocument();
	});

	it('shows media kit body on tab switch', () => {
		renderBrand();
		fireEvent.click(screen.getByRole('tab', { name: 'Brand kit link' }));
		expect(
			screen.getByText(/Colors, watermarks, albums, and saved photo materials/i)
		).toBeInTheDocument();
	});
});
