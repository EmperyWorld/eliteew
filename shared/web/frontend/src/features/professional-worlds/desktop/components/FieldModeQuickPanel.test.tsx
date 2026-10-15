/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FieldModeQuickPanel renders without referencing undefined workspace fields.
 *
 * Related:
 * - FieldModeQuickPanel.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import ruProfessionalWorlds from '@/i18n/locales/ru/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import { makeRuntimeModuleByKey } from '../professionalWorldsTestFixtures';
import { FieldModeQuickPanel } from './FieldModeQuickPanel';

const MINIMAL_CONTEXT: ProfessionalWorldsWorkspaceContextValue = {
	activeView: 'overview',
	activeVerticalSlug: 'realtor',
	navigate: () => {},
	openClients: () => {},
	openProperties: () => {},
	openPipeline: () => {},
	pipelineFocusDealId: null,
	consumePipelineFocus: () => {},
	openShowings: () => {},
	showingsFocus: null,
	consumeShowingsFocus: () => {},
	openTasks: () => {},
	tasksFocus: null,
	consumeTasksFocus: () => {},
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
	openProfessionTool: () => {},
	professionToolFocusModuleKey: null,
	consumeProfessionToolFocus: () => {},
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
	listingWorkspaceEnabled: false,
	activeRuntimeConfig: null,
	activeActivation: null,
	activeVertical: null,
	verticalAddonModules: [],
	resolvedPhotoPresets: [],
	mediaStudioEnabled: false,
	dealsModuleEnabled: false,
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
	embeddedMobileLayout: true,
};

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'ru',
		fallbackLng: 'ru',
		interpolation: { escapeValue: false },
		resources: {
			ru: { [PROFESSIONAL_WORLDS_NS]: ruProfessionalWorlds },
		},
	});
});

describe('FieldModeQuickPanel', () => {
	it('renders field mode panel when activeRuntimeConfig is null', () => {
		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={MINIMAL_CONTEXT}>
					<FieldModeQuickPanel />
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);
		expect(screen.getByText('Быстрые действия')).toBeTruthy();
	});

	it('opens listing workspace photos when listing photo is clicked', () => {
		const openProperties = vi.fn();
		render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider
					value={{
						...MINIMAL_CONTEXT,
						selectedPropertyId: 'p1',
						openProperties,
						verticalAddonModules: [
							makeRuntimeModuleByKey('realtor_communications'),
							makeRuntimeModuleByKey('realtor_showings'),
						],
					}}
				>
					<FieldModeQuickPanel />
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);
		fireEvent.click(screen.getByRole('button', { name: 'Фото объекта' }));
		expect(openProperties).toHaveBeenCalledWith({
			propertyId: 'p1',
			tab: 'listingWorkspace',
			focusMedia: true,
		});
	});
});
