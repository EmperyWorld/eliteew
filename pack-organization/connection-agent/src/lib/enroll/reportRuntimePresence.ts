/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * POST /api/v1/desktop-client/runtime/presence from native launcher (Admin Users heartbeat).
 *
 * Invariants:
 * - Requires license_id + device_id (active device pair); OIDC optional.
 * - Failures are best-effort (log via return code); never block shell.
 *
 * Related:
 * - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
 */

export type RuntimePresencePayload = {
	licenseId: string;
	deviceId: string;
	appVersion: string;
	wgUp: boolean | null;
	peerSlug?: string | null;
	buildChannel: 'rpm' | 'nsis' | 'unknown';
	updaterPubkeyBaked: boolean;
};

export type RuntimePresenceResult =
	| { ok: true }
	| { ok: false; code: string; message: string };

export async function reportRuntimePresence(params: {
	enrollBase: string;
	payload: RuntimePresencePayload;
	accessToken?: string | null;
}): Promise<RuntimePresenceResult> {
	const base = params.enrollBase.replace(/\/$/, '');
	const url = `${base}/api/v1/desktop-client/runtime/presence`;
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	};
	const token = (params.accessToken || '').trim();
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				license_id: params.payload.licenseId,
				device_id: params.payload.deviceId,
				app_version: params.payload.appVersion,
				wg_up: params.payload.wgUp,
				peer_slug: params.payload.peerSlug || null,
				build_channel: params.payload.buildChannel,
				integrity: {
					updater_pubkey_baked: params.payload.updaterPubkeyBaked,
					authenticode: false,
				},
			}),
		});
		if (!res.ok) {
			let code = `http_${res.status}`;
			let message = res.statusText;
			try {
				const body = (await res.json()) as {
					detail?: { code?: string; message?: string } | string;
				};
				if (body.detail && typeof body.detail === 'object') {
					code = body.detail.code || code;
					message = body.detail.message || message;
				}
			} catch {
				/* ignore */
			}
			return { ok: false, code, message };
		}
		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			code: 'network_error',
			message: err instanceof Error ? err.message : String(err),
		};
	}
}

export function detectBuildChannel(): 'rpm' | 'nsis' | 'unknown' {
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	if (/Windows/i.test(ua)) return 'nsis';
	if (/Linux/i.test(ua)) return 'rpm';
	return 'unknown';
}
