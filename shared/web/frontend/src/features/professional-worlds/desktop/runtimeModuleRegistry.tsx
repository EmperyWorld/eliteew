/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Registry that maps Professional Worlds runtime module keys to lazy panel components.
 *
 * Invariants:
 * - Registry keys must match backend `ProfessionalRuntimeModule.module_key` values.
 * - Lazy panels receive the already-loaded runtime snapshot; they do not fetch global app state.
 * - `panelKind === "placeholder"` entries are omitted from the Profession tools addon stack (see `sortedEnabledVerticalAddonModules`).
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - realtorLogic.ts (`sortedEnabledRealtorAddonModules`)
 * - runtimePanels/RuntimePlaceholderPanel.tsx
 * - src/features/professional-worlds/desktop/types.ts
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

import type {
	ProfessionalRuntimeModule,
	ProfessionalWorldsSnapshot,
} from './types';

export type RuntimeModulePanelProps = {
	entry: RuntimeModuleRegistryEntry;
	runtimeModule: ProfessionalRuntimeModule | null;
	snapshot: ProfessionalWorldsSnapshot;
	verticalSlug: string;
};

export type RuntimeModulePanelComponent =
	ComponentType<RuntimeModulePanelProps>;

export type RuntimeModuleRegistryEntry = {
	moduleKey: string;
	label: string;
	description: string;
	/** Dedicated UI vs MVP placeholder; drives addon rail visibility on the Profession tools workspace. */
	panelKind: 'dedicated' | 'placeholder';
	panel: LazyExoticComponent<RuntimeModulePanelComponent>;
};

function lazyPlaceholderPanel() {
	return lazy(() => import('./runtimePanels/RuntimePlaceholderPanel'));
}

function lazyRealtorPanel(
	panelName:
		| 'ClientsPanel'
		| 'CommunicationTimelinePanel'
		| 'DealsPipelinePanel'
		| 'DocumentsPanel'
		| 'InsightsPanel'
		| 'LeadsPanel'
		| 'MarketingCampaignPanel'
		| 'ObjectionLibraryPanel'
		| 'SellerOnboardingPanel'
		| 'ShowingsCalendarPanel'
		| 'TasksPanel'
) {
	return lazy(() =>
		import('./runtimePanels/RealtorProPanels').then((module) => ({
			default: module[panelName],
		}))
	);
}

export const PROFESSIONAL_RUNTIME_MODULE_REGISTRY = {
	profile: {
		moduleKey: 'profile',
		label: 'Profile',
		description:
			'Specialist positioning, public readiness and profile metadata.',
		panelKind: 'placeholder',
		panel: lazyPlaceholderPanel(),
	},
	objects: {
		moduleKey: 'objects',
		label: 'Objects',
		description:
			'Realtor property intake, facts, media and listing generation.',
		panelKind: 'dedicated',
		panel: lazy(() =>
			import('./runtimePanels/RealtorObjectsWorkspacePanel').then((module) => ({
				default: module.RealtorObjectsRegistryPanel,
			}))
		),
	},
	clients: {
		moduleKey: 'clients',
		label: 'Clients',
		description: 'Client needs, buyer/seller pipeline and deal context.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('ClientsPanel'),
	},
	learning: {
		moduleKey: 'learning',
		label: 'Learning',
		description: 'Professional learning tracks, roleplay and exercises.',
		panelKind: 'placeholder',
		panel: lazyPlaceholderPanel(),
	},
	'public-presence': {
		moduleKey: 'public-presence',
		label: 'Public Presence',
		description: 'Brand, publication and outbound presence workflows.',
		panelKind: 'placeholder',
		panel: lazyPlaceholderPanel(),
	},
	artifacts: {
		moduleKey: 'artifacts',
		label: 'Results',
		description: 'Saved generated results and reusable professional content.',
		panelKind: 'placeholder',
		panel: lazyPlaceholderPanel(),
	},
	realtor_leads: {
		moduleKey: 'realtor_leads',
		label: 'Leads',
		description:
			'Lead inbox, qualification and lead-to-client conversion prep.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('LeadsPanel'),
	},
	realtor_buyers: {
		moduleKey: 'realtor_buyers',
		label: 'Buyers',
		description: 'Buyer requirements and property matching.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('ClientsPanel'),
	},
	realtor_sellers: {
		moduleKey: 'realtor_sellers',
		label: 'Sellers',
		description: 'Seller onboarding, valuation context and campaign readiness.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('SellerOnboardingPanel'),
	},
	realtor_pipeline: {
		moduleKey: 'realtor_pipeline',
		label: 'Deals Pipeline',
		description: 'Deal stages, timeline events and next-step recommendations.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('DealsPipelinePanel'),
	},
	realtor_showings: {
		moduleKey: 'realtor_showings',
		label: 'Showings',
		description: 'Showing calendar and outcome capture.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('ShowingsCalendarPanel'),
	},
	realtor_tasks: {
		moduleKey: 'realtor_tasks',
		label: 'Tasks',
		description: 'Grouped next actions from clients and deals.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('TasksPanel'),
	},
	realtor_documents: {
		moduleKey: 'realtor_documents',
		label: 'Documents',
		description: 'Document checklist and upload slots.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('DocumentsPanel'),
	},
	realtor_marketing: {
		moduleKey: 'realtor_marketing',
		label: 'Marketing',
		description: 'Campaign checklist and publication readiness.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('MarketingCampaignPanel'),
	},
	realtor_insights: {
		moduleKey: 'realtor_insights',
		label: 'Insights',
		description: 'Price analysis, comparable facts and listing quality.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('InsightsPanel'),
	},
	realtor_communications: {
		moduleKey: 'realtor_communications',
		label: 'Communication Timeline',
		description: 'Logged outreach and cross-channel follow-up history.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('CommunicationTimelinePanel'),
	},
	realtor_objections: {
		moduleKey: 'realtor_objections',
		label: 'Objection Library',
		description: 'Reusable objection handling variants.',
		panelKind: 'dedicated',
		panel: lazyRealtorPanel('ObjectionLibraryPanel'),
	},
	realtor_playbooks: {
		moduleKey: 'realtor_playbooks',
		label: 'Scenarios',
		description:
			'Multi-step assisted workflows and playbook runs for the active vertical.',
		panelKind: 'dedicated',
		panel: lazy(() =>
			import('./runtimePanels/PlaybooksWorkspacePanel').then((module) => ({
				default: module.PlaybooksRegistryPanel,
			}))
		),
	},
} satisfies Record<string, RuntimeModuleRegistryEntry>;

export type RuntimeModuleKey =
	keyof typeof PROFESSIONAL_RUNTIME_MODULE_REGISTRY;

const RUNTIME_MODULE_KEY_ALIASES: Partial<Record<string, RuntimeModuleKey>> = {
	'realtor-playbooks': 'realtor_playbooks',
};

export function getRuntimeModuleRegistryEntry(moduleKey: string) {
	const trimmed = moduleKey.trim();
	if (!trimmed) {
		return undefined;
	}
	const direct = PROFESSIONAL_RUNTIME_MODULE_REGISTRY[
		trimmed as RuntimeModuleKey
	] as RuntimeModuleRegistryEntry | undefined;
	if (direct) {
		return direct;
	}
	const alias = RUNTIME_MODULE_KEY_ALIASES[trimmed];
	if (alias) {
		return PROFESSIONAL_RUNTIME_MODULE_REGISTRY[alias];
	}
	const underscored = trimmed.replace(/-/g, '_');
	if (underscored !== trimmed) {
		return PROFESSIONAL_RUNTIME_MODULE_REGISTRY[
			underscored as RuntimeModuleKey
		] as RuntimeModuleRegistryEntry | undefined;
	}
	const hyphenated = trimmed.replace(/_/g, '-');
	if (hyphenated !== trimmed) {
		return PROFESSIONAL_RUNTIME_MODULE_REGISTRY[
			hyphenated as RuntimeModuleKey
		] as RuntimeModuleRegistryEntry | undefined;
	}
	if (/^[a-z][a-z0-9_-]*_[a-z0-9_-]+$/i.test(trimmed)) {
		return {
			moduleKey: trimmed,
			label: trimmed.replace(/_/g, ' '),
			description:
				'Vertical addon module (placeholder until dedicated UI ships).',
			panelKind: 'dedicated',
			panel: lazyPlaceholderPanel(),
		} satisfies RuntimeModuleRegistryEntry;
	}
	return undefined;
}

export function listRuntimeModuleRegistryEntries() {
	return Object.values(PROFESSIONAL_RUNTIME_MODULE_REGISTRY);
}
