/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for cross-app draft links panel list, refresh, and open actions.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import * as api from '../api';
import { CrossAppDraftLinksPanel } from './CrossAppDraftLinksPanel';

vi.mock('../api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../api')>();
	return {
		...actual,
		listProfessionalCrossAppDraftLinks: vi.fn(),
		refreshProfessionalCrossAppDraft: vi.fn(),
	};
});

vi.mock('../ProfessionalToast', () => {
	const notifySuccess = vi.fn();
	const notifyApiError = vi.fn();
	return {
		useProfessionalToasts: () => ({
			notifySuccess,
			notifyApiError,
			notifyJobEvent: vi.fn(),
		}),
	};
});

vi.mock('../openProfessionalDraftDestination', () => ({
	openProfessionalDraftDestination: vi.fn(() => true),
}));

const presentationLabel = enProfessionalWorlds.crossAppDrafts.destinations.ewrp;

const sampleLink = {
	id: '11111111-1111-4111-8111-111111111111',
	user_id: '22222222-2222-4222-8222-222222222222',
	vertical_slug: 'realtor',
	draft_kind: 'ewrp',
	artifact_id: '33333333-3333-4333-8333-333333333333',
	lifecycle_state: 'created',
	is_stale: true,
	stale_hint: 'Listing price changed',
	created_at: '2026-06-21T10:00:00Z',
	updated_at: '2026-06-21T10:00:00Z',
};

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

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(api.listProfessionalCrossAppDraftLinks).mockResolvedValue([
		sampleLink,
	]);
	vi.mocked(api.refreshProfessionalCrossAppDraft).mockResolvedValue({
		...sampleLink,
		lifecycle_state: 'opened',
	});
});

function renderPanel() {
	return render(
		<I18nextProvider i18n={pwI18n}>
			<CrossAppDraftLinksPanel
				artifacts={[
					{
						id: sampleLink.artifact_id ?? '',
						vertical_slug: 'realtor',
						source_type: 'realtor_property',
						source_id: 'p1',
						title: 'Listing pitch',
						content: 'Body',
						module_key: 'listing',
						artifact_kind: 'text',
						created_at: '',
					},
				]}
			/>
		</I18nextProvider>
	);
}

describe('CrossAppDraftLinksPanel', () => {
	it('loads and renders draft link with stale hint', async () => {
		renderPanel();
		expect(await screen.findByText(presentationLabel)).toBeInTheDocument();
		expect(screen.getByText('Listing pitch')).toBeInTheDocument();
		expect(screen.getByText('Listing price changed')).toBeInTheDocument();
	});

	it('refreshes link lifecycle on button click', async () => {
		renderPanel();
		await screen.findByText(presentationLabel);
		fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
		await waitFor(() => {
			expect(api.refreshProfessionalCrossAppDraft).toHaveBeenCalledWith(
				sampleLink.id
			);
		});
		expect(await screen.findByText('Opened')).toBeInTheDocument();
	});

	it('passes stale_check_property_id and supports draft recreation', async () => {
		const onRecreateHandoff = vi.fn();
		render(
			<I18nextProvider i18n={pwI18n}>
				<CrossAppDraftLinksPanel
					artifacts={[]}
					staleCheckPropertyId="prop-1"
					onRecreateHandoff={onRecreateHandoff}
				/>
			</I18nextProvider>
		);
		await screen.findByText(presentationLabel);
		expect(api.listProfessionalCrossAppDraftLinks).toHaveBeenCalledWith({
			stale_check_property_id: 'prop-1',
		});
		fireEvent.click(screen.getByRole('button', { name: 'Recreate draft' }));
		expect(onRecreateHandoff).toHaveBeenCalledWith({
			artifactId: sampleLink.artifact_id,
			draftKind: sampleLink.draft_kind,
			propertyId: null,
		});
	});
});
