/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../reactAppLifecycle', () => ({
	detachAppReactRoot: vi.fn(),
}));

vi.mock('../mountEliteImperativeOverlay', () => ({
	mountEliteRecoveryOverlay: vi.fn(),
}));

vi.mock('../appPreloader', () => ({
	hideBlockingAppPreloader: vi.fn(),
}));

vi.mock('../../services/maintenance/recoveryNotificationGuard', () => ({
	publishUnplannedMaintenanceFromHttpError: vi.fn(),
}));

vi.mock('../../services/maintenance/maintenanceState', () => ({
	getCurrentMaintenanceStatus: vi.fn(() => ({ active: false, window: null })),
}));

import { detachAppReactRoot } from '../reactAppLifecycle';
import { publishUnplannedMaintenanceFromHttpError } from '../../services/maintenance/recoveryNotificationGuard';
import { showRecoveryHoldOverlay } from '../staleBundleReload';

describe('showRecoveryHoldOverlay desktop route', () => {
	it('does not detach React root on #desktop', () => {
		window.location.hash = '#desktop';
		showRecoveryHoldOverlay();
		expect(detachAppReactRoot).not.toHaveBeenCalled();
		expect(publishUnplannedMaintenanceFromHttpError).toHaveBeenCalledWith(
			503,
			30
		);
	});

	it('detaches React root on non-desktop routes', () => {
		window.location.hash = '#admin';
		showRecoveryHoldOverlay();
		expect(detachAppReactRoot).toHaveBeenCalled();
	});
});
