/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock for single-tab gate — EN/RU copy and desktop-token surface (no acid dialect).
 *
 * Related:
 * - `BrowserSingleTabGateScreen.tsx`
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { initFollowerI18n } from '@/i18n/initFollowerI18n';
import i18n from 'i18next';
import { BrowserSingleTabGateScreen } from '../BrowserSingleTabGateScreen';

beforeAll(async () => {
	await initFollowerI18n();
});

afterEach(() => {
	cleanup();
});

function renderGate(
	ui: React.ReactElement,
	lng: 'en' | 'ru' = 'en'
): ReturnType<typeof render> {
	void i18n.changeLanguage(lng);
	return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('BrowserSingleTabGateScreen', () => {
	it('renders EN follower copy and take-leadership CTA', async () => {
		const onTake = vi.fn();
		renderGate(
			<BrowserSingleTabGateScreen
				mode="follower"
				contextLabel="EliteEW"
				onTakeLeadership={onTake}
			/>,
			'en'
		);
		expect(
			screen.getByRole('heading', {
				name: /EliteEW is already open in another tab/i,
			})
		).toBeInTheDocument();
		expect(
			screen.getByTestId('browser-single-tab-follower')
		).toBeInTheDocument();
		await userEvent.click(
			screen.getByTestId('browser-single-tab-take-leadership')
		);
		expect(onTake).toHaveBeenCalledTimes(1);
	});

	it('renders RU handoff waiting without primary CTA', async () => {
		renderGate(<BrowserSingleTabGateScreen mode="handoffWaiting" />, 'ru');
		expect(
			screen.getByRole('heading', {
				name: /Ожидание ответа на другой вкладке/i,
			})
		).toBeInTheDocument();
		expect(
			screen.queryByTestId('browser-single-tab-take-leadership')
		).not.toBeInTheDocument();
		expect(
			screen.getByTestId('browser-single-tab-handoff')
		).toBeInTheDocument();
	});

	it('applies desktop design tokens on root style', () => {
		renderGate(<BrowserSingleTabGateScreen mode="handoffWaiting" />, 'en');
		const root = screen.getByTestId('browser-single-tab-handoff');
		expect(root.style.getPropertyValue('--desktop-text-primary')).toBe(
			'#f8fafc'
		);
		expect(root.style.getPropertyValue('--desktop-accent-rgb')).toMatch(
			/\d+ \d+ \d+/
		);
	});
});
