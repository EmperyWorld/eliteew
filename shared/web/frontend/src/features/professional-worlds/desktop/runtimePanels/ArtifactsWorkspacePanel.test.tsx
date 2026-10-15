/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Saved results workspace tab intro leads.
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
import type { ProfessionalWorldsSnapshot } from '../types';
import { makeEmptySnapshot } from '../professionalWorldsTestFixtures';
import { ArtifactsWorkspacePanel } from './ArtifactsWorkspacePanel';
import { deleteProfessionalArtifact } from '../api';

vi.mock('../ProfessionalToast', () => ({
	useProfessionalToasts: () => ({
		notifySuccess: vi.fn(),
		notifyApiError: vi.fn(),
		notifyJobEvent: vi.fn(),
	}),
}));

vi.mock('../api', () => ({
	createPropertyDraft: vi.fn(),
	deleteProfessionalArtifact: vi.fn(),
	listProfessionalCrossAppDraftLinks: vi.fn(),
}));

vi.mock('../ArtifactHub', () => ({
	ArtifactHub: ({
		onRemoveArtifact,
	}: {
		onRemoveArtifact?: (artifact: { id: string; title: string }) => void;
	}) => (
		<button
			type="button"
			onClick={() =>
				onRemoveArtifact?.({
					id: 'a1',
					title: 'Listing copy',
					content: '',
					vertical_slug: 'realtor',
					source_type: 'realtor_property',
					source_id: 'p1',
					module_key: 'listing',
					artifact_kind: 'text',
					created_at: '',
				} as never)
			}
		>
			Remove draft
		</button>
	),
}));

vi.mock('../IntegrationHandoffPanel', () => ({
	IntegrationHandoffPanel: () => (
		<div data-testid="integration-handoff-stub">Handoff</div>
	),
}));

vi.mock('../components/CrossAppDraftLinksPanel', () => ({
	CrossAppDraftLinksPanel: () => (
		<div data-testid="cross-app-draft-links-stub">Draft links</div>
	),
}));

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

function renderArtifacts(
	snapshot: ProfessionalWorldsSnapshot = emptySnapshot,
	overrides: Partial<ProfessionalWorldsWorkspaceContextValue> = {}
) {
	const patchSnapshot = overrides.patchSnapshot ?? vi.fn();
	const value = {
		activeView: 'artifacts',
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
		snapshot,
		refresh: async () => {},
		reloadSnapshot: async () => {},
		saving: false,
		setSaving: () => {},
		selectedPropertyId: null,
		setSelectedPropertyId: () => {},
		selectedProperty: null,
		listingWorkspaceEnabled: true,
		activeRuntimeConfig: snapshot.runtimeConfig,
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
		patchSnapshot,
		copyLane: () => {},
		patchOnboarding: async () => {},
		embeddedMobileLayout: false,
		...overrides,
	} satisfies ProfessionalWorldsWorkspaceContextValue;

	return render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalWorldsWorkspaceProvider value={value}>
				<ArtifactsWorkspacePanel />
			</ProfessionalWorldsWorkspaceProvider>
		</I18nextProvider>
	);
}

describe('ArtifactsWorkspacePanel', () => {
	it('shows library intro lead and result count', () => {
		renderArtifacts({
			...emptySnapshot,
			artifacts: [
				{
					id: 'a1',
					vertical_slug: 'realtor',
					source_type: 'realtor_property',
					source_id: 'p1',
					title: 'Listing copy',
					content: 'Body',
					module_key: 'listing',
					artifact_kind: 'text',
					created_at: '',
				},
			],
		});
		expect(
			screen.getByText(/Review drafts before they leave the workspace/i)
		).toBeInTheDocument();
		expect(screen.getByText('1 saved result(s).')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Remove draft' })
		).toBeInTheDocument();
	});

	it('shows handoff and sources intro leads on tab switch', () => {
		renderArtifacts();
		fireEvent.click(screen.getByRole('tab', { name: 'Send to apps' }));
		expect(
			screen.getByText(/Nothing sends automatically/i)
		).toBeInTheDocument();
		expect(
			screen.getByTestId('cross-app-draft-links-stub')
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole('tab', { name: 'Where they appear' }));
		expect(
			screen.getAllByRole('button', { name: 'Open saved listings' }).length
		).toBeGreaterThanOrEqual(1);
	});

	it('removes draft after confirm delete', async () => {
		const patchSnapshot = vi.fn();
		vi.mocked(deleteProfessionalArtifact).mockResolvedValue(undefined);
		renderArtifacts(
			{
				...emptySnapshot,
				artifacts: [
					{
						id: 'a1',
						vertical_slug: 'realtor',
						source_type: 'realtor_property',
						source_id: 'p1',
						title: 'Listing copy',
						content: 'Body',
						module_key: 'listing',
						artifact_kind: 'text',
						created_at: '',
					},
				],
			},
			{ patchSnapshot }
		);

		fireEvent.click(screen.getByRole('button', { name: 'Remove draft' }));
		await waitFor(() =>
			expect(
				screen.getAllByRole('button', { name: 'Remove draft' }).length
			).toBe(2)
		);
		const confirmRemoveDraftButton = screen
			.getAllByRole('button', { name: 'Remove draft' })
			.at(-1);
		expect(confirmRemoveDraftButton).toBeDefined();
		fireEvent.click(confirmRemoveDraftButton as HTMLButtonElement);

		await waitFor(() =>
			expect(deleteProfessionalArtifact).toHaveBeenCalledWith('a1')
		);
		expect(patchSnapshot).toHaveBeenCalled();
	});
});
