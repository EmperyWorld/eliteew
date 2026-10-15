/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke test for collapsed support-details disclosure in Professional Worlds.
 *
 * Invariants:
 * - Default summary uses shared i18n key; custom summary overrides it.
 *
 * Related:
 * - SupportDetailsPanel.tsx
 */
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { SupportDetailsPanel } from './SupportDetailsPanel';

describe('SupportDetailsPanel', () => {
	it('renders default support summary from i18n', async () => {
		const i18n = i18next.createInstance();
		await i18n.use(initReactI18next).init({
			lng: 'en',
			fallbackLng: 'en',
			interpolation: { escapeValue: false },
			resources: {
				en: { [PROFESSIONAL_WORLDS_NS]: enProfessionalWorlds },
			},
			ns: [PROFESSIONAL_WORLDS_NS],
			defaultNS: PROFESSIONAL_WORLDS_NS,
		});

		render(
			<I18nextProvider i18n={i18n}>
				<SupportDetailsPanel>
					<span>support-body</span>
				</SupportDetailsPanel>
			</I18nextProvider>
		);

		expect(
			screen.getByText(enProfessionalWorlds.shared.supportDetails)
		).toBeInTheDocument();
	});
});
