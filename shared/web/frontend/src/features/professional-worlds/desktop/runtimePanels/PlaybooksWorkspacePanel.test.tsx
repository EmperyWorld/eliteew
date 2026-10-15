/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Playbooks workspace subtabs (runner vs about) and registry panel mount.
 *
 * Invariants:
 * - Mocks playbook runner SSE module; no real HTTP.
 *
 * Related:
 * - PlaybooksWorkspacePanel.tsx
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
import {
	makeEmptySnapshot,
	makeRuntimeConfig,
} from '../professionalWorldsTestFixtures';
import type { RuntimeModulePanelProps } from '../runtimeModuleRegistry';
import {
	PlaybooksRegistryPanel,
	PlaybooksWorkspacePanel,
} from './PlaybooksWorkspacePanel';

vi.mock('../ProfessionalPlaybooksRuntimePanel', () => ({
	ProfessionalPlaybooksRuntimePanel: () => (
		<div data-testid="playbooks-runner-stub">Runner stub</div>
	),
}));

const baseSnapshot = makeEmptySnapshot({
	runtimeConfig: makeRuntimeConfig({
		playbooks: [
			{
				playbook_key: 'realtor_property_content_pack',
				display_name: 'Listing content pack',
				description: null,
				sort_order: 0,
			},
		],
	}),
});

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		resources: {
			en: { [PROFESSIONAL_WORLDS_NS]: enProfessionalWorlds },
		},
		ns: [PROFESSIONAL_WORLDS_NS],
		defaultNS: PROFESSIONAL_WORLDS_NS,
	});
});

function workspaceValue(
	overrides: Partial<ProfessionalWorldsWorkspaceContextValue> = {}
): ProfessionalWorldsWorkspaceContextValue {
	return {
		activeView: 'playbooks',
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
		snapshot: baseSnapshot,
		refresh: async () => {},
		reloadSnapshot: async () => {},
		saving: false,
		setSaving: () => {},
		selectedPropertyId: null,
		setSelectedPropertyId: () => {},
		selectedProperty: null,
		listingWorkspaceEnabled: true,
		activeRuntimeConfig: baseSnapshot.runtimeConfig,
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
		copyLane: () => {},
		patchOnboarding: async () => {},
		embeddedMobileLayout: false,
		...overrides,
	};
}

function renderPlaybooksWorkspace(
	overrides: Partial<ProfessionalWorldsWorkspaceContextValue> = {}
) {
	return render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalWorldsWorkspaceProvider value={workspaceValue(overrides)}>
				<PlaybooksWorkspacePanel />
			</ProfessionalWorldsWorkspaceProvider>
		</I18nextProvider>
	);
}

describe('PlaybooksWorkspacePanel', () => {
	it('shows runner tab by default and switches to about copy', () => {
		renderPlaybooksWorkspace();
		expect(
			screen.getByText(/Run a scenario, then review the draft/i)
		).toBeInTheDocument();
		expect(screen.getByTestId('playbooks-runner-stub')).toBeInTheDocument();
		expect(
			screen.getByText(/A few steps in a row: choose a scenario/)
		).toBeInTheDocument();
		expect(screen.getByText(/Review before send/i)).toBeInTheDocument();

		fireEvent.click(screen.getByRole('tab', { name: 'How it works' }));
		expect(
			screen.queryByTestId('playbooks-runner-stub')
		).not.toBeInTheDocument();
		expect(
			screen.getByText(/Pick a ready-made scenario and tap Run/i)
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole('tab', { name: 'Runner' }));
		expect(screen.getByTestId('playbooks-runner-stub')).toBeInTheDocument();
	});
});

describe('PlaybooksRegistryPanel', () => {
	it('mounts runner from snapshot runtime config playbooks', () => {
		const props: RuntimeModulePanelProps = {
			entry: {
				moduleKey: 'realtor_playbooks',
				label: 'AI Playbooks',
				description: '',
				panelKind: 'dedicated',
				panel: vi.fn() as never,
			},
			runtimeModule: null,
			snapshot: baseSnapshot,
			verticalSlug: 'realtor',
		};
		render(
			<I18nextProvider i18n={pwI18n}>
				<PlaybooksRegistryPanel {...props} />
			</I18nextProvider>
		);
		expect(screen.getByTestId('playbooks-runner-stub')).toBeInTheDocument();
	});
});
