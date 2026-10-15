/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for the Professional Worlds bottom AI output rail.
 *
 * Invariants:
 * - Status-only messages do not create a bottom output panel.
 * - Generated text still renders in the matching active workspace lane.
 *
 * Related:
 * - ProfessionalWorldsAiOutputRail.tsx
 * ---
 */

import { render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsWorkspaceContextValue,
} from '../ProfessionalWorldsWorkspaceContext';
import { ProfessionalWorldsAiOutputRail } from './ProfessionalWorldsAiOutputRail';

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

function renderRail(
	overrides: Partial<ProfessionalWorldsWorkspaceContextValue> = {}
) {
	const value = {
		activeView: 'properties',
		listingStream: { text: '', status: '' },
		brandStream: { text: '', status: '' },
		learningStream: { text: '', status: '' },
		copyLane: vi.fn(),
		...overrides,
	} as unknown as ProfessionalWorldsWorkspaceContextValue;

	render(
		<I18nextProvider i18n={pwI18n}>
			<ProfessionalWorldsWorkspaceProvider value={value}>
				<ProfessionalWorldsAiOutputRail />
			</ProfessionalWorldsWorkspaceProvider>
		</I18nextProvider>
	);
}

describe('ProfessionalWorldsAiOutputRail', () => {
	it('does not render a bottom output panel for status-only listing messages', () => {
		renderRail({
			listingStream: {
				text: '',
				status: 'Parsing finished',
			},
		});

		expect(screen.queryByText('AI output')).not.toBeInTheDocument();
		expect(screen.queryByText('Parsing finished')).not.toBeInTheDocument();
	});

	it('renders generated text for the active listing lane', () => {
		renderRail({
			listingStream: {
				text: 'Generated listing description',
				status: 'Generation complete',
			},
		});

		expect(screen.getByText('AI output')).toBeInTheDocument();
		expect(screen.getByText('Generation complete')).toBeInTheDocument();
		expect(
			screen.getByText('Generated listing description')
		).toBeInTheDocument();
	});
});
