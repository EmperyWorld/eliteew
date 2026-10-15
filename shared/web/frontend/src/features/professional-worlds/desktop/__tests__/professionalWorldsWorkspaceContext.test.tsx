/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Professional Worlds workspace React context.
 *
 * Invariants:
 * - `useProfessionalWorldsWorkspace` throws outside the provider.
 *
 * Related:
 * - ProfessionalWorldsWorkspaceContext.tsx
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
	ProfessionalWorldsWorkspaceProvider,
	useProfessionalWorldsWorkspace,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';

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
	embeddedMobileLayout: false,
};

describe('useProfessionalWorldsWorkspace', () => {
	it('throws when used outside the provider', () => {
		expect(() => renderHook(() => useProfessionalWorldsWorkspace())).toThrow(
			/useProfessionalWorldsWorkspace must be used within/
		);
	});

	it('returns value inside the provider', () => {
		const { result } = renderHook(() => useProfessionalWorldsWorkspace(), {
			wrapper: ({ children }) => (
				<ProfessionalWorldsWorkspaceProvider value={MINIMAL_CONTEXT}>
					{children}
				</ProfessionalWorldsWorkspaceProvider>
			),
		});
		expect(result.current.activeVerticalSlug).toBe('realtor');
	});
});
