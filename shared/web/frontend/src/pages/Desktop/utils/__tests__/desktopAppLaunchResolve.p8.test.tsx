/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P8 locks — catalog launch resolution and pending deep-link peek until ready.
 *
 * Related:
 * - utils/desktopAppRegistry.ts
 * - utils/pendingDesktopOpen.ts
 * - hooks/useLegacyPendingDesktopOpenEffect.ts
 */

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import { useLegacyPendingDesktopOpenEffect } from '../../hooks/useLegacyPendingDesktopOpenEffect';
import { resolveDesktopAppLaunchItem } from '../desktopAppRegistry';
import {
	PENDING_DESKTOP_OPEN_KEY,
	clearPendingDesktopOpen,
	peekPendingDesktopOpen,
	queuePendingDesktopOpen,
} from '../pendingDesktopOpen';

const catalogOnlyApp: DesktopItem = {
	id: 'app-catalog-only',
	name: 'Catalog Only',
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'CatalogOnlyApp',
};

describe('resolveDesktopAppLaunchItem (P8)', () => {
	it('prefers installed catalog when no desktop shortcut exists', () => {
		expect(
			resolveDesktopAppLaunchItem('CatalogOnlyApp', {
				items: [],
				installedApps: [catalogOnlyApp],
			})
		).toEqual(catalogOnlyApp);
	});

	it('falls back to DEFAULT_APPS when neither shortcut nor catalog has the app', () => {
		const resolved = resolveDesktopAppLaunchItem('ContentManagerPro', {
			items: [],
			installedApps: [],
		});
		expect(resolved?.appComponent).toBe('ContentManagerPro');
	});
});

describe('pendingDesktopOpen peek (P8)', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('peek preserves the queued intent until clear', () => {
		queuePendingDesktopOpen({
			kind: 'app',
			appComponent: 'ContentManagerPro',
		});
		expect(peekPendingDesktopOpen()).toEqual({
			kind: 'app',
			appComponent: 'ContentManagerPro',
		});
		expect(sessionStorage.getItem(PENDING_DESKTOP_OPEN_KEY)).toBeTruthy();
		clearPendingDesktopOpen();
		expect(peekPendingDesktopOpen()).toBeNull();
	});
});

function LegacyPendingHarness(props: {
	items: DesktopItem[];
	installedApps: DesktopItem[];
	installedAppIds: ReadonlySet<string>;
	installedAppsLoading: boolean;
	handleOpenWindow: (item: DesktopItem) => void;
}) {
	useLegacyPendingDesktopOpenEffect(props);
	return null;
}

describe('useLegacyPendingDesktopOpenEffect (P8)', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('keeps pending app open while installed catalog is loading', () => {
		const handleOpenWindow = vi.fn();
		queuePendingDesktopOpen({
			kind: 'app',
			appComponent: 'CatalogOnlyApp',
		});

		render(
			<LegacyPendingHarness
				items={[]}
				installedApps={[]}
				installedAppIds={new Set()}
				installedAppsLoading
				handleOpenWindow={handleOpenWindow}
			/>
		);

		expect(handleOpenWindow).not.toHaveBeenCalled();
		expect(peekPendingDesktopOpen()?.kind).toBe('app');
	});

	it('opens from installed catalog after load even without desktop shortcut', () => {
		const handleOpenWindow = vi.fn();
		queuePendingDesktopOpen({
			kind: 'app',
			appComponent: 'CatalogOnlyApp',
		});

		const { rerender } = render(
			<LegacyPendingHarness
				items={[]}
				installedApps={[]}
				installedAppIds={new Set()}
				installedAppsLoading
				handleOpenWindow={handleOpenWindow}
			/>
		);

		act(() => {
			rerender(
				<LegacyPendingHarness
					items={[]}
					installedApps={[catalogOnlyApp]}
					installedAppIds={new Set(['app-catalog-only'])}
					installedAppsLoading={false}
					handleOpenWindow={handleOpenWindow}
				/>
			);
		});

		expect(handleOpenWindow).toHaveBeenCalledTimes(1);
		expect(handleOpenWindow.mock.calls[0]?.[0]?.appComponent).toBe(
			'CatalogOnlyApp'
		);
		expect(peekPendingDesktopOpen()).toBeNull();
	});
});
