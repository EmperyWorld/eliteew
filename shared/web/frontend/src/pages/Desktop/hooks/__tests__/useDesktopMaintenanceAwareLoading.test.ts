import { describe, expect, it } from 'vitest';
import type { MaintenancePhase } from '@/services/maintenance/maintenanceState';
import { shouldDeferDesktopLoadingToMaintenance } from '../useDesktopMaintenanceAwareLoading';

function windowStatus(phase: MaintenancePhase) {
	return {
		active: true,
		window: {
			id: 'test',
			kind: 'stack0_restart' as const,
			phase,
			active: true,
			notice_before_seconds: 0,
			retry_after_seconds: 30,
			title: 'Restart',
			message: 'Wait',
			affected_services: [] as string[],
			user_impact: '',
			suppress_error_toasts: true,
			block_new_long_jobs: true,
			allow_operator_bypass: false,
		},
	};
}

describe('shouldDeferDesktopLoadingToMaintenance', () => {
	it('defers during draining and active gate phases', () => {
		expect(
			shouldDeferDesktopLoadingToMaintenance(windowStatus('draining'))
		).toBe(true);
		expect(shouldDeferDesktopLoadingToMaintenance(windowStatus('active'))).toBe(
			true
		);
	});

	it('defers during recovering phase', () => {
		expect(
			shouldDeferDesktopLoadingToMaintenance(windowStatus('recovering'))
		).toBe(true);
	});

	it('does not defer for scheduled warning only', () => {
		expect(
			shouldDeferDesktopLoadingToMaintenance(windowStatus('warning'))
		).toBe(false);
	});

	it('does not defer when maintenance inactive', () => {
		expect(
			shouldDeferDesktopLoadingToMaintenance({ active: false, window: null })
		).toBe(false);
	});
});
