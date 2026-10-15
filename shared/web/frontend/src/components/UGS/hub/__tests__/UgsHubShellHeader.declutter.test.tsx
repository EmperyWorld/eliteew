/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock UGS Hub header declutter: no rival Elite Dashboard CTA / brand chrome.
 * Asserts RU i18n shell strings via ugsHub namespace.
 *
 * Related:
 * - ../shell/UgsHubShellHeader.tsx
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 */

import { fireEvent, render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import type { ComponentProps } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import ruUgsHub from '@/i18n/locales/ru/ugsHub.json';
import { UGS_HUB_NS } from '@/i18n/namespaces';

import { UgsHubShellHeader } from '../shell/UgsHubShellHeader';

let hubI18n: i18n;

beforeAll(async () => {
	hubI18n = i18next.createInstance();
	await hubI18n.use(initReactI18next).init({
		lng: 'ru',
		fallbackLng: 'ru',
		ns: [UGS_HUB_NS],
		defaultNS: UGS_HUB_NS,
		resources: {
			ru: { [UGS_HUB_NS]: ruUgsHub },
		},
	});
});

function renderHeader(
	props: Partial<ComponentProps<typeof UgsHubShellHeader>> = {}
) {
	const onNavigate = props.onNavigate ?? vi.fn();
	return {
		onNavigate,
		...render(
			<I18nextProvider i18n={hubI18n}>
				<UgsHubShellHeader
					onNavigate={onNavigate}
					isOnline
					updateIndicator={false}
					pollIntervalSeconds={60}
					lastUpdated={new Date('2026-05-28T00:00:00Z')}
					isBusy={false}
					onManualRefresh={vi.fn()}
					providerHealth={[]}
					{...props}
				/>
			</I18nextProvider>
		),
	};
}

describe('UgsHubShellHeader declutter', () => {
	it('keeps analytics as secondary text action under status refresh', () => {
		const { onNavigate } = renderHeader();

		expect(
			screen.getByRole('heading', { name: ruUgsHub.shell.title })
		).toBeTruthy();
		expect(screen.getByText(ruUgsHub.shell.subtitle)).toBeTruthy();
		expect(screen.queryByText('Elite Dashboard')).toBeNull();
		expect(screen.queryByText('UGS Dashboard')).toBeNull();
		expect(screen.queryByText(/EliteEW/i)).toBeNull();

		const analytics = screen.getByRole('button', {
			name: ruUgsHub.shell.analyticsLink,
		});
		expect(analytics.className).toMatch(/text-xs/);
		fireEvent.click(analytics);
		expect(onNavigate).toHaveBeenCalledWith('ugs-analytics');
	});
});
