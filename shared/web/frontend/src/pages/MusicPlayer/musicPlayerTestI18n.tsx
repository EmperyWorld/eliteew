/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest render helper with Russian `desktopUi` namespace for Music Player component tests.
 *
 * Invariants:
 * - Test-only; not imported from production Music Player surfaces.
 *
 * Related:
 * - src/pages/MusicPlayer/*test.tsx
 */

import { render, type RenderOptions } from '@testing-library/react';
import i18n from 'i18next';
import type { ReactElement } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ruDesktopUi from '../../i18n/locales/ru/desktopUi.json';

const musicPlayerTestI18n = i18n.createInstance();

void musicPlayerTestI18n.use(initReactI18next).init({
	lng: 'ru',
	fallbackLng: 'ru',
	resources: {
		ru: {
			desktopUi: ruDesktopUi,
		},
	},
	defaultNS: 'desktopUi',
	interpolation: { escapeValue: false },
});

export function renderMusicPlayer(
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>
) {
	return render(ui, {
		wrapper: ({ children }) => (
			<I18nextProvider i18n={musicPlayerTestI18n}>{children}</I18nextProvider>
		),
		...options,
	});
}
