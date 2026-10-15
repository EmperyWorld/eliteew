/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Product WebView bridge for read-only host link snapshot (taskbar chip).
 *
 * Invariants:
 * - Product class is not this function. Tauri link IPC requires `hasTauriInvoke()`.
 *   EmpiierOS uses `window.EmperyDesktopNetworkLink` (no addresses).
 * - Payload is kind + active only — never treat browser reachability as physical link.
 * - Failures degrade to unavailable (active=false), chip stays visible.
 *
 * Related:
 * - pack-organization/connection-agent host_network_link_snapshot
 * - TaskbarNetworkLinkChip.tsx
 */

import { getOidcRuntimeProfile } from '@/services/keycloakProfile';
import { hasTauriInvoke } from '@/services/desktopClient/eliteewProductHost';

export type HostLinkKind = 'ethernet' | 'wifi' | 'modem';

export type HostLinkSnapshotView = {
	ok: boolean;
	code: string;
	message: string;
	kind: HostLinkKind | null;
	active: boolean;
};

type TauriInternals = {
	invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

type EmpiierosNetworkLink = {
	getLinkSnapshot: () => Promise<unknown>;
};

function empiierosNetworkLink(): EmpiierosNetworkLink | null {
	if (typeof window === 'undefined' || hasTauriInvoke()) {
		return null;
	}
	const api = (
		window as Window & { EmperyDesktopNetworkLink?: EmpiierosNetworkLink }
	).EmperyDesktopNetworkLink;
	if (!api || typeof api.getLinkSnapshot !== 'function') {
		return null;
	}
	return api;
}

/** OS tray order: associated Wi-Fi, else a carrier-up ethernet. No addresses. */
export function hostLinkFromEmpiierosPayload(
	raw: unknown
): HostLinkSnapshotView {
	let row: unknown = raw;
	if (typeof raw === 'string') {
		try {
			row = JSON.parse(raw) as unknown;
		} catch {
			return unavailableHostLinkSnapshot('invalid_result');
		}
	}
	if (!row || typeof row !== 'object') {
		return unavailableHostLinkSnapshot('invalid_result');
	}
	const record = row as Record<string, unknown>;
	const kindRaw = record.kind;
	const kind = kindRaw === 'ethernet' || kindRaw === 'wifi' ? kindRaw : null;
	const active = record.active === true && kind !== null;
	if (record.ok !== true || kind === null) {
		return unavailableHostLinkSnapshot('unavailable');
	}
	return {
		ok: true,
		code: 'ok',
		message: '',
		kind,
		active,
	};
}

/** Tauri link snapshot only. EmpiierOS without invoke degrades; chip stays mounted. */
export function isEliteewNativeDesktopProductShell(): boolean {
	const profile = getOidcRuntimeProfile();
	if (profile !== 'desktopNative' && profile !== 'foflineNative') {
		return false;
	}
	return hasTauriInvoke();
}

export function unavailableHostLinkSnapshot(
	code = 'unavailable',
	message = ''
): HostLinkSnapshotView {
	return {
		ok: false,
		code,
		message,
		kind: null,
		active: false,
	};
}

function parseSnapshot(raw: unknown): HostLinkSnapshotView {
	if (!raw || typeof raw !== 'object') {
		return unavailableHostLinkSnapshot('invalid_result');
	}
	const row = raw as Record<string, unknown>;
	const kindRaw = row.kind;
	let kind: HostLinkKind | null = null;
	if (kindRaw === 'ethernet' || kindRaw === 'wifi' || kindRaw === 'modem') {
		kind = kindRaw;
	}
	return {
		ok: row.ok === true,
		code: typeof row.code === 'string' ? row.code : 'unknown',
		message: typeof row.message === 'string' ? row.message : '',
		kind,
		active: row.active === true,
	};
}

/** Poll host link for taskbar. Tauri snapshot, or the EmpiierOS seat snapshot. */
export async function fetchHostLinkSnapshot(): Promise<HostLinkSnapshotView> {
	if (typeof window === 'undefined') {
		return unavailableHostLinkSnapshot('not_native_shell');
	}
	const osLink = empiierosNetworkLink();
	if (osLink) {
		try {
			return hostLinkFromEmpiierosPayload(await osLink.getLinkSnapshot());
		} catch {
			return unavailableHostLinkSnapshot('invoke_failed');
		}
	}
	if (!isEliteewNativeDesktopProductShell()) {
		return unavailableHostLinkSnapshot('not_native_shell');
	}
	const internals = (
		window as Window & { __TAURI_INTERNALS__?: TauriInternals }
	).__TAURI_INTERNALS__;
	if (!internals) {
		return unavailableHostLinkSnapshot('no_tauri');
	}
	try {
		return parseSnapshot(await internals.invoke('host_network_link_snapshot'));
	} catch {
		return unavailableHostLinkSnapshot('invoke_failed');
	}
}
