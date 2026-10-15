/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component and helper coverage for Professional Worlds runtime primitives.
 *
 * Invariants:
 * - Runtime component tests stay at the component boundary and do not call backend APIs.
 * - Schema, SSE and onboarding assertions cover user-visible contracts, not implementation details.
 * - Locale-dependent panels use an isolated `i18next.createInstance()` in this suite so keys resolve.
 *
 * Related:
 * - SchemaDrivenForm.tsx
 * - JobProgressStream.tsx
 */

import type { ReactElement } from 'react';
import type { i18n } from 'i18next';
import i18next from 'i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it, vi, beforeAll } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	makeRuntimeConfig,
	makeRuntimeIntegration,
	makeRuntimeModule,
} from './professionalWorldsTestFixtures';
import { AiActionLauncher } from './AiActionLauncher';
import { ArtifactHub } from './ArtifactHub';
import { IntegrationHandoffPanel } from './IntegrationHandoffPanel';
import {
	parseProfessionalJobSseChunk,
	JobProgressStream,
} from './JobProgressStream';
import { ModulePanelRegistry } from './ModulePanelRegistry';
import { RuntimeOnboardingWizard } from './RuntimeOnboardingWizard';
import { SchemaDrivenForm } from './SchemaDrivenForm';
import {
	listRuntimeModuleRegistryEntries,
	type RuntimeModuleRegistryEntry,
} from './runtimeModuleRegistry';
import type {
	ProfessionalArtifact,
	ProfessionalRuntimeModule,
	ProfessionalRuntimeSchema,
	ProfessionalWorldsSnapshot,
	RealtorProperty,
} from './types';

let runtimeComponentsI18n: i18n;

beforeAll(async () => {
	runtimeComponentsI18n = i18next.createInstance();
	await runtimeComponentsI18n.use(initReactI18next).init({
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

function withRuntimeComponentsI18n(element: ReactElement): ReactElement {
	return (
		<I18nextProvider i18n={runtimeComponentsI18n}>{element}</I18nextProvider>
	);
}

const baseRuntimeModule: ProfessionalRuntimeModule = makeRuntimeModule({
	id: '11111111-1111-4111-8111-111111111111',
	module_key: 'objects',
	module_name: 'Objects',
	module_category: 'core',
	icon_key: 'home',
	sort_order: 10,
});

const baseSnapshot: ProfessionalWorldsSnapshot = {
	verticals: [],
	runtimeConfig: makeRuntimeConfig({
		modules: [baseRuntimeModule],
		config_version_hash: 'hash-1',
	}),
	runtimeConfigs: [],
	verticalActivations: [],
	profile: null,
	properties: [],
	clients: [],
	deals: [],
	courses: [],
	artifacts: [],
};

describe('runtime module registry', () => {
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

	it('lists known module entries and explains missing dependencies', () => {
		expect(
			listRuntimeModuleRegistryEntries().map((entry) => entry.moduleKey)
		).toContain('objects');

		render(
			<I18nextProvider i18n={pwI18n}>
				<ModulePanelRegistry
					entry={{} as RuntimeModuleRegistryEntry}
					moduleKey="objects"
					runtimeModule={{
						...baseRuntimeModule,
						config: { depends_on: ['profile'] },
					}}
					snapshot={baseSnapshot}
					verticalSlug="realtor"
				/>
			</I18nextProvider>
		);

		expect(
			screen.getByText(
				/"Listings": Enable required sections first: My profile./
			)
		).toBeInTheDocument();
	});
});

describe('SchemaDrivenForm', () => {
	it('renders schema fields and submits parsed values', async () => {
		const schema: ProfessionalRuntimeSchema = {
			id: 'schema-1',
			vertical_slug: 'realtor',
			schema_key: 'lead',
			version: 1,
			title: 'Lead schema',
			schema_json: {
				type: 'object',
				required: ['name'],
				properties: {
					name: { type: 'string', title: 'Name' },
					budget: { type: 'number', title: 'Budget' },
					stage: { type: 'string', enum: ['new', 'qualified'] },
				},
			},
			ui_schema: {},
			is_active: true,
			created_at: '2026-05-05T00:00:00Z',
			updated_at: '2026-05-05T00:00:00Z',
		};
		const onSubmit = vi.fn();
		render(
			withRuntimeComponentsI18n(
				<SchemaDrivenForm schema={schema} value={{}} onSubmit={onSubmit} />
			)
		);

		fireEvent.change(screen.getByLabelText(/Name/), {
			target: { value: 'Anna' },
		});
		fireEvent.change(screen.getByLabelText(/Budget/), {
			target: { value: '250000' },
		});
		fireEvent.change(screen.getByLabelText(/stage/i), {
			target: { value: 'qualified' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith({
				name: 'Anna',
				budget: 250000,
				stage: 'qualified',
			});
		});
	});
});

describe('AiActionLauncher', () => {
	it('builds a JSON payload and shows high-risk warning text', async () => {
		const onLaunch = vi.fn();
		render(
			withRuntimeComponentsI18n(
				<AiActionLauncher
					actions={[
						{
							module_key: 'objects',
							action_key: 'listing_quality',
							display_name: 'Listing quality',
							description: 'Audit listing.',
							input_schema: {},
							artifact_kind: 'audit',
							risk_level: 'high',
							sort_order: 0,
						},
					]}
					onLaunch={onLaunch}
				/>
			)
		);

		expect(screen.getByText('Action needs review')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Run action' }));

		await waitFor(() => {
			expect(onLaunch).toHaveBeenCalledWith(
				expect.objectContaining({ action_key: 'listing_quality' }),
				expect.objectContaining({ action_key: 'listing_quality' })
			);
		});
	});
});

describe('JobProgressStream', () => {
	it('parses SSE events and renders progress', () => {
		const events = parseProfessionalJobSseChunk(
			': keep-alive\n\nevent: progress\ndata: {"message":"Half done","percent":50}\n\n'
		);

		expect(events).toEqual([
			expect.objectContaining({ type: 'keep-alive' }),
			expect.objectContaining({ type: 'progress', message: 'Half done' }),
		]);
		render(
			withRuntimeComponentsI18n(<JobProgressStream events={events} active />)
		);

		expect(screen.getByText('Half done')).toBeInTheDocument();
		expect(screen.getByRole('progressbar')).toHaveAttribute(
			'aria-valuenow',
			'50'
		);
	});
});

describe('artifact and handoff runtime actions', () => {
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

	const property: RealtorProperty = {
		id: 'property-1',
		user_id: 'user-1',
		title: 'Ocean view apartment',
		property_type: 'flat',
		deal_type: 'sale',
		city: 'Vladivostok',
		district: null,
		address: null,
		price: '100',
		area_m2: '40',
		rooms: 1,
		floor: null,
		total_floors: null,
		view: null,
		infrastructure: [],
		jtbd_context: {},
		facts: {},
		status: 'draft',
		created_at: '2026-05-05T00:00:00Z',
		updated_at: '2026-05-05T00:00:00Z',
	};
	const artifact: ProfessionalArtifact = {
		id: 'artifact-1',
		vertical_slug: 'realtor',
		source_type: 'property',
		source_id: 'property-1',
		recipe_key: null,
		title: 'Listing text',
		content: 'Beautiful view.',
		artifact_data: {},
		unified_content_id: null,
		ugs_request_id: null,
		module_key: 'objects',
		artifact_kind: 'listing',
		created_at: '2026-05-05T00:00:00Z',
	};

	it('filters artifacts and exposes handoff submit action', async () => {
		const onCreateDraft = vi.fn();
		render(
			<I18nextProvider i18n={pwI18n}>
				<div className="grid gap-4">
					<ArtifactHub artifacts={[artifact]} properties={[property]} />
					<IntegrationHandoffPanel
						artifact={artifact}
						integrations={[
							makeRuntimeIntegration({
								id: '11111111-1111-4111-8111-111111111112',
								integration_key: 'ewrp',
								display_name: 'EWRP',
							}),
						]}
						onCreateDraft={onCreateDraft}
					/>
				</div>
			</I18nextProvider>
		);

		fireEvent.change(screen.getByLabelText('Filter results by tool'), {
			target: { value: 'objects' },
		});
		expect(screen.getAllByText('Listing text')).toHaveLength(2);
		fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

		await waitFor(() => {
			expect(onCreateDraft).toHaveBeenCalledWith({
				artifactId: 'artifact-1',
				destinationKey: 'ewrp',
				note: '',
			});
		});
	});
});

describe('RuntimeOnboardingWizard', () => {
	let pwWizardI18n: i18n;

	beforeAll(async () => {
		pwWizardI18n = i18next.createInstance();
		await pwWizardI18n.use(initReactI18next).init({
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

	it('maps completed steps back into onboarding state', async () => {
		const onPatchOnboarding = vi.fn();
		render(
			<I18nextProvider i18n={pwWizardI18n}>
				<RuntimeOnboardingWizard
					activation={{
						vertical_slug: 'realtor',
						is_active: true,
						onboarding: {},
						entitlements: {},
					}}
					runtimeConfig={null}
					vertical={{
						slug: 'realtor',
						name: 'Realtor',
						description: null,
						icon_key: 'home',
						profile_schema: {},
						workspace_template: {
							onboarding: {
								steps: [
									{ key: 'profile', title: 'Profile', description: 'Do it' },
								],
							},
						},
					}}
					onPatchOnboarding={onPatchOnboarding}
				/>
			</I18nextProvider>
		);

		expect(screen.getByText('Complete your profile')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Profile ready' }));

		await waitFor(() => {
			expect(onPatchOnboarding).toHaveBeenCalledWith({
				completed_steps: ['profile'],
			});
		});
	});
});
