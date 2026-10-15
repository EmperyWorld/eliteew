/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for install-profile client filters used by Start/catalog.
 *
 * Related:
 * - ../desktopInstallProfileFilter.ts
 */

import { describe, expect, it } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	filterDesktopItemsByInstallProfile,
	filterStoreAppsByInstallProfile,
	isAppComponentEnabledByInstallProfile,
	isInstallProfileExemptAppComponent,
} from '../desktopInstallProfileFilter';
import { resolveDesktopAppLaunchItem } from '../desktopAppRegistry';

const item = (id: string, appComponent: string): DesktopItem =>
	({
		id,
		name: id,
		type: 'app',
		appComponent,
		position: { x: 0, y: 0 },
	}) as DesktopItem;

describe('desktopInstallProfileFilter', () => {
	it('passes through when enabled is null', () => {
		const apps = [{ app_component: 'MarketingCabinet' }];
		expect(filterStoreAppsByInstallProfile(apps, null)).toEqual(apps);
		expect(
			filterDesktopItemsByInstallProfile([item('m', 'MarketingCabinet')], null)
		).toHaveLength(1);
		expect(
			isAppComponentEnabledByInstallProfile('MarketingCabinet', null)
		).toBe(true);
	});

	it('filters by enabled set', () => {
		const enabled = new Set(['NotificationsApp', 'AppStore']);
		expect(
			filterStoreAppsByInstallProfile(
				[
					{ app_component: 'NotificationsApp' },
					{ app_component: 'MarketingCabinet' },
				],
				enabled
			)
		).toEqual([{ app_component: 'NotificationsApp' }]);
		expect(
			filterDesktopItemsByInstallProfile(
				[item('n', 'NotificationsApp'), item('m', 'MarketingCabinet')],
				enabled
			).map((a) => a.id)
		).toEqual(['n']);
		expect(
			isAppComponentEnabledByInstallProfile('MarketingCabinet', enabled)
		).toBe(false);
	});

	it('keeps shell-only DesktopShellSettings launchable when not in profile', () => {
		const enabled = new Set(['NotificationsApp']);
		expect(
			isAppComponentEnabledByInstallProfile('DesktopShellSettings', enabled)
		).toBe(true);
		expect(isInstallProfileExemptAppComponent('DesktopShellSettings')).toBe(
			true
		);
		expect(
			filterDesktopItemsByInstallProfile(
				[
					item('settings', 'DesktopShellSettings'),
					item('m', 'MarketingCabinet'),
				],
				enabled
			).map((a) => a.id)
		).toEqual(['settings']);
	});
});

describe('resolveDesktopAppLaunchItem + install profile', () => {
	it('denies DEFAULT_APPS fallback when profile disables component', () => {
		const enabled = new Set(['NotificationsApp']);
		expect(
			resolveDesktopAppLaunchItem('MarketingCabinet', {
				items: [],
				installedApps: [],
				enabledAppComponents: enabled,
			})
		).toBeUndefined();
	});

	it('allows when profile includes component', () => {
		const enabled = new Set(['NotificationsApp']);
		const installed = [item('app-notifications', 'NotificationsApp')];
		expect(
			resolveDesktopAppLaunchItem('NotificationsApp', {
				items: [],
				installedApps: installed,
				enabledAppComponents: enabled,
			})?.appComponent
		).toBe('NotificationsApp');
	});

	it('resolves DesktopShellSettings from DEFAULT_APPS even when absent from profile', () => {
		const enabled = new Set(['NotificationsApp']);
		const resolved = resolveDesktopAppLaunchItem('DesktopShellSettings', {
			items: [],
			installedApps: [],
			enabledAppComponents: enabled,
		});
		expect(resolved?.appComponent).toBe('DesktopShellSettings');
	});
});
