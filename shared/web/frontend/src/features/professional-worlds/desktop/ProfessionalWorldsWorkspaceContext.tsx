/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared workspace state for Professional Worlds runtime panels (snapshot, nav, AI lanes, listing selection).
 *
 * Invariants:
 * - Provider wraps only the shell content area inside `ProfessionalWorldsRuntimeShell` children.
 * - Panels must not mutate snapshot outside callbacks supplied by the App owner.
 * - `openProfessionTool(moduleKey?)` navigates to Profession tools and optionally focuses an addon module tab.
 * - `openClients(options?)` navigates to Clients and optionally focuses capture/directory, pre-fills deal client, filters deals by client, or selects a listing for deal capture.
 * - `openProperties(options?)` navigates to Objects, optionally selects a listing row, tab, or photo focus.
 * - `openPipeline(options?)` navigates to Profession tools → Deals pipeline and optionally focuses a deal row.
 * - `openShowings(options?)` navigates to Profession tools → Showings calendar and optionally pre-fills listing/client draft.
 * - `openTasks(options?)` navigates to Profession tools → Tasks and optionally pre-fills new-task draft and CRM links.
 * - `openCommunications(options?)` navigates to Profession tools → Communications and optionally pre-fills the quick log form.
 * - `useProfessionalWorldsWorkspace` throws when used outside the provider.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - runtimePanels/*
 */

import {
	createContext,
	useContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
} from 'react';

import type {
	RealtorProperty,
	ProfessionalArtifact,
	ProfessionalRuntimeModule,
	ProfessionalRuntimePhotoPreset,
	ProfessionalUserVerticalActivation,
	ProfessionalWorldsRuntimeConfig,
	ProfessionalWorldsSnapshot,
	ProfessionVertical,
} from './types';

export type ProfessionalWorldsActiveView =
	| 'overview'
	| 'profile'
	| 'properties'
	| 'clients'
	| 'professionTools'
	| 'learning'
	| 'brand'
	| 'playbooks'
	| 'artifacts';

export type ProfessionalWorldsAiLane = 'listing' | 'brand' | 'learning';

export type ProfessionalWorldsClientsWorkspaceFocus = {
	tab?: 'capture' | 'directory';
	dealClientId?: string | null;
	filterClientId?: string | null;
	linkedPropertyId?: string | null;
};

export type ProfessionalWorldsPropertiesWorkspaceTab =
	| 'newDraft'
	| 'savedListings'
	| 'listingWorkspace';

export type ProfessionalWorldsPropertiesWorkspaceFocus = {
	propertyId?: string | null;
	tab?: ProfessionalWorldsPropertiesWorkspaceTab;
	/** Scroll the listing workspace to the photos block (mobile field mode). */
	focusMedia?: boolean;
};

export type ProfessionalWorldsPipelineFocus = {
	dealId?: string | null;
};

export type ProfessionalWorldsCommunicationsFocus = {
	relatedType?: string | null;
	relatedId?: string | null;
};

export type ProfessionalWorldsShowingsFocus = {
	propertyId?: string | null;
	clientId?: string | null;
};

export type ProfessionalWorldsTasksFocus = {
	draftTitle?: string | null;
	propertyId?: string | null;
	clientId?: string | null;
	dealId?: string | null;
};

export type ProfessionalWorldsArtifactsWorkspaceFocus = {
	tab?: 'library' | 'handoff' | 'sources';
	artifactId?: string | null;
};

export type ProfessionalWorldsWorkspaceContextValue = {
	activeView: ProfessionalWorldsActiveView;
	activeVerticalSlug: string;
	navigate: (view: ProfessionalWorldsActiveView) => void;
	openClients: (options?: ProfessionalWorldsClientsWorkspaceFocus) => void;
	openProperties: (
		options?: ProfessionalWorldsPropertiesWorkspaceFocus
	) => void;
	openPipeline: (options?: ProfessionalWorldsPipelineFocus) => void;
	pipelineFocusDealId: string | null;
	consumePipelineFocus: () => void;
	openShowings: (options?: ProfessionalWorldsShowingsFocus) => void;
	showingsFocus: ProfessionalWorldsShowingsFocus | null;
	consumeShowingsFocus: () => void;
	openTasks: (options?: ProfessionalWorldsTasksFocus) => void;
	tasksFocus: ProfessionalWorldsTasksFocus | null;
	consumeTasksFocus: () => void;
	openCommunications: (options?: ProfessionalWorldsCommunicationsFocus) => void;
	communicationsFocus: ProfessionalWorldsCommunicationsFocus | null;
	consumeCommunicationsFocus: () => void;
	openArtifacts: (options?: ProfessionalWorldsArtifactsWorkspaceFocus) => void;
	artifactsWorkspaceFocus: ProfessionalWorldsArtifactsWorkspaceFocus | null;
	consumeArtifactsWorkspaceFocus: () => void;
	clientsWorkspaceFocus: ProfessionalWorldsClientsWorkspaceFocus | null;
	consumeClientsWorkspaceFocus: () => void;
	propertiesWorkspaceFocus: ProfessionalWorldsPropertiesWorkspaceFocus | null;
	consumePropertiesWorkspaceFocus: () => void;
	openProfessionTool: (moduleKey?: string) => void;
	professionToolFocusModuleKey: string | null;
	consumeProfessionToolFocus: () => void;
	snapshot: ProfessionalWorldsSnapshot;
	refresh: (options?: {
		verticalSlug?: string;
		silent?: boolean;
	}) => Promise<void>;
	/** Alias for panel error recovery and operator refresh flows. */
	reloadSnapshot: (options?: {
		verticalSlug?: string;
		silent?: boolean;
	}) => Promise<void>;
	saving: boolean;
	setSaving: (value: boolean) => void;
	selectedPropertyId: string | null;
	setSelectedPropertyId: Dispatch<SetStateAction<string | null>>;
	selectedProperty: RealtorProperty | null;
	listingWorkspaceEnabled: boolean;
	activeRuntimeConfig: ProfessionalWorldsRuntimeConfig | null;
	activeActivation: ProfessionalUserVerticalActivation | null;
	activeVertical: ProfessionVertical | null;
	verticalAddonModules: ProfessionalRuntimeModule[];
	resolvedPhotoPresets: ProfessionalRuntimePhotoPreset[];
	mediaStudioEnabled: boolean;
	dealsModuleEnabled: boolean;
	preparedPresentationBrief: string;
	listingStream: { text: string; status: string };
	brandStream: { text: string; status: string };
	learningStream: { text: string; status: string };
	setLaneText: (lane: ProfessionalWorldsAiLane, text: string) => void;
	setLaneStatus: (lane: ProfessionalWorldsAiLane, status: string) => void;
	addArtifactToSnapshot: (artifact?: ProfessionalArtifact) => void;
	patchSnapshot: (
		recipe: (current: ProfessionalWorldsSnapshot) => ProfessionalWorldsSnapshot
	) => void;
	copyLane: (lane: ProfessionalWorldsAiLane) => void | Promise<void>;
	patchOnboarding: (
		onboarding: Record<string, unknown>
	) => void | Promise<void>;
	/** MobileAndroid embedded WebView — phone layout despite wide CSS viewport. */
	embeddedMobileLayout: boolean;
};

const ProfessionalWorldsWorkspaceContext =
	createContext<ProfessionalWorldsWorkspaceContextValue | null>(null);

export function ProfessionalWorldsWorkspaceProvider({
	value,
	children,
}: {
	value: ProfessionalWorldsWorkspaceContextValue;
	children: ReactNode;
}) {
	return (
		<ProfessionalWorldsWorkspaceContext.Provider value={value}>
			{children}
		</ProfessionalWorldsWorkspaceContext.Provider>
	);
}

export function useProfessionalWorldsWorkspace(): ProfessionalWorldsWorkspaceContextValue {
	const value = useContext(ProfessionalWorldsWorkspaceContext);
	if (!value) {
		throw new Error(
			'useProfessionalWorldsWorkspace must be used within ProfessionalWorldsWorkspaceProvider'
		);
	}
	return value;
}
