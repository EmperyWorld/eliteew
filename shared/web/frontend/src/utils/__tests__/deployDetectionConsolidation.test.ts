/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock deploy detection on staleBundleReload — versionCheck must not second-reload; circuit breaker respected.
 *
 * Invariants:
 * - Build mismatch triggers staleBundleReload path only once per deploy id.
 * - reloadCircuitBreaker ledger blocks further auto reloads.
 *
 * Related:
 * - `utils/staleBundleReload.ts`, `services/versionCheck.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../appBuildId', () => ({
	getAppBuildId: vi.fn(() => 'bundle-build-v1'),
}));

vi.mock('../../services/api', () => ({
	apiClient: {
		get: vi.fn(),
	},
	APIError: class APIError extends Error {
		statusCode: number;
		constructor(message: string, statusCode: number) {
			super(message);
			this.statusCode = statusCode;
		}
	},
}));

vi.mock('../authRedirect', () => ({
	isInteractiveLoginInFlight: vi.fn(() => false),
}));

vi.mock('../../services/maintenance/recoveryNotificationGuard', () => ({
	publishUnplannedMaintenanceFromHttpError: vi.fn(),
}));

vi.mock('../../services/keycloak', () => ({
	hasPendingAuthorizationCallbackInUrl: vi.fn(() => false),
}));

vi.mock('../mountEliteImperativeOverlay', () => ({
	mountEliteRecoveryOverlay: vi.fn(),
	mountEliteTechnicalOverlay: vi.fn(),
}));

vi.mock('../reactAppLifecycle', () => ({
	detachAppReactRoot: vi.fn(),
}));

import { getAppBuildId } from '../appBuildId';
import {
	reloadAllAppTabs,
	resetReloadCooldownForTests,
	startDeployVersionWatcher,
} from '../staleBundleReload';
import versionCheckService from '../../services/versionCheck';
import {
	recordAutoReload,
	resetReloadCircuitForTests,
	shouldBlockAutoReload,
} from '../../services/maintenance/reloadCircuitBreaker';
import { clearMaintenanceStatus } from '../../services/maintenance/maintenanceState';

describe('deploy detection consolidation', () => {
	const locationReplace = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		clearMaintenanceStatus();
		resetReloadCircuitForTests();
		resetReloadCooldownForTests();
		localStorage.clear();
		sessionStorage.clear();

		vi.stubGlobal('location', {
			...window.location,
			href: 'https://app.eliteew.ru/#/desktop',
			replace: locationReplace,
		});
	});

	afterEach(() => {
		versionCheckService.stopAutoCheck();
		vi.unstubAllGlobals();
	});

	describe('versionCheck read-only path', () => {
		it('handleUpdate does not hard-navigate on server version change', async () => {
			await versionCheckService.handleUpdate({
				version: '2.0.0',
				buildHash: 'new-hash',
			});

			expect(locationReplace).not.toHaveBeenCalled();
		});

		it('needsUpdate sync does not hard-navigate on server version change', async () => {
			localStorage.setItem('app_version', '1.0.0');
			localStorage.setItem('app_build_hash', 'old-hash');

			vi.spyOn(versionCheckService, 'checkVersion').mockResolvedValue({
				version: '2.0.0',
				buildHash: 'new-hash',
			});

			versionCheckService.startAutoCheck();
			await vi.waitFor(() =>
				expect(localStorage.getItem('app_build_hash')).toBe('new-hash')
			);

			expect(locationReplace).not.toHaveBeenCalled();
		});
	});

	describe('staleBundleReload deploy watcher', () => {
		it('startDeployVersionWatcher reloads once on boot bundle mismatch in prod', async () => {
			vi.stubEnv('PROD', true);
			vi.mocked(getAppBuildId).mockReturnValue('stale-bundle-v1');

			vi.stubGlobal(
				'fetch',
				vi.fn(async () => ({
					ok: true,
					text: async () => 'server-deploy-v2',
				}))
			);

			startDeployVersionWatcher();

			await vi.waitFor(() => expect(locationReplace).toHaveBeenCalledTimes(1));
			expect(locationReplace.mock.calls[0]?.[0]).toContain(
				'_eliteew_reason=bundle_build_mismatch'
			);
		});

		it('respects reload circuit breaker after budget exceeded', async () => {
			recordAutoReload('chunk_load_failure');
			recordAutoReload('deploy_version_changed');
			expect(shouldBlockAutoReload('bundle_build_mismatch')).toBe(true);

			vi.mocked(getAppBuildId).mockReturnValue('stale-bundle-v1');
			reloadAllAppTabs('bundle_build_mismatch');

			await new Promise((resolve) => window.setTimeout(resolve, 0));
			expect(locationReplace).not.toHaveBeenCalled();
		});
	});
});
