/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build APP_BASE Start URL with desktopNative or FoFline bootstrap query
 * (Wave 4 · 1A / FoFline W2) + L3 local SPA pack cutover resolver + L5
 * remote-SPA deny assert (pack-ready precedence).
 *
 * Invariants:
 * - Cloud Start always sets eliteewDesktopClient=1 for empery-desktop profile detection.
 * - FoFline Start sets eliteewFoflineClient=1 (never eliteewDesktopClient) for empery-fofline.
 * - Product default when pack ready = local fofline-spa:// origin; remote only via explicit fallback.
 * - Pack ready never yields remote product SPA URL (L5 — no silent public downgrade).
 * - Wave 2: Start URL builders ignore license/device opts (Rust ticket owns bind).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §5 / W2 / L3 / L5
 */

import { FORBIDDEN_START_URL_QUERY_PARAMS } from './atomicConditionalAccessContract';

/** Canonical local pack origin (Tauri custom protocol). Win may rewrite Origin to http://fofline-spa.localhost. */
export const FOFLINE_LOCAL_SPA_ORIGIN = 'fofline-spa://localhost';

export type FoflineStartCutoverKind = 'local' | 'remote' | 'blocked';

export type FoflineStartCutover = {
	kind: FoflineStartCutoverKind;
	url?: string;
	code?: string;
};

export type FoflineStartUrlAssert = { ok: true } | { ok: false; code: string };

function stripForbiddenStartQuery(url: URL): void {
	for (const param of FORBIDDEN_START_URL_QUERY_PARAMS) {
		url.searchParams.delete(param);
	}
	url.searchParams.delete('ticket');
	url.searchParams.delete('login_hint');
}

export function buildProductStartUrl(
	appBase: string,
	_opts?: { licenseId?: string | null; deviceId?: string | null }
): string {
	const base = appBase.trim() || 'https://app.eliteew.ru';
	const url = new URL(base.includes('://') ? base : `https://${base}`);
	stripForbiddenStartQuery(url);
	url.searchParams.set('eliteewDesktopClient', '1');
	return url.toString();
}

/** FoFline remote Start URL — interim/dev fallback only after L3 (not product default). */
export function buildFoflineStartUrl(
	appBase: string,
	_opts?: { licenseId?: string | null; deviceId?: string | null }
): string {
	const base = appBase.trim() || 'https://app.eliteew.ru';
	const url = new URL(base.includes('://') ? base : `https://${base}`);
	stripForbiddenStartQuery(url);
	url.searchParams.set('eliteewFoflineClient', '1');
	return url.toString();
}

/** Local verified SPA pack Start URL (L3 product path). */
export function buildFoflineLocalStartUrl(_opts?: {
	licenseId?: string | null;
	deviceId?: string | null;
}): string {
	const url = new URL(`${FOFLINE_LOCAL_SPA_ORIGIN}/index.html`);
	url.searchParams.set('eliteewFoflineClient', '1');
	return url.toString();
}

export function isFoflineLocalStartUrl(url: string): boolean {
	const trimmed = url.trim();
	if (trimmed.startsWith('fofline-spa://')) return true;
	try {
		const u = new URL(trimmed);
		return u.hostname.toLowerCase() === 'fofline-spa.localhost';
	} catch {
		return false;
	}
}

function isFoflineRemoteProductUrl(url: string): boolean {
	if (isFoflineLocalStartUrl(url)) return false;
	try {
		const u = new URL(url.trim());
		if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
		return u.searchParams.get('eliteewFoflineClient') === '1';
	} catch {
		return false;
	}
}

/**
 * L5 defense-in-depth (mirrors native `assert_fofline_start_url`):
 * pack ready → never remote product SPA; remote only with explicit fallback flag.
 */
export function assertFoflineStartUrlAllowed(params: {
	url: string;
	packReady: boolean;
	remoteFallback: boolean;
}): FoflineStartUrlAssert {
	if (isFoflineLocalStartUrl(params.url)) return { ok: true };
	if (!isFoflineRemoteProductUrl(params.url)) return { ok: true };
	if (params.packReady) {
		return { ok: false, code: 'remote_spa_forbidden_pack_ready' };
	}
	if (!params.remoteFallback) {
		return { ok: false, code: 'remote_spa_forbidden' };
	}
	return { ok: true };
}

/**
 * Cutover precedence (L3/L5):
 * 1. pack ready → local origin (remoteFallback ignored — no public SPA downgrade)
 * 2. else remoteFallback → remote appBase (dev/ops only)
 * 3. else blocked (fail-closed)
 */
export function resolveFoflineStartCutover(params: {
	packReady: boolean;
	appBase: string;
	remoteFallback?: boolean;
	licenseId?: string | null;
	deviceId?: string | null;
}): FoflineStartCutover {
	const bind = {
		licenseId: params.licenseId,
		deviceId: params.deviceId,
	};
	if (params.packReady) {
		return {
			kind: 'local',
			url: buildFoflineLocalStartUrl(bind),
		};
	}
	if (params.remoteFallback) {
		return {
			kind: 'remote',
			url: buildFoflineStartUrl(params.appBase, bind),
			code: 'remote_fallback',
		};
	}
	return {
		kind: 'blocked',
		code: 'pack_not_ready',
	};
}

/** Dev/ops only: VITE_FOFLINE_REMOTE_START=1 allows remote Start when pack not ready. */
export function isFoflineRemoteStartFallbackEnabled(): boolean {
	const raw = (import.meta.env.VITE_FOFLINE_REMOTE_START as string | undefined)
		?.trim()
		.toLowerCase();
	return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/** Semver-ish compare: returns true when current >= min (empty min → true). */
export function isVersionAtLeast(current: string, minVersion: string): boolean {
	const min = minVersion.trim();
	if (!min) return true;
	const a = parseParts(current);
	const b = parseParts(min);
	for (let i = 0; i < 3; i += 1) {
		const av = a[i] ?? 0;
		const bv = b[i] ?? 0;
		if (av > bv) return true;
		if (av < bv) return false;
	}
	return true;
}

function parseParts(raw: string): number[] {
	return raw
		.trim()
		.split(/[.+-]/)
		.slice(0, 3)
		.map((p) => {
			const n = Number.parseInt(p.replace(/\D/g, ''), 10);
			return Number.isFinite(n) ? n : 0;
		});
}

export function getMinClientVersion(): string {
	return import.meta.env.VITE_DESKTOP_CLIENT_MIN_VERSION?.trim() || '';
}
