/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JWT-skip license preflight / heartbeat before Start and while product WebView is open.
 *
 * Invariants:
 * - In Tauri: native egress (SOCKS when W-transport on) — not WebView fetch.
 * - Fail-closed on expired/revoked/not_found/device_revoked.
 * - IPC/ACL reject is not mapped to network_error («нет связи с сервером»).
 * - No PII expected in response.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import {
	PRODUCT_CHANNEL_DOWN_RU,
} from '../tunnel/productChannelPreflight';
import {
	isTauriRuntime,
	licenseHeartbeatNative,
	licensePreflightNative,
} from '../tauri-bridge/commands';

export type LicenseGatePayload = {
	licenseId: string;
	deviceId?: string | null;
	machineFingerprint?: string | null;
};

export type LicenseGateResult =
	| {
			ok: true;
			expiresAt: string | null;
			allowOnline: boolean | null;
			allowFofline: boolean | null;
			allowOffline: boolean | null;
	  }
	| { ok: false; code: string; message: string };

function humanizeCode(code: string): string {
	switch (code) {
		case 'license_expired':
			return 'Срок лицензии истёк';
		case 'license_revoked':
			return 'Доступ отозван';
		case 'device_revoked':
			return 'Устройство отозвано';
		case 'device_required':
			return 'Нужна привязка устройства';
		case 'fingerprint_required':
		case 'device_conflict':
			return 'Устройство не совпадает с лицензией';
		case 'not_found':
			return 'Лицензия не найдена';
		case 'w_transport_proxy_required':
			return PRODUCT_CHANNEL_DOWN_RU;
		case 'network_error':
			return 'Нужна проверка лицензии — нет связи с сервером';
		default:
			return 'Проверка лицензии не пройдена';
	}
}

function mapNativeView(
	view: Awaited<ReturnType<typeof licensePreflightNative>>
): LicenseGateResult {
	if (!view.ok) {
		const code = view.code || 'license_denied';
		return {
			ok: false,
			code,
			message: view.message?.trim() || humanizeCode(code),
		};
	}
	return {
		ok: true,
		expiresAt: view.expires_at ?? null,
		allowOnline: view.allow_online ?? null,
		allowFofline: view.allow_fofline ?? null,
		allowOffline: view.allow_offline ?? null,
	};
}

function invokeErrorText(err: unknown): string {
	if (typeof err === 'string') {
		return err;
	}
	if (err instanceof Error) {
		return err.message;
	}
	if (err && typeof err === 'object' && 'message' in err) {
		const message = (err as { message?: unknown }).message;
		if (typeof message === 'string') {
			return message;
		}
	}
	return '';
}

/** IPC never left the seat — must not be shown as «нет связи с сервером». */
function mapInvokeFailure(err: unknown): LicenseGateResult {
	const raw = invokeErrorText(err);
	if (/not allowed|forbidden|capability|\bacl\b/i.test(raw)) {
		return {
			ok: false,
			code: 'ipc_capability_denied',
			message:
				'Проверка лицензии недоступна в этой версии приложения. Установите обновление и повторите.',
		};
	}
	return {
		ok: false,
		code: 'license_gate_ipc_failed',
		message: 'Проверка лицензии не выполнена. Повторите попытку.',
	};
}

async function postLicenseGate(
	enrollBase: string,
	path: 'preflight' | 'heartbeat',
	payload: LicenseGatePayload
): Promise<LicenseGateResult> {
	if (isTauriRuntime()) {
		try {
			const native =
				path === 'preflight'
					? await licensePreflightNative(payload)
					: await licenseHeartbeatNative(payload);
			return mapNativeView(native);
		} catch (err) {
			return mapInvokeFailure(err);
		}
	}
	const base = enrollBase.replace(/\/$/, '');
	const url = `${base}/api/v1/desktop-client/license/${path}`;
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({
				license_id: payload.licenseId,
				device_id: payload.deviceId || null,
				machine_fingerprint: payload.machineFingerprint || null,
			}),
		});
		let body: {
			ok?: boolean;
			code?: string;
			expires_at?: string | null;
			allow_online?: boolean | null;
			allow_fofline?: boolean | null;
			allow_offline?: boolean | null;
			detail?: { code?: string; message?: string } | string;
		} = {};
		try {
			body = (await res.json()) as typeof body;
		} catch {
			/* ignore */
		}
		if (!res.ok) {
			const detail =
				body.detail && typeof body.detail === 'object' ? body.detail : null;
			const code = detail?.code || body.code || `http_${res.status}`;
			return {
				ok: false,
				code,
				message: humanizeCode(code),
			};
		}
		if (body.ok !== true) {
			const code = body.code || 'license_denied';
			return { ok: false, code, message: humanizeCode(code) };
		}
		return {
			ok: true,
			expiresAt: body.expires_at ?? null,
			allowOnline: body.allow_online ?? null,
			allowFofline: body.allow_fofline ?? null,
			allowOffline: body.allow_offline ?? null,
		};
	} catch {
		return {
			ok: false,
			code: 'network_error',
			message: humanizeCode('network_error'),
		};
	}
}

export function licensePreflight(
	enrollBase: string,
	payload: LicenseGatePayload
): Promise<LicenseGateResult> {
	return postLicenseGate(enrollBase, 'preflight', payload);
}

export function licenseHeartbeat(
	enrollBase: string,
	payload: LicenseGatePayload
): Promise<LicenseGateResult> {
	return postLicenseGate(enrollBase, 'heartbeat', payload);
}
