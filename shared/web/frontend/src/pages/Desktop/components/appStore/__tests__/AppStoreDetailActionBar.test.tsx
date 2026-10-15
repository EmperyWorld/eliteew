/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock App Store detail action bar gates: install disabled when busy /
 * !allowInstall; uninstall blocked aria/tooltip when cannotUninstall.
 *
 * Related:
 * - ../AppStoreDetailActionBar.tsx
 */

import { render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { AppStoreDetailActionBar } from '../AppStoreDetailActionBar';
import { storeAppFixture } from './storeAppFixture';

const t = ((key: string) => key) as TFunction<'appStore'>;

const baseProps = {
	t,
	cannotUninstall: false,
	uninstallBlockedTitle: 'Blocked: factory',
	allowInstall: true,
	installPrimaryLabel: 'Install',
	inMaintenance: false,
	maintenanceHint: 'maintenance hint',
	busy: false,
	busyAction: null as null,
	busyLabel: 'Working…',
	handleInstall: vi.fn(),
	handleOpenInstalled: vi.fn(),
};

describe('AppStoreDetailActionBar', () => {
	it('disables install when busy', () => {
		render(
			<AppStoreDetailActionBar
				{...baseProps}
				detail={storeAppFixture({
					app_id: 'notes',
					name: 'Notes',
					installed: false,
				})}
				busy
				busyAction="install"
			/>
		);
		expect(screen.getByRole('button', { name: 'inProgress' })).toBeDisabled();
	});

	it('disables install when !allowInstall', () => {
		render(
			<AppStoreDetailActionBar
				{...baseProps}
				detail={storeAppFixture({
					app_id: 'notes',
					name: 'Notes',
					installed: false,
				})}
				allowInstall={false}
			/>
		);
		expect(
			screen.getByRole('button', { name: 'installVerb Notes' })
		).toBeDisabled();
	});

	it('blocks uninstall with title in aria when cannotUninstall', () => {
		render(
			<AppStoreDetailActionBar
				{...baseProps}
				detail={storeAppFixture({
					app_id: 'factory-app',
					name: 'Factory',
					installed: true,
					is_factory: true,
				})}
				cannotUninstall
				uninstallBlockedTitle="Blocked: factory"
			/>
		);
		const btn = screen.getByRole('button', { name: 'Blocked: factory' });
		expect(btn).toBeDisabled();
		expect(btn).toHaveAttribute('aria-label', 'Blocked: factory');
	});
});
