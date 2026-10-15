/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for desktopNative license bind query capture + assert fail-closed.
 *
 * Invariants:
 * - Missing licenseId on native profile → skip assert without logout (Wave 2).
 * - Assert body may omit device_id when only license is known.
 *
 * Related:
 * - services/desktopClient/desktopClientSessionAssert.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DESKTOP_DEVICE_ID_KEY,
	DESKTOP_DEVICE_QUERY,
	DESKTOP_LICENSE_ID_KEY,
	DESKTOP_LICENSE_QUERY,
	assertDesktopClientSessionIfNeeded,
	captureDesktopNativeLicenseBindFromUrl,
} from '../desktopClientSessionAssert';
import type {
	EmperyDesktopNativeOidc,
	WindowWithEmperyDesktopNativeOidc,
} from '@/services/keycloakDesktopNativeOidc';

function desktopNativeWindow(): WindowWithEmperyDesktopNativeOidc {
	return window as unknown as WindowWithEmperyDesktopNativeOidc;
}

function installDesktopNativeOidcBridge(bridge: EmperyDesktopNativeOidc): void {
	desktopNativeWindow().EmperyDesktopNativeOidc = bridge;
}

function clearDesktopNativeOidcBridge(): void {
	delete desktopNativeWindow().EmperyDesktopNativeOidc;
}

vi.mock('@/services/keycloakProfile', () => ({
	getOidcRuntimeProfile: vi.fn(() => 'desktopNative'),
}));

vi.mock('@/services/api', () => ({
	api: {
		post: vi.fn(),
	},
}));

vi.mock('@/services/authSession', () => ({
	logout: vi.fn(async () => undefined),
}));

describe('captureDesktopNativeLicenseBindFromUrl', () => {
	afterEach(() => {
		sessionStorage.clear();
		window.history.replaceState(null, '', '/');
	});

	it('persists license/device ids and strips query params', () => {
		const url = new URL(window.location.href);
		url.searchParams.set(DESKTOP_LICENSE_QUERY, 'lic-aaa');
		url.searchParams.set(DESKTOP_DEVICE_QUERY, 'dev-bbb');
		url.searchParams.set('eliteewDesktopClient', '1');
		window.history.replaceState(null, '', url.toString());

		captureDesktopNativeLicenseBindFromUrl();

		expect(sessionStorage.getItem(DESKTOP_LICENSE_ID_KEY)).toBe('lic-aaa');
		expect(sessionStorage.getItem(DESKTOP_DEVICE_ID_KEY)).toBe('dev-bbb');
		const cleaned = new URL(window.location.href);
		expect(cleaned.searchParams.get(DESKTOP_LICENSE_QUERY)).toBeNull();
		expect(cleaned.searchParams.get(DESKTOP_DEVICE_QUERY)).toBeNull();
		expect(cleaned.searchParams.get('eliteewDesktopClient')).toBe('1');
	});
});

describe('assertDesktopClientSessionIfNeeded', () => {
	afterEach(() => {
		sessionStorage.clear();
		vi.clearAllMocks();
	});

	it('skips assert without logout when native profile has no license id (Wave 2)', async () => {
		const { logout } = await import('@/services/authSession');
		const { api } = await import('@/services/api');
		const result = await assertDesktopClientSessionIfNeeded();
		expect(result).toEqual({
			ok: true,
			claimed: false,
		});
		expect(logout).not.toHaveBeenCalled();
		expect(api.post).not.toHaveBeenCalled();
	});

	it('posts license-only assert when device id missing', async () => {
		const { api } = await import('@/services/api');
		vi.mocked(api.post).mockResolvedValueOnce({ ok: true, claimed: false });
		sessionStorage.setItem(DESKTOP_LICENSE_ID_KEY, 'lic-only');

		const result = await assertDesktopClientSessionIfNeeded();
		expect(result).toEqual({ ok: true, claimed: false });
		expect(api.post).toHaveBeenCalledWith(
			'/api/v1/desktop-client/session/assert',
			{
				license_id: 'lic-only',
				channel: 'desktop',
			}
		);
	});

	it('fail-closes on license_expired', async () => {
		const { api } = await import('@/services/api');
		const { logout } = await import('@/services/authSession');
		vi.mocked(api.post).mockRejectedValueOnce({
			response: {
				data: {
					detail: { code: 'license_expired', message: 'License expired' },
				},
			},
		});
		sessionStorage.setItem(DESKTOP_LICENSE_ID_KEY, 'lic-x');
		sessionStorage.setItem(DESKTOP_DEVICE_ID_KEY, 'dev-x');

		const result = await assertDesktopClientSessionIfNeeded();
		expect(result?.ok).toBe(false);
		if (result && !result.ok) {
			expect(result.code).toBe('license_expired');
		}
		expect(logout).toHaveBeenCalled();
	});

	it('skips leftover assert when the host native OIDC bridge is present', async () => {
		const { api } = await import('@/services/api');
		sessionStorage.setItem(DESKTOP_LICENSE_ID_KEY, 'lic-leftover');
		installDesktopNativeOidcBridge({
			getBootstrapJson: () => JSON.stringify({ token: 'access' }),
		});
		try {
			const result = await assertDesktopClientSessionIfNeeded();
			expect(result).toEqual({ ok: true, claimed: false });
			expect(api.post).not.toHaveBeenCalled();
		} finally {
			clearDesktopNativeOidcBridge();
		}
	});
});
