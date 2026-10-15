/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * a11y regression for EW Family banner info trigger.
 *
 * Related:
 * - `EwFamilyBannerMessage.tsx`
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EwFamilyBannerMessage } from '../EwFamilyBannerMessage';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
		Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
	};
});

describe('EwFamilyBannerMessage', () => {
	it('toggles info popover and exposes aria-expanded / aria-controls on the trigger', () => {
		render(<EwFamilyBannerMessage />);
		const btn = screen.getByRole('button', {
			name: 'infoAria',
		});
		expect(btn).toHaveAttribute('aria-expanded', 'false');

		fireEvent.click(btn);
		expect(btn).toHaveAttribute('aria-expanded', 'true');
		const controls = btn.getAttribute('aria-controls');
		expect(controls).toBeTruthy();
		const panel = document.getElementById(controls ?? '');
		expect(panel).not.toBeNull();
	});
});
