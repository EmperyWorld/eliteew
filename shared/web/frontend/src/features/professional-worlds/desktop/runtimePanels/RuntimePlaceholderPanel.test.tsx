/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Professional Worlds runtime placeholder guidance.
 *
 * Invariants:
 * - Placeholder modules must explain useful next steps instead of exposing only module keys.
 *
 * Related:
 * - RuntimePlaceholderPanel.tsx
 */

import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import type { RuntimeModuleRegistryEntry } from '../runtimeModuleRegistry';
import type { ProfessionalWorldsSnapshot } from '../types';
import RuntimePlaceholderPanel from './RuntimePlaceholderPanel';

let placeholderI18n: i18n;

beforeAll(async () => {
	placeholderI18n = i18next.createInstance();
	await placeholderI18n.use(initReactI18next).init({
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

describe('RuntimePlaceholderPanel', () => {
	it('shows actionable placeholder guidance', () => {
		render(
			<I18nextProvider i18n={placeholderI18n}>
				<RuntimePlaceholderPanel
					entry={
						{
							moduleKey: 'profile',
							label: 'Profile',
							description: '',
							panelKind: 'placeholder',
							panel: null,
						} as unknown as RuntimeModuleRegistryEntry
					}
					runtimeModule={null}
					snapshot={emptySnapshot}
					verticalSlug="realtor"
				/>
			</I18nextProvider>
		);

		expect(screen.getByText('What you can do now')).toBeInTheDocument();
		expect(screen.getByText(/Fill in your profile/)).toBeInTheDocument();
		expect(screen.queryByText('profile')).not.toBeInTheDocument();
	});
});
