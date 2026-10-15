/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock cold-open overlay Skip CTA and ritual line render.
 *
 * Related:
 * - ui/ChronicleColdOpen.tsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import en from '@/i18n/locales/en/emperyNexusChronicle.json';
import { ChronicleColdOpen } from '../ui/ChronicleColdOpen';

const coldI18n = i18n.createInstance();

beforeAll(async () => {
	await coldI18n.use(initReactI18next).init({
		lng: 'en',
		resources: { en: { [EMPERY_NEXUS_CHRONICLE_NS]: en } },
		ns: [EMPERY_NEXUS_CHRONICLE_NS],
		defaultNS: EMPERY_NEXUS_CHRONICLE_NS,
		interpolation: { escapeValue: false },
	});
});

describe('ChronicleColdOpen', () => {
	it('shows brand, ritual line, and Skip primary', async () => {
		const onSkip = vi.fn();
		render(
			<I18nextProvider i18n={coldI18n}>
				<ChronicleColdOpen lineKey="coldOpen.lineHusk" onSkip={onSkip} />
			</I18nextProvider>
		);
		expect(screen.getByTestId('empery-nexus-cold-open')).toHaveTextContent(
			'EMPERY'
		);
		expect(
			screen.getByText(/corporeal shell — paper, seals/)
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Skip ritual' }));
		expect(onSkip).toHaveBeenCalled();
	});
});
