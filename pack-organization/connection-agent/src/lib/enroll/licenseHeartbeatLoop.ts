/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-session license heartbeat kill-switch while product WebView is open.
 *
 * Invariants:
 * - Definitive license/device denies close the product WebView.
 * - Transient network / 5xx do not kill (avoid offline blip closing desk).
 * - Poll interval stays under API rate limit (~10/min per IP per purpose).
 */

import { licenseHeartbeat } from './licensePreflight';
import { productCloseForLicenseKillSwitch } from '../tauri-bridge/commands';

/** NCR-005: worst-case deny latency while product is open (was 30s). */
export const LICENSE_HEARTBEAT_INTERVAL_MS = 10_000;

/** Debounce visibility wake vs interval tick (avoid burst under rate limit). */
const MIN_HEARTBEAT_GAP_MS = 3_000;

const KILL_CODES = new Set([
	'license_expired',
	'license_revoked',
	'device_revoked',
	'device_required',
	'fingerprint_required',
	'device_conflict',
	'not_found',
	'license_denied',
]);

let timer: ReturnType<typeof setInterval> | null = null;
let onVisibilityChange: (() => void) | null = null;
let lastHeartbeatAt = 0;
let tickInFlight = false;

export function stopLicenseHeartbeat(): void {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
	if (onVisibilityChange && typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', onVisibilityChange);
	}
	onVisibilityChange = null;
	lastHeartbeatAt = 0;
	tickInFlight = false;
}

function shouldKillOnDeny(code: string): boolean {
	if (KILL_CODES.has(code)) return true;
	if (code === 'network_error') return false;
	if (code.startsWith('http_5')) return false;
	if (code === 'rate_limited' || code === 'http_429') return false;
	// Unknown definitive HTTP 4xx from gate → fail closed.
	return code.startsWith('http_4');
}

export function startLicenseHeartbeat(opts: {
	enrollBase: string;
	licenseId: string;
	deviceId?: string | null;
	machineFingerprint?: string | null;
	onDeny: (code: string, message: string) => void;
}): void {
	stopLicenseHeartbeat();

	const runTick = async (force = false) => {
		const now = Date.now();
		if (!force && now - lastHeartbeatAt < MIN_HEARTBEAT_GAP_MS) {
			return;
		}
		if (tickInFlight) {
			return;
		}
		tickInFlight = true;
		lastHeartbeatAt = now;
		try {
			const r = await licenseHeartbeat(opts.enrollBase, {
				licenseId: opts.licenseId,
				deviceId: opts.deviceId,
				machineFingerprint: opts.machineFingerprint,
			});
			if (!r.ok) {
				if (!shouldKillOnDeny(r.code)) {
					return;
				}
				stopLicenseHeartbeat();
				try {
					await productCloseForLicenseKillSwitch();
				} catch {
					/* ignore */
				}
				opts.onDeny(r.code, r.message);
			}
		} finally {
			tickInFlight = false;
		}
	};

	void runTick(true);
	timer = setInterval(() => {
		void runTick();
	}, LICENSE_HEARTBEAT_INTERVAL_MS);

	if (typeof document !== 'undefined') {
		onVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				void runTick();
			}
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
	}
}
