/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Profession tools module focus deep-link from workspace context.
 *
 * Invariants:
 * - Uses a local Russian i18next instance; no browser locale or network resources.
 * - Module registry is mocked so the test only covers workspace copy, tabs, and focus state.
 *
 * Related:
 * - ProfessionToolsWorkspacePanel.tsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import ruProfessionalWorlds from '@/i18n/locales/ru/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { makeRuntimeModule } from '../professionalWorldsTestFixtures';
import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import type { ProfessionalWorldsSnapshot } from '../types';
import { ProfessionToolsWorkspacePanel } from './ProfessionToolsWorkspacePanel';

vi.mock('../ModulePanelRegistry', () => ({
	ModulePanelRegistry: ({ moduleKey }: { moduleKey: string }) => (
		<div data-testid={`module-panel-${moduleKey}`} />
	),
}));

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

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'ru',
		fallbackLng: 'ru',
		interpolation: { escapeValue: false },
		resources: {
			ru: {
				[PROFESSIONAL_WORLDS_NS]: ruProfessionalWorlds,
			},
		},
		ns: [PROFESSIONAL_WORLDS_NS],
		defaultNS: PROFESSIONAL_WORLDS_NS,
	});
});

describe('ProfessionToolsWorkspacePanel', () => {
	it('focuses requested addon module and consumes focus token', async () => {
		const consumeProfessionToolFocus = vi.fn();
		const value = {
			activeView: 'professionTools',
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
			professionToolFocusModuleKey: 'realtor_tasks',
			consumeProfessionToolFocus,
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
			activeVertical: { slug: 'realtor', name: 'Realtor', icon_key: '' },
			verticalAddonModules: [
				makeRuntimeModule({
					id: 'leads',
					module_key: 'realtor_leads',
					module_name: 'Admin leads label',
					module_category: 'addon',
					sort_order: 1,
				}),
				makeRuntimeModule({
					id: 'tasks',
					module_key: 'realtor_tasks',
					module_name: 'Admin tasks label',
					module_category: 'addon',
					sort_order: 2,
				}),
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

		const { getByTestId } = render(
			<I18nextProvider i18n={pwI18n}>
				<ProfessionalWorldsWorkspaceProvider value={value}>
					<ProfessionToolsWorkspacePanel />
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		expect(screen.getByText('Ежедневные задачи риэлтора')).toBeTruthy();
		expect(screen.getByRole('tab', { name: 'Обращения' })).toBeTruthy();
		expect(screen.getByRole('tab', { name: 'Задачи' })).toBeTruthy();
		await waitFor(() => {
			expect(getByTestId('module-panel-realtor_tasks')).toBeTruthy();
		});
		expect(
			screen.getByText(
				'Следующие действия по клиентам, объектам, показам и сделкам, чтобы ничего не потерялось.'
			)
		).toBeTruthy();
		expect(consumeProfessionToolFocus).toHaveBeenCalled();
	});

	it('shows empty hero when no modules enabled', () => {
		const value = {
			activeView: 'professionTools',
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
			activeRuntimeConfig: null,
			activeActivation: null,
			activeVertical: { slug: 'realtor', name: 'Realtor', icon_key: '' },
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
					<ProfessionToolsWorkspacePanel />
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		expect(screen.getByText(/Задачи профессии появятся здесь/i)).toBeTruthy();
		expect(
			screen.getByText(
				/Обратитесь в поддержку организации, если нужны показы, документы или инструменты по сделкам/i
			)
		).toBeTruthy();
	});

	it('shows ready hero when modules are enabled', () => {
		const value = {
			activeView: 'professionTools',
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
			activeRuntimeConfig: null,
			activeActivation: null,
			activeVertical: { slug: 'realtor', name: 'Realtor', icon_key: '' },
			verticalAddonModules: [
				makeRuntimeModule({
					id: 'leads',
					module_key: 'realtor_leads',
					module_name: 'Leads',
					module_category: 'addon',
					sort_order: 1,
				}),
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
					<ProfessionToolsWorkspacePanel />
				</ProfessionalWorldsWorkspaceProvider>
			</I18nextProvider>
		);

		expect(screen.getByText(/Выберите задачу на сегодня/i)).toBeTruthy();
		expect(
			screen.getByText(
				/Покупатели, продавцы, сделки, показы и напоминания открываются здесь/i
			)
		).toBeTruthy();
	});
});
