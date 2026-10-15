/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Heartbeat kill-switch — definitive deny vs transient network.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../tauri-bridge/commands', () => ({
	productCloseForLicenseKillSwitch: vi.fn(async () => true),
}));

vi.mock('./licensePreflight', () => ({
	licenseHeartbeat: vi.fn(),
}));

import { licenseHeartbeat } from './licensePreflight';
import { productCloseForLicenseKillSwitch } from '../tauri-bridge/commands';
import {
	LICENSE_HEARTBEAT_INTERVAL_MS,
	startLicenseHeartbeat,
	stopLicenseHeartbeat,
} from './licenseHeartbeatLoop';

const okHeartbeat = {
	ok: true as const,
	expiresAt: null,
	allowOnline: true,
	allowFofline: false,
	allowOffline: false,
};

describe('licenseHeartbeatLoop', () => {
	afterEach(() => {
		stopLicenseHeartbeat();
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	it('does not kill on network_error', async () => {
		vi.mocked(licenseHeartbeat).mockResolvedValue({
			ok: false,
			code: 'network_error',
			message: 'Нужна проверка лицензии — нет связи с сервером',
		});
		const onDeny = vi.fn();
		startLicenseHeartbeat({
			enrollBase: 'https://example.test',
			licenseId: '11111111-1111-1111-1111-111111111111',
			onDeny,
		});
		await vi.waitFor(() => {
			expect(licenseHeartbeat).toHaveBeenCalled();
		});
		expect(productCloseForLicenseKillSwitch).not.toHaveBeenCalled();
		expect(onDeny).not.toHaveBeenCalled();
	});

	it('kills on license_revoked', async () => {
		vi.mocked(licenseHeartbeat).mockResolvedValue({
			ok: false,
			code: 'license_revoked',
			message: 'Доступ отозван',
		});
		const onDeny = vi.fn();
		startLicenseHeartbeat({
			enrollBase: 'https://example.test',
			licenseId: '11111111-1111-1111-1111-111111111111',
			machineFingerprint: 'fp-1',
			onDeny,
		});
		await vi.waitFor(() => {
			expect(onDeny).toHaveBeenCalledWith('license_revoked', 'Доступ отозван');
		});
		expect(productCloseForLicenseKillSwitch).toHaveBeenCalled();
		expect(licenseHeartbeat).toHaveBeenCalledWith(
			'https://example.test',
			expect.objectContaining({
				machineFingerprint: 'fp-1',
			})
		);
	});

	it('polls on LICENSE_HEARTBEAT_INTERVAL_MS (NCR-005)', async () => {
		vi.useFakeTimers();
		vi.mocked(licenseHeartbeat).mockResolvedValue(okHeartbeat);
		startLicenseHeartbeat({
			enrollBase: 'https://example.test',
			licenseId: '11111111-1111-1111-1111-111111111111',
			onDeny: vi.fn(),
		});
		await Promise.resolve();
		expect(licenseHeartbeat).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(LICENSE_HEARTBEAT_INTERVAL_MS);
		await Promise.resolve();
		expect(licenseHeartbeat).toHaveBeenCalledTimes(2);
	});
});
