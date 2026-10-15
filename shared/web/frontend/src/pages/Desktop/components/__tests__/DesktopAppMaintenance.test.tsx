/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render test for per-app maintenance screen i18n keys.
 *
 * Invariants:
 * - Default title/labels come from `desktopUi.appMaintenance`.
 *
 * Related:
 * - `DesktopAppMaintenance.tsx`
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopAppMaintenance } from '../DesktopAppMaintenance';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, opts?: { name?: string; count?: number }) => {
				if (key === 'defaultTitle' && opts?.name) {
					return `defaultTitle:${opts.name}`;
				}
				return key;
			},
		}),
	};
});

describe('DesktopAppMaintenance', () => {
	it('renders default maintenance copy from i18n keys', () => {
		render(<DesktopAppMaintenance />);

		expect(screen.getByText('defaultTitle:defaultAppName')).toBeInTheDocument();
		expect(screen.getByText('fallbackBody')).toBeInTheDocument();
		expect(screen.getByText('footnote')).toBeInTheDocument();
	});

	it('prefers catalog maintenance title when provided', () => {
		render(
			<DesktopAppMaintenance
				initialPayload={{
					maintenance_title: 'Scheduled upgrade',
					maintenanceAppName: 'Music Player',
				}}
			/>
		);

		expect(screen.getByText('Scheduled upgrade')).toBeInTheDocument();
	});
});
