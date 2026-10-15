/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for pre-run quota estimate display states in Professional Worlds desktop UI.
 *
 * Invariants:
 * - Pure presentation component; no HTTP in these tests.
 *
 * Related:
 * - components/ProfessionalWorldsQuotaEstimate.tsx
 */

import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { ProfessionalWorldsQuotaEstimate } from '../components/ProfessionalWorldsQuotaEstimate';

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		ns: [PROFESSIONAL_WORLDS_NS],
		defaultNS: PROFESSIONAL_WORLDS_NS,
		resources: {
			en: { [PROFESSIONAL_WORLDS_NS]: enProfessionalWorlds },
		},
	});
});

function renderEstimate(
	props: ComponentProps<typeof ProfessionalWorldsQuotaEstimate>
) {
	return render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalWorldsQuotaEstimate {...props} />
		</I18nextProvider>
	);
}

describe('ProfessionalWorldsQuotaEstimate', () => {
	it('shows loading copy', () => {
		renderEstimate({ loading: true });
		expect(screen.getByTestId('pw-quota-loading')).toHaveTextContent(
			/Checking credits/i
		);
	});

	it('shows degraded error copy', () => {
		renderEstimate({ error: 'network offline' });
		expect(screen.getByTestId('pw-quota-error')).toHaveTextContent(
			/Credit info is unavailable/i
		);
	});

	it('shows playbook estimate and low-balance warning', () => {
		renderEstimate({
			summary: {
				vertical_slug: 'realtor',
				credits_used_24h: 12,
				credits_balance: 3,
				playbook_estimates: [],
			},
			playbookEstimate: {
				playbook_key: 'realtor_property_content_pack',
				total_estimated_units: 1,
				total_ugs_credits: 8,
			},
		});

		expect(screen.getByTestId('pw-quota-estimate')).toHaveTextContent(
			/Estimated cost: ~8 credits/i
		);
		expect(screen.getByText(/balance may be too low/i)).toBeInTheDocument();
	});

	it('shows unknown estimate when playbook row has no credit hint', () => {
		renderEstimate({
			playbookEstimate: {
				playbook_key: 'realtor_property_content_pack',
				total_estimated_units: 0,
				total_ugs_credits: null,
			},
		});

		expect(screen.getByTestId('pw-quota-estimate')).toHaveTextContent(
			/Estimated cost is not available/i
		);
	});

	it('shows balance summary for AI action launcher mode', () => {
		renderEstimate({
			showBalanceSummary: true,
			summary: {
				vertical_slug: 'realtor',
				credits_used_24h: 4.5,
				credits_balance: 120,
				playbook_estimates: [],
			},
		});

		expect(screen.getByTestId('pw-quota-estimate')).toHaveTextContent(
			/Balance: 120 credits/i
		);
		expect(screen.getByTestId('pw-quota-estimate')).toHaveTextContent(
			/Used in 24h: 4\.50 credits/i
		);
	});
});
