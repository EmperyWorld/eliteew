/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest harness for ContentManagerPro smoke tests without full desktop shell.
 *
 * Related:
 * - ContentManagerPro.smoke.test.tsx
 */
import * as React from 'react';
import { I18nextProvider } from 'react-i18next';
import { render, type RenderOptions } from '@testing-library/react';
import i18n from '../../../i18n/config';

export function CmProTestHarness({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function renderWithCmProHarness(
	ui: React.ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>
) {
	return render(ui, {
		wrapper: CmProTestHarness,
		...options,
	});
}
