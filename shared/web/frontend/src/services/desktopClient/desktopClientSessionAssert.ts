/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * After empery-desktop / empery-fofline OIDC, assert license↔account bind for native shells.
 *
 * Invariants:
 * - No-op when profile is not desktopNative/foflineNative.
 * - Wave 2: missing bind ids skip assert without logout (Start URL no longer carries them).
 *   Leftover sessionStorage ids still post session/assert until enforce cutover.
 *   Wave 4: host `EmperyDesktopNativeOidc` skip leftover assert (API PEP is the gate).
 * - Fail-closed logout on gate codes (mismatch / expired / revoked / not_found / channel denied).
 * - deviceId optional: Capsule seats may lack device row; license expiry/email still gate.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §8 / W2
 * - api/routers/desktop_client/license.py session/assert
 */

import { api } from '@/services/api';
import { logout } from '@/services/authSession';
import { hasDesktopNativeOidcBridge } from '@/services/keycloakDesktopNativeOidc';
import { getOidcRuntimeProfile } from '@/services/keycloakProfile';

export const DESKTOP_LICENSE_ID_KEY = 'eliteew.desktopNative.licenseId.v1';
export const DESKTOP_DEVICE_ID_KEY = 'eliteew.desktopNative.deviceId.v1';
export const DESKTOP_LICENSE_QUERY = 'eliteewLicenseId';
export const DESKTOP_DEVICE_QUERY = 'eliteewDeviceId';

export type SessionAssertChannel = 'desktop' | 'fofline';

export type SessionAssertResult =
	| { ok: true; claimed: boolean }
	| { ok: false; code: string; message: string };

export function captureDesktopNativeLicenseBindFromUrl(): void {
	if (typeof window === 'undefined') return;
	try {
		const url = new URL(window.location.href);
		const licenseId = (
			url.searchParams.get(DESKTOP_LICENSE_QUERY) || ''
		).trim();
		const deviceId = (url.searchParams.get(DESKTOP_DEVICE_QUERY) || '').trim();
		if (licenseId) {
			sessionStorage.setItem(DESKTOP_LICENSE_ID_KEY, licenseId);
		}
		if (deviceId) {
			sessionStorage.setItem(DESKTOP_DEVICE_ID_KEY, deviceId);
		}
		if (licenseId || deviceId) {
			url.searchParams.delete(DESKTOP_LICENSE_QUERY);
			url.searchParams.delete(DESKTOP_DEVICE_QUERY);
			window.history.replaceState(null, '', url.toString());
		}
	} catch {
		/* ignore */
	}
}

function readBindIds(): { licenseId: string; deviceId: string | null } | null {
	try {
		const licenseId = (
			sessionStorage.getItem(DESKTOP_LICENSE_ID_KEY) || ''
		).trim();
		const deviceId = (
			sessionStorage.getItem(DESKTOP_DEVICE_ID_KEY) || ''
		).trim();
		if (!licenseId) return null;
		return { licenseId, deviceId: deviceId || null };
	} catch {
		return null;
	}
}

function assertChannelForProfile(): SessionAssertChannel | null {
	const profile = getOidcRuntimeProfile();
	if (profile === 'desktopNative') return 'desktop';
	if (profile === 'foflineNative') return 'fofline';
	return null;
}

const FAIL_CLOSED_CODES = new Set([
	'license_user_mismatch',
	'online_not_allowed',
	'fofline_not_allowed',
	'license_revoked',
	'license_expired',
	'not_found',
	'revoked',
	'email_required',
]);

async function failClosedLogout(
	code: string,
	message: string
): Promise<SessionAssertResult> {
	if (FAIL_CLOSED_CODES.has(code)) {
		try {
			await logout();
		} catch {
			/* ignore */
		}
	}
	return { ok: false, code, message };
}

export async function assertDesktopClientSessionIfNeeded(): Promise<SessionAssertResult | null> {
	const channel = assertChannelForProfile();
	if (!channel) {
		return null;
	}
	if (hasDesktopNativeOidcBridge()) {
		// Wave 4: host-owned OIDC + API PEP. Leftover bind ids are not the gate.
		return { ok: true, claimed: false };
	}
	const ids = readBindIds();
	if (!ids) {
		// Wave 2: bind ids are no longer in the Start URL. Ticket/SPI (Wave 3)
		// is the gate. Do not logout — that would force the URL leak back.
		return { ok: true, claimed: false };
	}
	try {
		const body: {
			license_id: string;
			device_id?: string;
			channel: SessionAssertChannel;
		} = {
			license_id: ids.licenseId,
			channel,
		};
		if (ids.deviceId) {
			body.device_id = ids.deviceId;
		}
		const res = await api.post<{
			ok: boolean;
			claimed?: boolean;
		}>('/api/v1/desktop-client/session/assert', body);
		return { ok: true, claimed: Boolean(res.claimed) };
	} catch (err) {
		const detail = (err as { response?: { data?: { detail?: unknown } } })
			?.response?.data?.detail;
		let code = 'assert_failed';
		let message = 'Не удалось подтвердить лицензию для этого аккаунта';
		if (detail && typeof detail === 'object' && detail !== null) {
			const d = detail as { code?: string; message?: string };
			if (d.code) code = d.code;
			if (d.message) message = d.message;
		}
		return failClosedLogout(code, message);
	}
}
