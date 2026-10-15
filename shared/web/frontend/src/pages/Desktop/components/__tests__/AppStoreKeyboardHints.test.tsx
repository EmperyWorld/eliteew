/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for AppStoreKeyboardHints — Esc hint variants + sentence-case rail title.
 *
 * Related:
 * - AppStoreKeyboardHints.tsx
 * - appStoreCompactCardUi.ts
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n/config';
import { appStoreRailOverlineLabelBlockClass } from '../../utils/appStoreCompactCardUi';
import { AppStoreKeyboardHints } from '../AppStoreKeyboardHints';

describe('AppStoreKeyboardHints', () => {
	it('shows Esc hint for page and modal variants', () => {
		const { rerender } = render(
			<AppStoreKeyboardHints
				t={((key: string) => key) as never}
				variant="page"
			/>
		);
		expect(screen.getByText('shortcuts.clearSearch')).toBeInTheDocument();
		expect(screen.queryByText('shortcuts.closeModal')).not.toBeInTheDocument();

		rerender(
			<AppStoreKeyboardHints
				t={((key: string) => key) as never}
				variant="modal"
			/>
		);
		expect(screen.getByText('shortcuts.closeModal')).toBeInTheDocument();
		expect(screen.queryByText('shortcuts.clearSearch')).not.toBeInTheDocument();
	});

	it('uses sentence-case rail title token (no uppercase shout)', () => {
		expect(appStoreRailOverlineLabelBlockClass).not.toMatch(/\buppercase\b/);
		expect(appStoreRailOverlineLabelBlockClass).toMatch(/tracking-normal/);

		render(
			<AppStoreKeyboardHints
				t={((key: string) => key) as never}
				variant="page"
			/>
		);
		expect(screen.getByText('shortcuts.title')).toBeTruthy();
	});
});
