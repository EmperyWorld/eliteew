/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for stale bundle reload deferral during OIDC callback and maintenance windows.
 *
 * Invariants:
 * - Automatic stale-bundle reloads defer while recovery UX owns the page.
 *
 * Related:
 * - `utils/staleBundleReload.ts`
 * - `services/maintenance/maintenanceState.ts`
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../appBuildId', () => ({
	getAppBuildId: vi.fn(() => 'old-build-id'),
}));

vi.mock('../authRedirect', () => ({
	isInteractiveLoginInFlight: vi.fn(() => false),
}));

vi.mock('../../services/maintenance/recoveryNotificationGuard', () => ({
	publishUnplannedMaintenanceFromHttpError: vi.fn(),
}));

vi.mock('../../services/keycloak', () => ({
	hasPendingAuthorizationCallbackInUrl: vi.fn(() => false),
	isAuthenticated: vi.fn(() => true),
	keycloak: {},
}));

vi.mock('../../services/maintenance/reloadCircuitBreaker', () => ({
	shouldBlockAutoReload: vi.fn(() => false),
	isReloadHoldActive: vi.fn(() => false),
	isBackendReadyForRecovery: vi.fn(async () => true),
	clearReloadCircuitWhenHealthy: vi.fn(async () => true),
	RECOVERY_HOLD_OVERLAY_ID: 'eliteew-recovery-hold-overlay',
	resetReloadCircuitForTests: vi.fn(),
}));

vi.mock('../mountEliteImperativeOverlay', () => ({
	mountEliteRecoveryOverlay: vi.fn(),
	mountEliteTechnicalOverlay: vi.fn(
		(_id: string, props: { onAction?: () => void }) => {
			const el = document.createElement('div');
			el.id = 'eliteew-stale-bundle-overlay';
			el.textContent = 'Приложение обновлено';
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.addEventListener('click', () => props.onAction?.());
			el.appendChild(btn);
			document.body.appendChild(el);
			return el;
		}
	),
}));

import { getAppBuildId } from '../appBuildId';
import { isInteractiveLoginInFlight } from '../authRedirect';
import {
	isBundleBuildMismatch,
	markMaintenanceCompletionReload,
	bundleMatchesServerBuild,
	reloadAllAppTabs,
	requestMaintenanceReturn,
	DESKTOP_SOFT_RECOVERY_EVENT,
	resetReloadCooldownForTests,
	resetStaleBundleReloadModuleStateForTests,
	shouldDeferStaleBundleReload,
	STALE_BUNDLE_OVERLAY_ID,
} from '../staleBundleReload';
import { hasPendingAuthorizationCallbackInUrl } from '../../services/keycloak';
import {
	clearMaintenanceStatus,
	publishMaintenanceStatus,
} from '../../services/maintenance/maintenanceState';
import { resetReloadCircuitForTests } from '../../services/maintenance/reloadCircuitBreaker';

describe('staleBundleReload OAuth deferral', () => {
	beforeEach(() => {
		vi.mocked(hasPendingAuthorizationCallbackInUrl).mockReturnValue(false);
		vi.mocked(isInteractiveLoginInFlight).mockReturnValue(false);
		clearMaintenanceStatus();
		resetReloadCircuitForTests();
		resetStaleBundleReloadModuleStateForTests();
		sessionStorage.clear();
		resetReloadCooldownForTests();
		vi.stubGlobal('location', { ...window.location, replace: vi.fn() });
	});

	it('defers while OIDC callback params are in URL', () => {
		vi.mocked(hasPendingAuthorizationCallbackInUrl).mockReturnValue(true);
		expect(shouldDeferStaleBundleReload()).toBe(true);
	});

	it('defers while interactive login redirect is in flight', () => {
		vi.mocked(isInteractiveLoginInFlight).mockReturnValue(true);
		expect(shouldDeferStaleBundleReload()).toBe(true);
	});

	it('does not defer on normal desktop load', () => {
		expect(shouldDeferStaleBundleReload()).toBe(false);
	});

	it('defers while maintenance is active', () => {
		publishMaintenanceStatus({
			active: true,
			window: {
				id: 'restart-1',
				phase: 'active',
				active: true,
			},
		});

		expect(shouldDeferStaleBundleReload()).toBe(true);
	});
});

describe('staleBundleReload bundle mismatch one-shot', () => {
	const serverBuild = 'server-build-v2';

	beforeEach(() => {
		clearMaintenanceStatus();
		resetReloadCircuitForTests();
		resetStaleBundleReloadModuleStateForTests();
		sessionStorage.clear();
		resetReloadCooldownForTests();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				text: async () => serverBuild,
			}))
		);
		vi.stubGlobal('location', {
			...window.location,
			href: 'https://app.eliteew.ru/#/desktop',
			replace: vi.fn(),
		});
		document.body.innerHTML = '<div id="root"></div>';
	});

	it('clears mismatch reload marker when bundle matches server', () => {
		vi.mocked(getAppBuildId).mockReturnValue(serverBuild);
		sessionStorage.setItem('eliteew_bundle_mismatch_reload_v1', serverBuild);
		expect(bundleMatchesServerBuild(serverBuild)).toBe(true);
		isBundleBuildMismatch(serverBuild);
		expect(sessionStorage.getItem('eliteew_bundle_mismatch_reload_v1')).toBe(
			null
		);
	});

	it('reloads once for bundle mismatch then shows manual UI', async () => {
		vi.mocked(getAppBuildId).mockReturnValue('stale-build-v1');
		const replace = vi.mocked(window.location.replace);

		reloadAllAppTabs('bundle_build_mismatch');
		await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));

		replace.mockClear();
		reloadAllAppTabs('bundle_build_mismatch');
		await vi.waitFor(() =>
			expect(
				document.getElementById(STALE_BUNDLE_OVERLAY_ID)?.textContent
			).toContain('Приложение обновлено')
		);
		expect(replace).not.toHaveBeenCalled();
	});

	it('does not hard reload for bundle mismatch while maintenance is active', async () => {
		vi.mocked(getAppBuildId).mockReturnValue('stale-build-v1');
		const replace = vi.mocked(window.location.replace);
		publishMaintenanceStatus({
			active: true,
			window: {
				id: 'restart-1',
				phase: 'active',
				active: true,
			},
		});

		reloadAllAppTabs('bundle_build_mismatch');
		await new Promise((resolve) => window.setTimeout(resolve, 0));

		expect(replace).not.toHaveBeenCalled();
		expect(document.getElementById(STALE_BUNDLE_OVERLAY_ID)).toBeNull();
	});

	it('allows the maintenance completion reload when bundle is stale', async () => {
		vi.mocked(getAppBuildId).mockReturnValue('stale-build-v1');
		const replace = vi.mocked(window.location.replace);
		publishMaintenanceStatus({
			active: true,
			window: {
				id: 'restart-1',
				phase: 'active',
				active: true,
			},
		});

		reloadAllAppTabs('maintenance_completed');
		await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
		expect(replace.mock.calls[0]?.[0]).toContain(
			'_eliteew_reason=maintenance_completed'
		);
	});

	it('skips hard reload after maintenance when bundle already matches server', async () => {
		vi.mocked(getAppBuildId).mockReturnValue(serverBuild);
		const replace = vi.mocked(window.location.replace);

		reloadAllAppTabs('maintenance_completed');
		await new Promise((resolve) => window.setTimeout(resolve, 50));

		expect(replace).not.toHaveBeenCalled();
	});

	it('skips stale reload reasons when bundle already matches server', async () => {
		vi.mocked(getAppBuildId).mockReturnValue(serverBuild);
		const replace = vi.mocked(window.location.replace);

		reloadAllAppTabs('client_stale_socket');
		await new Promise((resolve) => window.setTimeout(resolve, 50));

		expect(replace).not.toHaveBeenCalled();
	});

	it('requestMaintenanceReturn on desktop dispatches soft recovery instead of reload', () => {
		window.location.hash = '#desktop';
		const handler = vi.fn();
		window.addEventListener(DESKTOP_SOFT_RECOVERY_EVENT, handler);
		const replace = vi.mocked(window.location.replace);

		requestMaintenanceReturn('maintenance_completed');

		expect(handler).toHaveBeenCalledTimes(1);
		expect(replace).not.toHaveBeenCalled();
		window.removeEventListener(DESKTOP_SOFT_RECOVERY_EVENT, handler);
	});

	it('rate-limits rapid auto reload attempts', async () => {
		vi.mocked(getAppBuildId).mockReturnValue('stale-build-v1');
		const replace = vi.mocked(window.location.replace);

		reloadAllAppTabs('client_stale_socket');
		await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
		replace.mockClear();

		reloadAllAppTabs('client_stale_socket');
		await new Promise((resolve) => window.setTimeout(resolve, 0));
		expect(replace).not.toHaveBeenCalled();
	});

	it('marks maintenance completion reload once per window id', () => {
		sessionStorage.clear();
		expect(markMaintenanceCompletionReload('restart-1')).toBe(true);
		expect(markMaintenanceCompletionReload('restart-1')).toBe(false);
		expect(markMaintenanceCompletionReload('restart-2')).toBe(true);
	});

	it('manual refresh button triggers hard navigation reload', async () => {
		vi.mocked(getAppBuildId).mockReturnValue('stale-build-v1');
		const replace = vi.mocked(window.location.replace);

		reloadAllAppTabs('bundle_build_mismatch');
		await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
		replace.mockClear();

		document.body.innerHTML =
			'<div id="app-preloader"></div><div id="root"></div>';
		reloadAllAppTabs('bundle_build_mismatch');
		await vi.waitFor(() =>
			expect(
				document
					.getElementById(STALE_BUNDLE_OVERLAY_ID)
					?.querySelector('button')
			).toBeTruthy()
		);
		expect(document.getElementById('app-preloader')).toBeNull();

		const button = document
			.getElementById(STALE_BUNDLE_OVERLAY_ID)
			?.querySelector('button');
		button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
		expect(replace.mock.calls[0]?.[0]).toContain('_eliteew_reload=');
	});
});
