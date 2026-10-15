/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock help overlay open/close copy for Empery Nexus Chronicle.
 *
 * Related:
 * - ui/ChronicleHelpOverlay.tsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import en from '@/i18n/locales/en/emperyNexusChronicle.json';
import { ChronicleHelpOverlay } from '../ui/ChronicleHelpOverlay';

const helpI18n = i18n.createInstance();

beforeAll(async () => {
	await helpI18n.use(initReactI18next).init({
		lng: 'en',
		resources: { en: { [EMPERY_NEXUS_CHRONICLE_NS]: en } },
		ns: [EMPERY_NEXUS_CHRONICLE_NS],
		defaultNS: EMPERY_NEXUS_CHRONICLE_NS,
		interpolation: { escapeValue: false },
	});
});

describe('ChronicleHelpOverlay', () => {
	it('renders nothing when closed', () => {
		const { container } = render(
			<I18nextProvider i18n={helpI18n}>
				<ChronicleHelpOverlay open={false} onClose={vi.fn()} />
			</I18nextProvider>
		);
		expect(container).toBeEmptyDOMElement();
	});

	it('shows keyboard legend and closes', async () => {
		const onClose = vi.fn();
		render(
			<I18nextProvider i18n={helpI18n}>
				<ChronicleHelpOverlay open onClose={onClose} />
			</I18nextProvider>
		);
		expect(screen.getByTestId('empery-nexus-help')).toHaveTextContent(
			'Chronicle controls'
		);
		expect(screen.getByText(/Hide HUD for immersion/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onClose).toHaveBeenCalled();
	});
});
